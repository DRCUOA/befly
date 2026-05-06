/**
 * AiExchange model.
 *
 * One row per chatJson call from the app to the LLM provider — captures the
 * full request prompt, raw response body, parsed JSON (when present), tokens,
 * timing and provenance (user / feature / mode / resource).
 *
 * Temporary diagnostic surface so admins can see exactly what was sent and
 * what came back without grepping through info.log / error.log.
 */

export type AiExchangeStatus = 'ok' | 'error'

export interface AiExchange {
  id: string

  /** Provenance — who triggered the call, from where. */
  userId: string | null
  /** App surface that made the call: 'writing-assist' | 'manuscript-assist' | … */
  feature: string
  /** Per-feature sub-mode, e.g. 'coherence', 'proofread', 'gaps'. */
  mode: string | null
  /** Resource the call was about, e.g. 'writing_block' / 'manuscript'. */
  resourceType: string | null
  resourceId: string | null

  /**
   * The manuscript the AI exchange relates to, if any. Stored as a real FK
   * so the diagnostic log is queryable per-manuscript without parsing
   * resource_type/resource_id. NULL for feature surfaces that are not
   * manuscript-scoped (e.g. admin tooling).
   */
  manuscriptId: string | null

  /** Provider details. */
  provider: string
  model: string
  temperature: number | null
  maxOutputTokens: number | null

  /** Exact request payload at the AI <-> app layer. */
  systemPrompt: string
  userPrompt: string
  requestChars: number

  /** Outcome. */
  status: AiExchangeStatus
  httpStatus: number | null
  /** Raw response body string from the provider. May be truncated. */
  responseRaw: string | null
  /** Parsed JSON object on success; null on parse failure / non-2xx. */
  responseJson: unknown | null
  responseChars: number

  /** Provider-supplied token counts (nullable). */
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null

  /** Wall-clock duration of the round-trip. */
  durationMs: number
  /** Human-readable error message when status='error'. */
  errorMessage: string | null

  createdAt: string
}

export interface CreateAiExchangeParams {
  userId?: string | null
  feature: string
  mode?: string | null
  resourceType?: string | null
  resourceId?: string | null
  /** Optional explicit manuscript pointer — see AiExchange.manuscriptId. */
  manuscriptId?: string | null

  provider?: string
  model: string
  temperature?: number | null
  maxOutputTokens?: number | null

  systemPrompt: string
  userPrompt: string

  status: AiExchangeStatus
  httpStatus?: number | null
  responseRaw?: string | null
  responseJson?: unknown | null

  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null

  durationMs: number
  errorMessage?: string | null
}

export interface AiExchangeListFilter {
  feature?: string
  status?: AiExchangeStatus
  userId?: string
  resourceId?: string
  manuscriptId?: string
}
