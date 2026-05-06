/**
 * Manuscript assist service - orchestrates the AI assist modes.
 *
 * For chunk 3 only the gap_analysis mode is implemented. The structure here
 * (mode dispatch, retrieval-before-generation, persistence as artifacts) is
 * the same shape every future mode (bridges, motif tracking, voice audits)
 * will plug into.
 *
 * Responsibilities:
 *   1. Authorize the caller via manuscriptRepo.assertAccess (already done by
 *      the service layer's existing helpers).
 *   2. Pull the manuscript, sections, items + bodies, and prior accepted
 *      artifacts. This is the "retrieval before generation" rule from the
 *      product spec - the model is never asked to reason from training alone.
 *   3. Build the prompt via the pure prompts module.
 *   4. Call the LLM client (injectable for tests).
 *   5. Validate and normalise the response.
 *   6. Persist results as ManuscriptArtifacts so they don't disappear.
 */
import { manuscriptService } from './manuscript.service.js'
import { manuscriptRepo } from '../repositories/manuscript.repo.js'
import { manuscriptArtifactRepo } from '../repositories/manuscript-artifact.repo.js'
import {
  ManuscriptArtifact,
  ManuscriptItem,
  ManuscriptSection,
  ManuscriptProject,
  GapAnalysisContent,
} from '../models/Manuscript.js'
import { LlmClient, LlmConfigurationError } from './llm/llm-client.js'
import { getOpenAIClient } from './llm/openai-client.js'
import { ASSIST_SYSTEM_PROMPT, buildGapAnalysisPrompt, GapPromptItem } from './llm/prompts.js'
import { ValidationError } from '../utils/errors.js'
import { retrieveManuscriptContext } from './rag/index.js'
import { logger } from '../utils/logger.js'

/* ----- LLM client injection (for tests) ----- */

let activeClient: LlmClient | null = null

/**
 * Tests inject a fake LlmClient via this hook so the service never touches
 * the network. Production code path uses getOpenAIClient() lazily.
 */
export function setLlmClientForTests(client: LlmClient | null): void {
  activeClient = client
}

function client(): LlmClient {
  return activeClient ?? getOpenAIClient()
}

/* ----- Mode types ----- */

export type AssistMode = 'gaps'

export interface RunAssistInput {
  manuscriptId: string
  mode: AssistMode
  /**
   * For gap analysis: optionally narrow to a single junction. If omitted,
   * walks every adjacent pair in the ordered spine.
   */
  junction?: { fromItemId: string; toItemId: string }
  /** Skip persisting artifacts (preview-only). Default false. */
  dryRun?: boolean
}

export interface RunAssistResult {
  mode: AssistMode
  artifacts: ManuscriptArtifact[]
  /** Junctions analyzed (useful for the UI to show progress / failures). */
  analyzedJunctions: { fromItemId: string; toItemId: string }[]
  /** Number of junctions skipped because either side had no body content. */
  skipped: number
  model?: string
}

/* ----- RAG retrieval helper (best-effort) -----
 *
 * The RAG layer is additive: if it isn't configured (no OPENAI_API_KEY,
 * pgvector missing, no chunks indexed yet) the call falls back to
 * "no retrieved context" rather than failing the assist run. This keeps
 * the assist surface usable in dev/test environments where embedding
 * infrastructure may not be set up, and means existing prompts
 * deterministically work with or without retrieval.
 */
async function tryRetrieveContextPack(
  manuscriptId: string,
  query: string,
  maxContextTokens = 2000
): Promise<string> {
  try {
    const result = await retrieveManuscriptContext(manuscriptId, query, {
      topK: 8,
      maxContextTokens,
    })
    return result.chunks.length > 0 ? result.contextPack : ''
  } catch (err) {
    logger.warn('[manuscript-assist] retrieval skipped', {
      manuscriptId,
      message: err instanceof Error ? err.message : String(err),
    })
    return ''
  }
}

/* ----- Helpers ----- */

/**
 * Order items by section order, then order_index within section, then
 * unassigned at the end. Mirrors the export formatter's render order so the
 * notion of "adjacent" matches what the user sees in the Book Room.
 */
function orderItems(
  sections: ManuscriptSection[],
  items: (ManuscriptItem & { body: string | null })[]
): GapPromptItem[] {
  const orderedSections = [...sections].sort((a, b) =>
    a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt)
  )
  const sectionIds = new Set(orderedSections.map(s => s.id))
  const out: GapPromptItem[] = []
  for (const s of orderedSections) {
    const list = items
      .filter(i => i.sectionId === s.id)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
    out.push(...list)
  }
  const unassigned = items
    .filter(i => !i.sectionId || !sectionIds.has(i.sectionId))
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
  out.push(...unassigned)
  return out
}

function findSectionTitle(
  sections: ManuscriptSection[],
  from: ManuscriptItem,
  to: ManuscriptItem
): string | null {
  // The "junction belongs to" the earlier item's section. Cross-section
  // junctions are interesting too; we still report from the earlier side.
  const sId = from.sectionId
  if (!sId) return null
  const s = sections.find(x => x.id === sId)
  return s?.title ?? null
}

/**
 * Pull prior accepted gap_analysis artifacts so the model doesn't repeat
 * suggestions the user has already accepted (or rejected, but we prefer not
 * to leak rejections back as if they were guidance).
 */
async function loadPriorAcceptedNotes(
  manuscriptId: string,
  userId: string,
  isAdmin: boolean
): Promise<string[]> {
  const accepted = await manuscriptArtifactRepo.list(manuscriptId, userId, isAdmin, {
    type: 'gap_analysis',
    status: 'accepted',
  })
  const notes: string[] = []
  for (const a of accepted) {
    const c = a.content as Partial<GapAnalysisContent>
    if (c.summary) notes.push(c.summary)
  }
  return notes
}

/* ----- Response validation ----- */

interface RawSuggestion {
  title?: unknown
  gapType?: unknown
  body?: unknown
  confidence?: unknown
  actionType?: unknown
  groundedIn?: unknown
}
interface RawGapResponse {
  summary?: unknown
  suggestions?: unknown
}

const VALID_GAP_TYPES = ['context','emotional','logical','time','character','motif','repetition','other'] as const
const VALID_CONFIDENCE = ['low','medium','high'] as const
const VALID_ACTION = ['reorder','add_bridge','revise','cut','expand','question','note'] as const

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function clampEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v as T : fallback
}

/**
 * Normalise the raw LLM JSON into a GapAnalysisContent. Everything is
 * defensive: if the model omits a field or sends a wrong shape, we coerce
 * to a safe default rather than throwing - so one weird response doesn't
 * blow up an entire pass.
 */
function normaliseGapResponse(raw: unknown): GapAnalysisContent {
  const r = (raw && typeof raw === 'object') ? raw as RawGapResponse : {}
  const summary = asString(r.summary, 'No summary returned.').slice(0, 500)
  const suggestionsRaw = Array.isArray(r.suggestions) ? r.suggestions : []

  const suggestions: GapAnalysisContent['suggestions'] = []
  for (const s of suggestionsRaw) {
    if (!s || typeof s !== 'object') continue
    const obj = s as RawSuggestion
    const title = asString(obj.title, 'Untitled suggestion').slice(0, 200)
    const body  = asString(obj.body, '').trim()
    if (!body) continue // discard empty suggestions
    const groundedInRaw = Array.isArray(obj.groundedIn) ? obj.groundedIn : []
    const groundedIn = groundedInRaw.map((g): GapAnalysisContent['suggestions'][number]['groundedIn'][number] => {
      const o = (g && typeof g === 'object') ? g as Record<string, unknown> : {}
      return {
        writingBlockId: typeof o.writingBlockId === 'string' ? o.writingBlockId : null,
        itemId: typeof o.itemId === 'string' ? o.itemId : null,
        title: asString(o.title, '').slice(0, 200),
        excerpt: asString(o.excerpt, '').slice(0, 400),
      }
    })
    suggestions.push({
      title,
      body,
      gapType:    clampEnum(obj.gapType,    VALID_GAP_TYPES,  'other'),
      confidence: clampEnum(obj.confidence, VALID_CONFIDENCE, 'medium'),
      actionType: clampEnum(obj.actionType, VALID_ACTION,     'note'),
      groundedIn,
    })
  }

  return { summary, suggestions }
}

/* ----- Public API ----- */

export const manuscriptAssistService = {
  /**
   * Run an assist mode end-to-end. Returns the persisted artifacts (or, if
   * dryRun, the artifact-shaped objects without ids/timestamps).
   */
  async run(input: RunAssistInput, userId: string, isAdmin: boolean = false): Promise<RunAssistResult> {
    if (input.mode !== 'gaps') {
      throw new ValidationError(`Unsupported assist mode: ${input.mode}`)
    }

    // Authorize via existing manuscriptService.get (throws NotFoundError or
    // ForbiddenError exactly the same way as the rest of the API).
    const manuscript = await manuscriptService.get(input.manuscriptId, userId, isAdmin)
    const sections = await manuscriptService.listSections(input.manuscriptId, userId, isAdmin)
    const itemsWithBodies = await manuscriptRepo.listItemsWithBodies(input.manuscriptId, userId, isAdmin)

    return runGapAnalysis({
      manuscript,
      sections,
      itemsWithBodies,
      junction: input.junction,
      dryRun: input.dryRun ?? false,
      userId,
      isAdmin,
    })
  },
}

/* ----- Gap analysis implementation ----- */

interface GapRunInput {
  manuscript: ManuscriptProject
  sections: ManuscriptSection[]
  itemsWithBodies: (ManuscriptItem & { body: string | null })[]
  junction?: { fromItemId: string; toItemId: string }
  dryRun: boolean
  userId: string
  isAdmin: boolean
}

async function runGapAnalysis(input: GapRunInput): Promise<RunAssistResult> {
  const { manuscript, sections, itemsWithBodies, junction, dryRun, userId, isAdmin } = input

  // Build the ordered spine and decide which junctions to analyse.
  const ordered = orderItems(sections, itemsWithBodies)
  let pairs: { from: GapPromptItem; to: GapPromptItem }[] = []
  if (junction) {
    const from = ordered.find(i => i.id === junction.fromItemId)
    const to   = ordered.find(i => i.id === junction.toItemId)
    if (!from || !to) {
      throw new ValidationError('junction items not found in this manuscript')
    }
    pairs = [{ from, to }]
  } else {
    for (let i = 0; i + 1 < ordered.length; i++) {
      pairs.push({ from: ordered[i], to: ordered[i + 1] })
    }
  }

  if (pairs.length === 0) {
    return { mode: 'gaps', artifacts: [], analyzedJunctions: [], skipped: 0 }
  }

  // Refuse the run if the LLM client isn't configured. We do this AFTER access
  // checks but BEFORE we burn tokens, so misconfigured deploys give a clean
  // error message at the front door.
  let llm: LlmClient
  try {
    llm = client()
  } catch (err) {
    if (err instanceof LlmConfigurationError) throw err
    throw err
  }

  const priorNotes = await loadPriorAcceptedNotes(manuscript.id, userId, isAdmin)

  const artifacts: ManuscriptArtifact[] = []
  const analyzed: { fromItemId: string; toItemId: string }[] = []
  let skipped = 0
  let lastModel: string | undefined

  for (const { from, to } of pairs) {
    // Skip junctions where neither side has any body content - the model can't
    // do meaningful gap analysis between two empty placeholders. Still counts
    // as analyzed-but-skipped so the UI can show why.
    if (!from.body && !from.summary && !to.body && !to.summary) {
      skipped++
      continue
    }

    let prompt = buildGapAnalysisPrompt({
      manuscript,
      sectionTitle: findSectionTitle(sections, from, to),
      from,
      to,
      priorAcceptedNotes: priorNotes,
    })

    // Augment with retrieved manuscript context UNLESS the caller targeted
    // a specific junction — when they did, they've already narrowed scope
    // and don't want the broader manuscript bleeding into the prompt.
    // Best-effort: silently skipped if RAG isn't configured.
    if (!junction) {
      const query = `Junction: "${from.title}" -> "${to.title}". ` +
        (manuscript.centralQuestion ? `Central question: ${manuscript.centralQuestion}. ` : '') +
        (manuscript.throughLine ? `Through-line: ${manuscript.throughLine}.` : '')
      const pack = await tryRetrieveContextPack(manuscript.id, query)
      if (pack) {
        prompt =
          'Use the retrieved manuscript context below as authoritative project memory unless the user explicitly overrides it.\n\n' +
          '<retrieved_manuscript_context>\n' +
          pack + '\n' +
          '</retrieved_manuscript_context>\n\n' +
          prompt
      }
    }

    const response = await llm.chatJson({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      system: ASSIST_SYSTEM_PROMPT,
      user: prompt,
      // Provenance for the diagnostic ai_exchanges log — see migration 019
      // and migration 021 for the explicit manuscript_id column.
      context: {
        feature: 'manuscript-assist',
        mode: 'gaps',
        userId,
        resourceType: 'manuscript',
        resourceId: manuscript.id,
        manuscriptId: manuscript.id,
      },
    })
    lastModel = response.model

    const content = normaliseGapResponse(response.json)
    analyzed.push({ fromItemId: from.id, toItemId: to.id })

    // Even when there are no suggestions, persist a record so the user can see
    // "this junction was checked and nothing came up" - that's useful signal.
    const title = `Gap: ${from.title} → ${to.title}`
    const relatedWritingBlockIds = [from.writingBlockId, to.writingBlockId].filter((x): x is string => !!x)

    if (dryRun) {
      // Return a transient artifact-shaped object without a real id.
      artifacts.push({
        id: `dry-${from.id}-${to.id}`,
        manuscriptId: manuscript.id,
        type: 'gap_analysis',
        title,
        content,
        status: 'draft',
        relatedWritingBlockIds,
        fromItemId: from.id,
        toItemId: to.id,
        sourceModel: response.model,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } else {
      const saved = await manuscriptArtifactRepo.create({
        manuscriptId: manuscript.id,
        type: 'gap_analysis',
        title,
        content,
        relatedWritingBlockIds,
        fromItemId: from.id,
        toItemId: to.id,
        sourceModel: response.model,
        createdBy: userId,
      })
      artifacts.push(saved)
    }
  }

  return { mode: 'gaps', artifacts, analyzedJunctions: analyzed, skipped, model: lastModel }
}
