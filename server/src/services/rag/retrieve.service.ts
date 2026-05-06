/**
 * Manuscript-scoped retrieval.
 *
 * The single hard guarantee here: every chunk returned has the requested
 * manuscript_id. The `searchByVector` repo method enforces this with a
 * WHERE clause; this service layer adds scoring on top, but never
 * loosens the manuscript filter.
 *
 * Scoring shape (all signals additive on top of `1 - cosine_distance`):
 *   + canonical            : +0.15
 *   + accepted status      : +0.10
 *   + priority / 1000      : 0.0 .. ~0.1
 *   - rejected / archived  : reject by filter
 *   - superseded           : reject by filter
 *
 * The contextPack rendering keeps a strict cap on tokens so a manuscript
 * with thousands of chunks can never blow the prompt budget.
 */

import { manuscriptContextRepo, type VectorSearchHit } from '../../repositories/manuscript-context.repo.js'
import { getEmbeddingClient, type EmbeddingClient } from './embed.service.js'
import {
  ContextRole,
  ContextSourceType,
  ContextStatus,
  RetrievalOptions,
  RetrievedChunk,
  RetrievedContext,
} from '../../models/ManuscriptContext.js'
import { logger } from '../../utils/logger.js'

const DEFAULT_TOP_K = 8
const DEFAULT_MAX_TOKENS = 4000

const CANONICAL_BOOST = 0.15
const ACCEPTED_STATUS_BOOST = 0.10
const PRIORITY_DIVISOR = 1000

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function approxTokens(chars: number): number {
  return Math.max(1, Math.ceil(chars / 4))
}

function scoreHit(hit: VectorSearchHit): number {
  // pgvector cosine distance is in [0, 2]. Convert to similarity in [-1, 1].
  // For normalized embeddings (all OpenAI text-embedding-3 outputs are
  // normalized) the distance is in [0, 2] and the similarity is 1 - d.
  const similarity = 1 - hit.distance
  let score = similarity
  if (hit.canonical) score += CANONICAL_BOOST
  if (hit.status === 'accepted') score += ACCEPTED_STATUS_BOOST
  if (typeof hit.priority === 'number') score += hit.priority / PRIORITY_DIVISOR
  return score
}

function renderContextPack(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '# Retrieved Manuscript Context\n\n(No relevant context found in this manuscript.)\n'
  const parts: string[] = ['# Retrieved Manuscript Context\n']
  for (const c of chunks) {
    parts.push(
      `## Source: ${c.title}\n` +
      `Type: ${c.sourceType}\n` +
      `Role: ${c.contextRole}\n` +
      `Relevance: ${c.score.toFixed(3)}\n\n` +
      c.text +
      `\n\n---`
    )
  }
  return parts.join('\n')
}

export interface RetrieveDeps {
  /** Override embedding client (tests). */
  embedder?: EmbeddingClient
}

/**
 * Retrieve manuscript-scoped context for a query. The manuscriptId is a
 * mandatory positional argument — there is no global retrieval mode. If
 * the caller doesn't have a manuscriptId, they should not be using this
 * service.
 *
 * Returns up to `options.topK` chunks ordered by score (descending),
 * trimmed to fit `options.maxContextTokens`.
 */
export async function retrieveManuscriptContext(
  manuscriptId: string,
  query: string,
  options: RetrievalOptions = {},
  deps: RetrieveDeps = {}
): Promise<RetrievedContext> {
  if (!manuscriptId) throw new Error('retrieveManuscriptContext: manuscriptId is required')
  const trimmed = query.trim()
  if (!trimmed) {
    return { query: '', chunks: [], contextPack: renderContextPack([]) }
  }

  const topK = options.topK ?? envInt('RAG_TOP_K', DEFAULT_TOP_K)
  const maxContextTokens = options.maxContextTokens ?? envInt('RAG_MAX_CONTEXT_TOKENS', DEFAULT_MAX_TOKENS)

  // Short-circuit when the manuscript has no embeddings yet: no point
  // burning tokens on the query embedding when there's nothing to compare
  // against. Also keeps retrieval inert in test environments where the
  // RAG layer hasn't been seeded.
  const stats = await manuscriptContextRepo.stats(manuscriptId)
  if (stats.embeddings === 0) {
    return { query: trimmed, chunks: [], contextPack: renderContextPack([]) }
  }

  // Pull a few extra hits from the vector store so post-filtering
  // (status / role) leaves us enough to pick from.
  const overFetch = Math.min(topK * 3, 64)

  const embedder = deps.embedder ?? getEmbeddingClient()
  const queryVector = await embedder.embedText(trimmed)

  // Resolve status filter. By default we exclude archived/superseded/
  // rejected; `includeArchived` flips off the filter entirely.
  const statusFilter: ContextStatus[] | undefined = options.includeArchived
    ? undefined
    : (options.status ?? ['active', 'accepted', 'draft'])

  const hits = await manuscriptContextRepo.searchByVector({
    manuscriptId,
    embedding: queryVector,
    embeddingModel: embedder.model,
    topK: overFetch,
    sourceTypes: options.sourceTypes,
    contextRoles: options.contextRoles,
    status: statusFilter,
    includeArchived: options.includeArchived,
  })

  // Defence in depth: assert that every hit IS for this manuscript.
  // If anything ever slips past the WHERE clause we want a loud failure
  // rather than a silent leak. Filter out (don't throw) so a genuinely
  // weird DB state doesn't take down a whole assist call — log instead.
  const safeHits = hits.filter(h => {
    if (h.manuscriptId !== manuscriptId) {
      logger.error('[rag.retrieve] cross-manuscript hit dropped', {
        expected: manuscriptId, got: h.manuscriptId, chunkId: h.chunkId,
      })
      return false
    }
    return true
  })

  // Optional name/movement filters. Cheap to evaluate after the vector
  // search since the result set is already small.
  const characterNames = (options.characterNames ?? []).map(s => s.toLowerCase())
  const movement = options.movement?.toLowerCase()
  const matchesPostFilter = (h: VectorSearchHit): boolean => {
    if (characterNames.length > 0) {
      const sm = h.sourceMetadata ?? {}
      const cm = h.chunkMetadata ?? {}
      const candidates: string[] = []
      if (typeof sm.characterName === 'string') candidates.push(sm.characterName)
      if (typeof sm.povCharacterName === 'string') candidates.push(sm.povCharacterName)
      if (typeof cm.characterName === 'string') candidates.push(cm.characterName)
      const inName = candidates.some(c => characterNames.includes(c.toLowerCase()))
      if (!inName) return false
    }
    if (movement) {
      const sm = h.sourceMetadata ?? {}
      const m = typeof sm.movement === 'string' ? sm.movement.toLowerCase() : null
      if (m !== movement) return false
    }
    return true
  }

  // Score, post-filter, sort, top-K, token-cap.
  const scored = safeHits
    .filter(matchesPostFilter)
    .map(h => ({ hit: h, score: scoreHit(h) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  const chunks: RetrievedChunk[] = []
  let tokenBudget = maxContextTokens
  for (const { hit, score } of scored) {
    const tokens = hit.tokenCount ?? approxTokens(hit.text.length)
    if (tokens > tokenBudget && chunks.length > 0) break
    chunks.push({
      chunkId: hit.chunkId,
      contextSourceId: hit.contextSourceId,
      manuscriptId: hit.manuscriptId,
      title: hit.title,
      sourceType: hit.sourceType as ContextSourceType,
      contextRole: hit.contextRole as ContextRole,
      text: hit.text,
      score,
      metadata: {
        ...hit.sourceMetadata,
        ...hit.chunkMetadata,
        canonical: hit.canonical,
        status: hit.status,
      },
    })
    tokenBudget -= tokens
    if (tokenBudget <= 0) break
  }

  return {
    query: trimmed,
    chunks,
    contextPack: renderContextPack(chunks),
  }
}

/**
 * Build the prompt boundary block recommended by the spec. Inlines the
 * contextPack inside `<retrieved_manuscript_context>` tags so the model
 * has a clearly bounded section to attend to (and so any future
 * post-prompt content doesn't get mistaken for retrieved material).
 */
export function buildPromptWithContext(args: {
  manuscriptId: string
  contextPack: string
  userRequest: string
}): string {
  return [
    'You are working on one manuscript only.',
    '',
    `Manuscript ID: ${args.manuscriptId}`,
    '',
    'Use the retrieved manuscript context below as authoritative project memory unless the user explicitly overrides it.',
    '',
    '<retrieved_manuscript_context>',
    args.contextPack,
    '</retrieved_manuscript_context>',
    '',
    "Now answer the user's request.",
    '',
    args.userRequest,
  ].join('\n')
}
