/**
 * Manuscript context repository — DAO for the three RAG tables:
 *   manuscript_context_sources, context_chunks, context_embeddings.
 *
 * Every read and write is keyed on manuscript_id so a misuse cannot
 * silently leak rows from another manuscript. The retrieval helper
 * `searchByVector` uses pgvector's cosine distance operator (`<=>`) and
 * filters by manuscript_id in the same WHERE clause as the vector op,
 * which is exactly the pattern pgvector's docs recommend for scoped
 * search.
 */
import { pool } from '../config/db.js'
import {
  ContextChunk,
  ContextRole,
  ContextSourceType,
  ContextStatus,
  ManuscriptContextSource,
} from '../models/ManuscriptContext.js'

/* ---------- column projections ---------- */

const SOURCE_COLUMNS = `
  id,
  manuscript_id  AS "manuscriptId",
  user_id        AS "userId",
  source_type    AS "sourceType",
  source_id      AS "sourceId",
  title,
  body,
  metadata,
  context_role   AS "contextRole",
  priority,
  status,
  canonical,
  include_in_ai  AS "includeInAi",
  content_hash   AS "contentHash",
  created_at     AS "createdAt",
  updated_at     AS "updatedAt"
`

const CHUNK_COLUMNS = `
  id,
  manuscript_id      AS "manuscriptId",
  context_source_id  AS "contextSourceId",
  chunk_index        AS "chunkIndex",
  text,
  token_count        AS "tokenCount",
  metadata,
  content_hash       AS "contentHash",
  created_at         AS "createdAt"
`

/* ---------- types ---------- */

export interface UpsertSourceInput {
  manuscriptId: string
  userId: string
  sourceType: ContextSourceType
  sourceId: string | null
  title: string
  body: string | null
  metadata?: Record<string, unknown>
  contextRole?: ContextRole
  priority?: number
  status?: ContextStatus
  canonical?: boolean
  includeInAi?: boolean
  contentHash: string
}

export interface InsertChunkInput {
  manuscriptId: string
  contextSourceId: string
  chunkIndex: number
  text: string
  tokenCount: number | null
  metadata?: Record<string, unknown>
  contentHash: string
}

export interface VectorSearchHit {
  chunkId: string
  contextSourceId: string
  manuscriptId: string
  title: string
  sourceType: ContextSourceType
  contextRole: ContextRole
  status: ContextStatus
  canonical: boolean
  priority: number
  text: string
  tokenCount: number | null
  sourceMetadata: Record<string, unknown>
  chunkMetadata: Record<string, unknown>
  /** Cosine distance (0 = identical, 2 = opposite). Smaller is more similar. */
  distance: number
}

export interface VectorSearchOptions {
  manuscriptId: string
  embedding: number[]
  embeddingModel: string
  topK: number
  sourceTypes?: ContextSourceType[]
  contextRoles?: ContextRole[]
  /** Status values to include. If omitted, defaults to ('active','accepted','draft'). */
  status?: ContextStatus[]
  includeArchived?: boolean
}

/* ---------- helpers ---------- */

/**
 * Render a JS number[] into the pgvector literal format: `[1,2,3]`.
 * pg's parameter binding for the `vector` type accepts the literal as
 * a string with an explicit cast, which is the form used throughout.
 */
function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

/* ---------- repo ---------- */

export const manuscriptContextRepo = {
  /* ============================================================
   *  Sources
   * ============================================================ */

  /**
   * Upsert a context source by (manuscript_id, source_type, source_id).
   * source_id = null is allowed for free-form sources (manual notes etc.);
   * those rows are matched on (manuscript_id, source_type, title) instead.
   * Returns the row plus an `unchanged` flag if the existing row's
   * content_hash matched the incoming one.
   */
  async upsertSource(
    input: UpsertSourceInput
  ): Promise<{ source: ManuscriptContextSource; action: 'created' | 'updated' | 'unchanged' }> {
    const existing = input.sourceId
      ? await pool.query(
          `SELECT ${SOURCE_COLUMNS} FROM manuscript_context_sources
           WHERE manuscript_id = $1 AND source_type = $2 AND source_id = $3`,
          [input.manuscriptId, input.sourceType, input.sourceId]
        )
      : await pool.query(
          `SELECT ${SOURCE_COLUMNS} FROM manuscript_context_sources
           WHERE manuscript_id = $1 AND source_type = $2 AND source_id IS NULL AND title = $3`,
          [input.manuscriptId, input.sourceType, input.title]
        )

    if (existing.rows.length > 0) {
      const row = existing.rows[0] as ManuscriptContextSource
      if (row.contentHash === input.contentHash && row.status !== 'superseded') {
        // Body unchanged — touch nothing so chunks/embeddings can stay.
        return { source: row, action: 'unchanged' }
      }
      const updated = await pool.query(
        `UPDATE manuscript_context_sources
            SET title         = $1,
                body          = $2,
                metadata      = $3::jsonb,
                context_role  = $4,
                priority      = $5,
                status        = $6,
                canonical     = $7,
                include_in_ai = $8,
                content_hash  = $9,
                user_id       = $10,
                updated_at    = NOW()
          WHERE id = $11
          RETURNING ${SOURCE_COLUMNS}`,
        [
          input.title,
          input.body,
          JSON.stringify(input.metadata ?? {}),
          input.contextRole ?? 'supporting',
          input.priority ?? 0,
          input.status ?? 'active',
          input.canonical ?? false,
          input.includeInAi ?? true,
          input.contentHash,
          input.userId,
          row.id,
        ]
      )
      return { source: updated.rows[0], action: 'updated' }
    }

    const inserted = await pool.query(
      `INSERT INTO manuscript_context_sources (
         manuscript_id, user_id, source_type, source_id,
         title, body, metadata,
         context_role, priority, status, canonical, include_in_ai,
         content_hash
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7::jsonb,
         $8, $9, $10, $11, $12,
         $13
       )
       RETURNING ${SOURCE_COLUMNS}`,
      [
        input.manuscriptId,
        input.userId,
        input.sourceType,
        input.sourceId,
        input.title,
        input.body,
        JSON.stringify(input.metadata ?? {}),
        input.contextRole ?? 'supporting',
        input.priority ?? 0,
        input.status ?? 'active',
        input.canonical ?? false,
        input.includeInAi ?? true,
        input.contentHash,
      ]
    )
    return { source: inserted.rows[0], action: 'created' }
  },

  async listSources(
    manuscriptId: string,
    opts: { includeArchived?: boolean; sourceType?: ContextSourceType } = {}
  ): Promise<ManuscriptContextSource[]> {
    const where: string[] = ['manuscript_id = $1']
    const params: unknown[] = [manuscriptId]
    if (!opts.includeArchived) {
      where.push(`status NOT IN ('archived','rejected','superseded')`)
    }
    if (opts.sourceType) {
      params.push(opts.sourceType)
      where.push(`source_type = $${params.length}`)
    }
    const result = await pool.query(
      `SELECT ${SOURCE_COLUMNS}
         FROM manuscript_context_sources
        WHERE ${where.join(' AND ')}
        ORDER BY canonical DESC, priority DESC, updated_at DESC`,
      params
    )
    return result.rows
  },

  async findSourceById(id: string): Promise<ManuscriptContextSource | null> {
    const r = await pool.query(
      `SELECT ${SOURCE_COLUMNS} FROM manuscript_context_sources WHERE id = $1`,
      [id]
    )
    return r.rows[0] ?? null
  },

  async deleteSource(id: string): Promise<void> {
    await pool.query(`DELETE FROM manuscript_context_sources WHERE id = $1`, [id])
  },

  /**
   * Mark every source row whose origin row no longer exists as superseded
   * (rather than deleting). The retrieval layer excludes superseded rows
   * by default; explicit reindexing can later re-promote them if the
   * upstream record returns. Pass an array of (sourceType, sourceId)
   * pairs that the compiler decided ARE current — anything else for the
   * given manuscript transitions to 'superseded'.
   */
  async markStaleAsSuperseded(
    manuscriptId: string,
    keepers: { sourceType: ContextSourceType; sourceId: string | null }[]
  ): Promise<string[]> {
    // Build a (type, id) list of keepers. Postgres arrays don't natively
    // express tuples, so we serialise into two parallel arrays and
    // EXCEPT-style filter.
    const types = keepers.map(k => k.sourceType)
    const ids = keepers.map(k => k.sourceId ?? null)

    const result = await pool.query(
      `WITH keepers AS (
         SELECT UNNEST($2::text[])  AS source_type,
                UNNEST($3::uuid[])  AS source_id
       )
       UPDATE manuscript_context_sources s
          SET status = 'superseded', updated_at = NOW()
        WHERE s.manuscript_id = $1
          AND s.status NOT IN ('superseded','rejected','archived')
          AND NOT EXISTS (
            SELECT 1 FROM keepers k
             WHERE k.source_type = s.source_type
               AND (k.source_id IS NOT DISTINCT FROM s.source_id)
          )
        RETURNING s.id`,
      [manuscriptId, types, ids]
    )
    return result.rows.map(r => r.id as string)
  },

  /* ============================================================
   *  Chunks
   * ============================================================ */

  async deleteChunksBySource(contextSourceId: string): Promise<void> {
    await pool.query(
      `DELETE FROM context_chunks WHERE context_source_id = $1`,
      [contextSourceId]
    )
  },

  async insertChunks(rows: InsertChunkInput[]): Promise<ContextChunk[]> {
    if (rows.length === 0) return []
    const out: ContextChunk[] = []
    // Single-row inserts in a transaction are fine for the chunk volumes
    // a single source produces (target ~10 chunks of ~700 tokens each).
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const r of rows) {
        const result = await client.query(
          `INSERT INTO context_chunks (
             manuscript_id, context_source_id, chunk_index,
             text, token_count, metadata, content_hash
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
           RETURNING ${CHUNK_COLUMNS}`,
          [
            r.manuscriptId,
            r.contextSourceId,
            r.chunkIndex,
            r.text,
            r.tokenCount,
            JSON.stringify(r.metadata ?? {}),
            r.contentHash,
          ]
        )
        out.push(result.rows[0])
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    return out
  },

  async listChunks(manuscriptId: string): Promise<ContextChunk[]> {
    const r = await pool.query(
      `SELECT ${CHUNK_COLUMNS} FROM context_chunks
        WHERE manuscript_id = $1
        ORDER BY context_source_id, chunk_index`,
      [manuscriptId]
    )
    return r.rows
  },

  async listChunksBySource(contextSourceId: string): Promise<ContextChunk[]> {
    const r = await pool.query(
      `SELECT ${CHUNK_COLUMNS} FROM context_chunks
        WHERE context_source_id = $1
        ORDER BY chunk_index`,
      [contextSourceId]
    )
    return r.rows
  },

  /** All chunks that have NO embedding for the given model. */
  async listUnembeddedChunks(manuscriptId: string, embeddingModel: string): Promise<ContextChunk[]> {
    const r = await pool.query(
      `SELECT ${CHUNK_COLUMNS}
         FROM context_chunks c
        WHERE c.manuscript_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM context_embeddings e
             WHERE e.chunk_id = c.id AND e.embedding_model = $2
          )
        ORDER BY c.context_source_id, c.chunk_index`,
      [manuscriptId, embeddingModel]
    )
    return r.rows
  },

  /* ============================================================
   *  Embeddings
   * ============================================================ */

  async upsertEmbedding(
    manuscriptId: string,
    chunkId: string,
    embedding: number[],
    embeddingModel: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO context_embeddings (manuscript_id, chunk_id, embedding, embedding_model)
       VALUES ($1, $2, $3::vector, $4)
       ON CONFLICT (chunk_id, embedding_model) DO UPDATE
         SET embedding = EXCLUDED.embedding,
             manuscript_id = EXCLUDED.manuscript_id,
             created_at = NOW()`,
      [manuscriptId, chunkId, vectorLiteral(embedding), embeddingModel]
    )
  },

  /**
   * Vector search inside a single manuscript. Returns the top-K nearest
   * chunks under cosine distance, joined to their source so the caller
   * gets title/role/status/canonical/priority in one round-trip.
   *
   * The manuscript_id filter lives in the same WHERE clause as the
   * vector op; pgvector's IVFFlat index respects equality predicates
   * during search, so this is both correct AND fast.
   */
  async searchByVector(opts: VectorSearchOptions): Promise<VectorSearchHit[]> {
    const where: string[] = [
      'c.manuscript_id = $1',
      'e.embedding_model = $2',
      's.include_in_ai = TRUE',
    ]
    const params: unknown[] = [opts.manuscriptId, opts.embeddingModel]
    let i = params.length

    if (opts.sourceTypes && opts.sourceTypes.length > 0) {
      params.push(opts.sourceTypes)
      i = params.length
      where.push(`s.source_type = ANY($${i}::text[])`)
    }
    if (opts.contextRoles && opts.contextRoles.length > 0) {
      params.push(opts.contextRoles)
      i = params.length
      where.push(`s.context_role = ANY($${i}::text[])`)
    }
    if (opts.includeArchived) {
      // No status filter at all.
    } else if (opts.status && opts.status.length > 0) {
      params.push(opts.status)
      i = params.length
      where.push(`s.status = ANY($${i}::text[])`)
    } else {
      where.push(`s.status IN ('active','accepted','draft')`)
    }

    params.push(vectorLiteral(opts.embedding))
    const vecParam = `$${params.length}::vector`
    params.push(opts.topK)
    const limitParam = `$${params.length}`

    const sql = `
      SELECT
        c.id                  AS "chunkId",
        c.context_source_id   AS "contextSourceId",
        c.manuscript_id       AS "manuscriptId",
        c.text,
        c.token_count         AS "tokenCount",
        c.metadata            AS "chunkMetadata",
        s.title,
        s.source_type         AS "sourceType",
        s.context_role        AS "contextRole",
        s.status,
        s.canonical,
        s.priority,
        s.metadata            AS "sourceMetadata",
        (e.embedding <=> ${vecParam}) AS distance
      FROM context_embeddings e
      JOIN context_chunks c             ON c.id = e.chunk_id
      JOIN manuscript_context_sources s ON s.id = c.context_source_id
      WHERE ${where.join(' AND ')}
      ORDER BY e.embedding <=> ${vecParam}
      LIMIT ${limitParam}
    `
    const r = await pool.query(sql, params)
    return r.rows as VectorSearchHit[]
  },

  /* ============================================================
   *  Stats / housekeeping
   * ============================================================ */

  async stats(manuscriptId: string): Promise<{ sources: number; chunks: number; embeddings: number }> {
    const r = await pool.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM manuscript_context_sources WHERE manuscript_id = $1) AS sources,
        (SELECT COUNT(*)::int FROM context_chunks            WHERE manuscript_id = $1) AS chunks,
        (SELECT COUNT(*)::int FROM context_embeddings        WHERE manuscript_id = $1) AS embeddings
      `,
      [manuscriptId]
    )
    return r.rows[0] as { sources: number; chunks: number; embeddings: number }
  },
}
