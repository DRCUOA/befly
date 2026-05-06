/**
 * AI exchange repository.
 *
 * Persists every chatJson round-trip the OpenAI client makes so an admin can
 * inspect the actual on-the-wire request/response. This is a temporary
 * diagnostic surface — see migration 019 for context.
 *
 * The `record()` write is intentionally tolerant: if it fails for any reason
 * (DB hiccup, schema drift) it must NOT break the assist call that triggered
 * it. The caller is expected to await this safely; downstream code paths
 * never read this table in a request-critical way.
 */
import { pool } from '../config/db.js'
import { logger } from '../utils/logger.js'
import type {
  AiExchange,
  AiExchangeListFilter,
  CreateAiExchangeParams,
} from '../models/AiExchange.js'

/* Hard caps so a runaway model response can't blow up the row size or
 * choke the admin UI. The provider raw body is by far the biggest field
 * in practice — gpt-5 reasoning models can return tens of KB. We keep
 * both sides bounded so a single weird response never fills the table. */
const MAX_PROMPT_CHARS         = 200_000   // system + user combined budget
const MAX_RESPONSE_RAW_CHARS   = 200_000
const MAX_ERROR_MESSAGE_CHARS  = 4_000

const COLUMNS = `
  id,
  user_id            AS "userId",
  feature,
  mode,
  resource_type      AS "resourceType",
  resource_id        AS "resourceId",
  manuscript_id      AS "manuscriptId",
  provider,
  model,
  temperature,
  max_output_tokens  AS "maxOutputTokens",
  system_prompt      AS "systemPrompt",
  user_prompt        AS "userPrompt",
  request_chars      AS "requestChars",
  status,
  http_status        AS "httpStatus",
  response_raw       AS "responseRaw",
  response_json      AS "responseJson",
  response_chars     AS "responseChars",
  prompt_tokens      AS "promptTokens",
  completion_tokens  AS "completionTokens",
  total_tokens       AS "totalTokens",
  duration_ms        AS "durationMs",
  error_message      AS "errorMessage",
  created_at         AS "createdAt"
`

function clip(s: string | null | undefined, max: number): string | null {
  if (s == null) return null
  if (s.length <= max) return s
  return s.slice(0, max) + `\n…[truncated, original ${s.length} chars]`
}

function rowToAiExchange(row: Record<string, unknown>): AiExchange {
  return {
    id: row.id as string,
    userId: (row.userId as string | null) ?? null,
    feature: row.feature as string,
    mode: (row.mode as string | null) ?? null,
    resourceType: (row.resourceType as string | null) ?? null,
    resourceId: (row.resourceId as string | null) ?? null,
    manuscriptId: (row.manuscriptId as string | null) ?? null,
    provider: row.provider as string,
    model: row.model as string,
    temperature: row.temperature == null ? null : Number(row.temperature),
    maxOutputTokens: (row.maxOutputTokens as number | null) ?? null,
    systemPrompt: (row.systemPrompt as string | null) ?? '',
    userPrompt: (row.userPrompt as string | null) ?? '',
    requestChars: Number(row.requestChars ?? 0),
    status: row.status as AiExchange['status'],
    httpStatus: (row.httpStatus as number | null) ?? null,
    responseRaw: (row.responseRaw as string | null) ?? null,
    responseJson: row.responseJson ?? null,
    responseChars: Number(row.responseChars ?? 0),
    promptTokens: (row.promptTokens as number | null) ?? null,
    completionTokens: (row.completionTokens as number | null) ?? null,
    totalTokens: (row.totalTokens as number | null) ?? null,
    durationMs: Number(row.durationMs ?? 0),
    errorMessage: (row.errorMessage as string | null) ?? null,
    createdAt: row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : (row.createdAt as string),
  }
}

export const aiExchangeRepo = {
  /**
   * Insert a single exchange row. Errors are logged but never thrown — the
   * primary call path (the assist service) must not fail because the
   * diagnostic write failed.
   */
  async record(params: CreateAiExchangeParams): Promise<AiExchange | null> {
    try {
      const systemPrompt   = clip(params.systemPrompt,   MAX_PROMPT_CHARS) ?? ''
      const userPrompt     = clip(params.userPrompt,     MAX_PROMPT_CHARS) ?? ''
      const responseRaw    = clip(params.responseRaw,    MAX_RESPONSE_RAW_CHARS)
      const errorMessage   = clip(params.errorMessage,   MAX_ERROR_MESSAGE_CHARS)
      const requestChars   = (params.systemPrompt?.length ?? 0) + (params.userPrompt?.length ?? 0)
      const responseChars  = params.responseRaw?.length ?? 0

      // Default manuscriptId from resource_type='manuscript' so any older
      // call site that hasn't been updated still gets a usable manuscript_id
      // on the row. New call sites set manuscriptId explicitly.
      const manuscriptId = params.manuscriptId
        ?? (params.resourceType === 'manuscript' ? params.resourceId : null)
        ?? null

      const result = await pool.query(
        `
        INSERT INTO ai_exchanges (
          user_id,
          feature,
          mode,
          resource_type,
          resource_id,
          manuscript_id,
          provider,
          model,
          temperature,
          max_output_tokens,
          system_prompt,
          user_prompt,
          request_chars,
          status,
          http_status,
          response_raw,
          response_json,
          response_chars,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          duration_ms,
          error_message
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,
          $11,$12,$13,
          $14,$15,$16,$17,$18,
          $19,$20,$21,
          $22,$23
        )
        RETURNING ${COLUMNS}
        `,
        [
          params.userId ?? null,
          params.feature,
          params.mode ?? null,
          params.resourceType ?? null,
          params.resourceId ?? null,
          manuscriptId,
          params.provider ?? 'openai',
          params.model,
          params.temperature ?? null,
          params.maxOutputTokens ?? null,
          systemPrompt,
          userPrompt,
          requestChars,
          params.status,
          params.httpStatus ?? null,
          responseRaw,
          params.responseJson != null ? JSON.stringify(params.responseJson) : null,
          responseChars,
          params.promptTokens ?? null,
          params.completionTokens ?? null,
          params.totalTokens ?? null,
          params.durationMs,
          errorMessage,
        ]
      )
      return rowToAiExchange(result.rows[0])
    } catch (err) {
      logger.warn('[ai-exchange] failed to persist row', {
        message: err instanceof Error ? err.message : String(err),
        feature: params.feature,
        model: params.model,
      })
      return null
    }
  },

  /**
   * Recent exchanges for the admin diagnostic view. The list is intentionally
   * the full row shape (including prompts + raw response) because the whole
   * point is to inspect the on-the-wire payloads — paginate aggressively.
   */
  async list(
    filter: AiExchangeListFilter = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<AiExchange[]> {
    const where: string[] = []
    const params: unknown[] = []
    if (filter.feature) {
      params.push(filter.feature)
      where.push(`feature = $${params.length}`)
    }
    if (filter.status) {
      params.push(filter.status)
      where.push(`status = $${params.length}`)
    }
    if (filter.userId) {
      params.push(filter.userId)
      where.push(`user_id = $${params.length}`)
    }
    if (filter.resourceId) {
      params.push(filter.resourceId)
      where.push(`resource_id = $${params.length}`)
    }
    if (filter.manuscriptId) {
      params.push(filter.manuscriptId)
      where.push(`manuscript_id = $${params.length}`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    params.push(limit)
    const limitParam = `$${params.length}`
    params.push(offset)
    const offsetParam = `$${params.length}`

    const result = await pool.query(
      `
      SELECT ${COLUMNS}
      FROM ai_exchanges
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
      `,
      params
    )
    return result.rows.map(rowToAiExchange)
  },

  async count(filter: AiExchangeListFilter = {}): Promise<number> {
    const where: string[] = []
    const params: unknown[] = []
    if (filter.feature) {
      params.push(filter.feature)
      where.push(`feature = $${params.length}`)
    }
    if (filter.status) {
      params.push(filter.status)
      where.push(`status = $${params.length}`)
    }
    if (filter.userId) {
      params.push(filter.userId)
      where.push(`user_id = $${params.length}`)
    }
    if (filter.resourceId) {
      params.push(filter.resourceId)
      where.push(`resource_id = $${params.length}`)
    }
    if (filter.manuscriptId) {
      params.push(filter.manuscriptId)
      where.push(`manuscript_id = $${params.length}`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_exchanges ${whereSql}`,
      params
    )
    return Number(result.rows[0].count)
  },
}
