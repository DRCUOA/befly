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

export interface LlmClient {
  /**
   * Send a chat completion request that must return parseable JSON.
   * Implementations MUST throw if the model returns a non-JSON body, so the
   * service layer never has to defend against malformed strings.
   */
  chatJson(req: LlmJsonRequest): Promise<LlmJsonResponse>
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
