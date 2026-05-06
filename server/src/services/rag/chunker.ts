/**
 * Chunker — splits a manuscript_context_source body into retrievable
 * pieces ready for embedding.
 *
 * Token counts are approximated as `ceil(chars / 4)` — the OpenAI tokenizer
 * is a rough match for that ratio on English prose, and we don't want to
 * pull in tiktoken just to chunk. Embedding cost is dominated by the
 * vector call itself, not the count fudge factor here.
 *
 * Splitting prefers paragraph boundaries, then sentences, then a hard
 * char-count cut as a last resort. We carry a small overlap (default 100
 * approx-tokens) so a query that lands on the boundary between two chunks
 * still has a chance of matching context on either side.
 */

import { createHash } from 'node:crypto'
import { manuscriptContextRepo } from '../../repositories/manuscript-context.repo.js'
import {
  ContextChunk,
  ManuscriptContextSource,
} from '../../models/ManuscriptContext.js'
import { logger } from '../../utils/logger.js'

export interface ChunkOptions {
  /** Target tokens per chunk. Default 800. */
  targetTokens?: number
  /** Approximate overlap between chunks. Default 120. */
  overlapTokens?: number
}

const DEFAULT_TARGET = 800
const DEFAULT_OVERLAP = 120
const CHARS_PER_TOKEN = 4

function approxTokens(chars: number): number {
  return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN))
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/**
 * Split a body into chunks. Algorithm:
 *   1. Split on blank-line paragraph breaks.
 *   2. Greedily fill a chunk up to the target token budget. Paragraphs
 *      that single-handedly exceed the budget get sentence-split.
 *   3. After emitting a chunk, overlap by ~overlapTokens of the tail
 *      back onto the next chunk. Overlap respects sentence boundaries
 *      where possible.
 */
export function chunkText(body: string, options: ChunkOptions = {}): { text: string; tokenCount: number }[] {
  const targetTokens = options.targetTokens ?? DEFAULT_TARGET
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP

  const targetChars = targetTokens * CHARS_PER_TOKEN
  const overlapChars = overlapTokens * CHARS_PER_TOKEN

  const trimmed = body.trim()
  if (!trimmed) return []
  if (approxTokens(trimmed.length) <= targetTokens) {
    return [{ text: trimmed, tokenCount: approxTokens(trimmed.length) }]
  }

  // Step 1: paragraphs.
  const paragraphs = trimmed.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0)

  // Step 2: greedy fill, sentence-split if a paragraph exceeds budget.
  const chunks: { text: string; tokenCount: number }[] = []
  let buf: string[] = []
  let bufLen = 0

  const flush = () => {
    if (buf.length === 0) return
    const text = buf.join('\n\n').trim()
    if (text) chunks.push({ text, tokenCount: approxTokens(text.length) })
    buf = []
    bufLen = 0
  }

  const addPiece = (piece: string) => {
    const len = piece.length + (bufLen > 0 ? 2 : 0) // 2 for \n\n separator
    if (bufLen > 0 && bufLen + len > targetChars) {
      flush()
    }
    if (piece.length > targetChars) {
      // Single piece bigger than the budget — sentence-split.
      const sentences = splitIntoSentences(piece)
      let inner: string[] = []
      let innerLen = 0
      for (const s of sentences) {
        const sLen = s.length + (innerLen > 0 ? 1 : 0)
        if (innerLen > 0 && innerLen + sLen > targetChars) {
          buf.push(inner.join(' '))
          bufLen = inner.join(' ').length
          flush()
          inner = []
          innerLen = 0
        }
        inner.push(s)
        innerLen += sLen
      }
      if (inner.length > 0) {
        const tail = inner.join(' ')
        buf.push(tail)
        bufLen = tail.length
      }
      return
    }
    buf.push(piece)
    bufLen += len
  }

  for (const p of paragraphs) addPiece(p)
  flush()

  // Step 3: overlap. Prepend a small tail of the previous chunk to the
  // next one. We do this AFTER chunking rather than during so the
  // primary chunk boundaries remain on natural breaks.
  if (overlapChars > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = tailOnSentenceBoundary(chunks[i - 1].text, overlapChars)
      if (prevTail) {
        const merged = `${prevTail}\n\n${chunks[i].text}`
        chunks[i] = { text: merged, tokenCount: approxTokens(merged.length) }
      }
    }
  }

  return chunks
}

/** Split into sentences on . ! ? followed by whitespace. Leaves quotes intact. */
function splitIntoSentences(s: string): string[] {
  const out: string[] = []
  const re = /[^.!?]+[.!?]+(?:["')\]]+)?\s*/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    out.push(m[0].trim())
    lastIndex = re.lastIndex
  }
  if (lastIndex < s.length) out.push(s.slice(lastIndex).trim())
  return out.filter(x => x.length > 0)
}

/** Take the last `n` chars of s, snapped back to a sentence boundary if reasonable. */
function tailOnSentenceBoundary(s: string, n: number): string {
  if (s.length <= n) return s
  const slice = s.slice(-n)
  // Find the first sentence boundary inside the slice; everything before it is fragment.
  const m = slice.search(/[.!?]\s+/)
  if (m === -1 || m > slice.length - 20) return slice
  return slice.slice(m + 1).trim()
}

/* ----- Public service entry point ----- */

export interface ChunkSourceResult {
  contextSourceId: string
  rebuilt: boolean
  chunkCount: number
}

/**
 * (Re)chunk a single context source. If the source's chunks already
 * cover the same content (matched by their concatenated content_hash)
 * this is a no-op. Otherwise existing chunks are deleted and the new
 * set is inserted. Embeddings cascade-delete with chunks via FK.
 */
export async function chunkContextSource(
  source: ManuscriptContextSource,
  options: ChunkOptions = {}
): Promise<ChunkSourceResult> {
  if (!source.body || !source.body.trim()) {
    // Empty body — clear any leftover chunks so retrieval doesn't return
    // stale text after a body has been blanked out.
    await manuscriptContextRepo.deleteChunksBySource(source.id)
    return { contextSourceId: source.id, rebuilt: true, chunkCount: 0 }
  }

  const newChunks = chunkText(source.body, options)
  const newAggregateHash = sha256(newChunks.map(c => c.text).join('\n----\n'))

  // Compare against the existing chunk set's hash. The repo doesn't
  // currently store a per-source aggregate, so we derive it from the
  // existing rows. This is bounded by chunk count per source (~10) so
  // it's cheap.
  const existing = await manuscriptContextRepo.listChunksBySource(source.id)
  const existingAggregateHash = existing.length === 0
    ? null
    : sha256(existing.map(c => c.text).join('\n----\n'))

  if (existingAggregateHash && existingAggregateHash === newAggregateHash) {
    return { contextSourceId: source.id, rebuilt: false, chunkCount: existing.length }
  }

  // Wipe and rebuild. Embeddings cascade.
  await manuscriptContextRepo.deleteChunksBySource(source.id)
  await manuscriptContextRepo.insertChunks(
    newChunks.map((c, i) => ({
      manuscriptId: source.manuscriptId,
      contextSourceId: source.id,
      chunkIndex: i,
      text: c.text,
      tokenCount: c.tokenCount,
      metadata: {
        sourceTitle: source.title,
        sourceType: source.sourceType,
        contextRole: source.contextRole,
      },
      contentHash: sha256(c.text),
    }))
  )

  return { contextSourceId: source.id, rebuilt: true, chunkCount: newChunks.length }
}

/**
 * Chunk every active source for a manuscript. Sources whose body is
 * already represented by their existing chunks are skipped.
 */
export async function chunkManuscriptContext(
  manuscriptId: string,
  options: ChunkOptions = {}
): Promise<{ rebuiltSources: number; totalChunks: number; totalSources: number }> {
  const sources = await manuscriptContextRepo.listSources(manuscriptId, { includeArchived: false })
  let rebuiltSources = 0
  let totalChunks = 0
  for (const s of sources) {
    const r = await chunkContextSource(s, options)
    if (r.rebuilt) rebuiltSources += 1
    totalChunks += r.chunkCount
  }
  logger.info('[rag.chunk] done', {
    manuscriptId,
    totalSources: sources.length,
    rebuiltSources,
    totalChunks,
  })
  return { rebuiltSources, totalChunks, totalSources: sources.length }
}

/** Re-export for tests. */
export type { ContextChunk }
