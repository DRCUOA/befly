/**
 * Embedding provider + service.
 *
 * Provider interface (`EmbeddingClient`) keeps the rest of the RAG
 * layer ignorant of where vectors come from — exactly the same pattern
 * `LlmClient` uses for chat completions. Tests inject a deterministic
 * fake; production code uses the OpenAI embeddings endpoint via fetch
 * (no SDK dependency, mirroring openai-client.ts).
 *
 * Configuration:
 *   EMBEDDING_MODEL  — required at runtime; default 'text-embedding-3-small'
 *                       (1536 dim, matches the migration's vector(1536)).
 *   OPENAI_API_KEY   — required for the production client.
 *
 * Idempotency: embedManuscriptContext only embeds chunks that don't yet
 * have an embedding for the configured model. Re-running on an already-
 * embedded manuscript is a no-op.
 */

import { manuscriptContextRepo } from '../../repositories/manuscript-context.repo.js'
import { LlmConfigurationError, LlmRequestError } from '../llm/llm-client.js'
import { logger } from '../../utils/logger.js'

export interface EmbeddingClient {
  /** Model id this client is configured for (used to key context_embeddings). */
  readonly model: string
  /** Vector dimension. Must match the schema (1536 in migration 022). */
  readonly dimension: number
  embedText(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

const DEFAULT_MODEL = 'text-embedding-3-small'
const DEFAULT_DIMENSION = 1536
const ENDPOINT = 'https://api.openai.com/v1/embeddings'
const MAX_BATCH = 64

/* ----- OpenAI implementation ----- */

class OpenAIEmbeddingClient implements EmbeddingClient {
  readonly model: string
  readonly dimension: number
  private apiKey: string

  constructor(apiKey: string, model: string, dimension: number) {
    this.apiKey = apiKey
    this.model = model
    this.dimension = dimension
  }

  async embedText(text: string): Promise<number[]> {
    const [v] = await this.embedBatch([text])
    return v
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    // Split into provider-friendly batches.
    const out: number[][] = []
    for (let i = 0; i < texts.length; i += MAX_BATCH) {
      const slice = texts.slice(i, i + MAX_BATCH)
      const vectors = await this.callOnce(slice)
      out.push(...vectors)
    }
    return out
  }

  private async callOnce(texts: string[]): Promise<number[][]> {
    const start = Date.now()
    const body = {
      model: this.model,
      input: texts,
    }
    let response: Response
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new LlmRequestError(`Embedding network error: ${message}`)
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new LlmRequestError(
        `OpenAI embeddings returned ${response.status}: ${text.slice(0, 500)}`,
        response.status
      )
    }
    const payload = await response.json() as {
      data?: { embedding?: number[]; index?: number }[]
    }
    const data = payload.data ?? []
    // Sort by index to be safe — the API documents stable order but we'd
    // rather not silently misalign vectors with their input on a quirk.
    data.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    const vectors = data.map(d => d.embedding ?? [])
    if (vectors.length !== texts.length) {
      throw new LlmRequestError(
        `OpenAI embeddings: expected ${texts.length} vectors, got ${vectors.length}`
      )
    }
    for (const v of vectors) {
      if (v.length !== this.dimension) {
        throw new LlmRequestError(
          `Embedding dimension mismatch: got ${v.length}, expected ${this.dimension}. ` +
          `Configured model: ${this.model}. The vector(N) column must match.`
        )
      }
    }
    logger.debug('[embed] batch ok', { model: this.model, count: texts.length, ms: Date.now() - start })
    return vectors
  }
}

/* ----- Factory + test injection ----- */

let activeClient: EmbeddingClient | null = null

/** Tests inject a deterministic embedder so we don't burn API tokens. */
export function setEmbeddingClientForTests(client: EmbeddingClient | null): void {
  activeClient = client
}

export function getEmbeddingClient(): EmbeddingClient {
  if (activeClient) return activeClient
  const model = process.env.EMBEDDING_MODEL?.trim() || DEFAULT_MODEL
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    throw new LlmConfigurationError(
      'OPENAI_API_KEY is not set. Embedding is unavailable until the key is configured.'
    )
  }
  // Hard-coded to 1536 because that's the dimension of the production
  // model AND the vector column shape. Override only by changing both
  // the migration and this constant in lockstep.
  activeClient = new OpenAIEmbeddingClient(apiKey, model, DEFAULT_DIMENSION)
  return activeClient
}

export function resetEmbeddingClientCache(): void {
  activeClient = null
}

/* ----- Public service ----- */

/**
 * Embed every unembedded chunk in the manuscript. Idempotent: chunks
 * that already have an embedding for the configured model are skipped.
 */
export async function embedManuscriptContext(
  manuscriptId: string
): Promise<{ embedded: number; skipped: number; total: number; model: string }> {
  const client = getEmbeddingClient()
  const pending = await manuscriptContextRepo.listUnembeddedChunks(manuscriptId, client.model)

  if (pending.length === 0) {
    const stats = await manuscriptContextRepo.stats(manuscriptId)
    return { embedded: 0, skipped: stats.chunks, total: stats.chunks, model: client.model }
  }

  // Batch up to MAX_BATCH at a time. The provider call is the slow part;
  // the upsert is fast enough not to pipeline further.
  let embedded = 0
  for (let i = 0; i < pending.length; i += MAX_BATCH) {
    const slice = pending.slice(i, i + MAX_BATCH)
    const vectors = await client.embedBatch(slice.map(c => c.text))
    for (let j = 0; j < slice.length; j++) {
      await manuscriptContextRepo.upsertEmbedding(
        manuscriptId,
        slice[j].id,
        vectors[j],
        client.model
      )
      embedded += 1
    }
  }

  const stats = await manuscriptContextRepo.stats(manuscriptId)
  logger.info('[rag.embed] done', { manuscriptId, embedded, total: stats.chunks, model: client.model })
  return {
    embedded,
    skipped: stats.chunks - embedded,
    total: stats.chunks,
    model: client.model,
  }
}
