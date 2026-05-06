/**
 * LLM client interface.
 *
 * The assist service depends only on this interface, not on any specific
 * provider. That gives us two things:
 *   1. Tests inject a fake implementation, so no test ever talks to OpenAI.
 *   2. Switching providers later (Anthropic, local model) is a one-file change.
 *
 * The single primitive is a JSON-mode chat call. Every assist mode produces
 * structured output (gap analyses, bridge suggestions, motif maps, etc.), so
 * forcing JSON mode at the client boundary keeps the upstream code free of
 * markdown/JSON parsing footguns.
 */

/**
 * Optional provenance attached to each chatJson call. The OpenAI client uses
 * this to persist a row in `ai_exchanges` so an admin can inspect the actual
 * payload that went out and what came back. Tests can omit it; production
 * call sites (writing-assist, manuscript-assist) populate every field they
 * have available.
 */
export interface LlmRequestContext {
  /** App surface that triggered the call, e.g. 'writing-assist'. */
  feature: string
  /** Per-feature mode/op, e.g. 'coherence' / 'gaps'. */
  mode?: string | null
  /** Authenticated user that initiated the call. */
  userId?: string | null
  /** Resource the call is about (e.g. writing_block id, manuscript id). */
  resourceType?: string | null
  resourceId?: string | null
  /**
   * Manuscript whose context the call relates to. Set this on every
   * manuscript-scoped feature surface (manuscript-assist, writing-assist
   * when the writing block belongs to a manuscript, story-craft, etc.) so
   * the diagnostic log and any future per-manuscript audit can find the
   * row without resolving resourceType/resourceId.
   */
  manuscriptId?: string | null
}

export interface LlmJsonRequest {
  /** Concrete model name passed through to the provider (e.g. 'gpt-4o-mini'). */
  model: string
  /** System prompt - sets the assistant's role and rules. */
  system: string
  /** User prompt - the task plus the grounded source material. */
  user: string
  /** Optional temperature override. Default low for structured output. */
  temperature?: number
  /** Hard ceiling on output tokens to bound cost. */
  maxOutputTokens?: number
  /** Optional diagnostic context — see LlmRequestContext. */
  context?: LlmRequestContext
}

export interface LlmJsonResponse {
  /** Parsed JSON object from the model's output. */
  json: unknown
  /** Raw model name that produced this response, for provenance. */
  model: string
  /**
   * Token counts when the provider exposes them. Useful for cost telemetry
   * and rate-limit decisions; never required for correctness.
   */
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

/**
 * Free-form chat request. Same provenance + model knobs as `LlmJsonRequest`,
 * but we send a list of role-tagged messages (so the chat service can pass
 * a multi-turn conversation history) and we DO NOT force JSON mode — the
 * answer is markdown the user reads directly.
 */
export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmChatRequest {
  model: string
  messages: LlmChatMessage[]
  temperature?: number
  maxOutputTokens?: number
  context?: LlmRequestContext
}

export interface LlmChatResponse {
  /** Plain markdown content from the model. */
  content: string
  model: string
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  /**
   * The ai_exchanges row id that captured this exchange, if the implementation
   * persisted one. Lets the chat service link a stored message back to the
   * full prompt + raw response in the diagnostic log.
   */
  exchangeId?: string | null
}

export interface LlmClient {
  /**
   * Send a chat completion request that must return parseable JSON.
   * Implementations MUST throw if the model returns a non-JSON body, so the
   * service layer never has to defend against malformed strings.
   */
  chatJson(req: LlmJsonRequest): Promise<LlmJsonResponse>

  /**
   * Send a multi-turn chat completion request and return the markdown
   * content the model produced. Used by the manuscript chat surface —
   * other AI features stick to chatJson because they consume structured
   * fields downstream.
   */
  chatText(req: LlmChatRequest): Promise<LlmChatResponse>
}

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmConfigurationError'
  }
}

export class LlmRequestError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'LlmRequestError'
  }
}
