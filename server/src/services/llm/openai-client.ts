/**
 * OpenAI implementation of the LlmClient interface.
 *
 * Uses the Chat Completions API directly via fetch (no SDK dependency). The
 * surface here is deliberately tiny: we only need JSON-mode chat for the
 * assist modes.
 *
 * Safety guard: getOpenAIClient() throws LlmConfigurationError if
 * OPENAI_API_KEY is not set in the environment, so a misconfigured deploy
 * fails loudly at the route boundary instead of silently producing nonsense.
 *
 * IMPORTANT: This module makes outbound HTTP calls when invoked. It must
 * never be reached during automated tests - tests inject a fake LlmClient
 * via the assist service's setLlmClient hook.
 */
import {
  LlmClient,
  LlmJsonRequest,
  LlmJsonResponse,
  LlmConfigurationError,
  LlmRequestError,
} from './llm-client.js'
import { logger } from '../../utils/logger.js'

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_TEMPERATURE = 0.4
const DEFAULT_MAX_TOKENS = 1500
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

/**
 * True if the model id belongs to OpenAI's reasoning families. Those
 * have a different parameter contract (no custom temperature/top_p,
 * uses `reasoning_effort` instead). See the comment block in
 * `chatJson` for details. Heuristic — not exhaustive — extend when
 * new families ship.
 *
 * Matched: gpt-5*, o1*, o3*, o4*  (case-insensitive).
 * Not matched: gpt-4o*, gpt-4.1*, gpt-4-turbo*, gpt-3.5*.
 */
function isReasoningModel(model: string): boolean {
  const m = model.trim().toLowerCase()
  if (m.startsWith('gpt-5')) return true
  // o-series — single letter 'o' followed by a single digit and either
  // end-of-string or a non-letter separator. Avoids false positives
  // like `oasis-foo` or models that happen to start with 'o'.
  return /^o[1-9](?:[-.]|$)/.test(m)
}

interface OpenAIConfig {
  apiKey: string
  defaultModel: string
}

function readConfig(): OpenAIConfig {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    throw new LlmConfigurationError(
      'OPENAI_API_KEY is not set. AI assist is unavailable until the key is configured.'
    )
  }
  const defaultModel = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  return { apiKey, defaultModel }
}

class OpenAIClient implements LlmClient {
  constructor(private config: OpenAIConfig) {}

  async chatJson(req: LlmJsonRequest): Promise<LlmJsonResponse> {
    const model = req.model || this.config.defaultModel
    /* ---- OpenAI parameter compatibility, as of April 2026 ----
     *
     * The Chat Completions API has split into two parameter shapes
     * over the past 12 months. We branch by model family so callers
     * (writing-assist, manuscript-assist) don't have to know which
     * model accepts which knob.
     *
     * Reasoning models (gpt-5.*, o1*, o3*, o4*):
     *   - `temperature` is LOCKED to 1. Sending any other value returns
     *     400 "Unsupported value: 'temperature' does not support 0.5
     *     with this model. Only the default (1) value is supported."
     *   - `top_p` is similarly locked.
     *   - `max_completion_tokens` covers BOTH visible output AND
     *     internal reasoning tokens — budget generously.
     *   - Output shaping uses `reasoning_effort` ('minimal'|'low'|
     *     'medium'|'high') instead of temperature. Lower effort = less
     *     internal thinking = faster + cheaper. For short assist
     *     responses we use 'low'.
     *   - `response_format: json_object` is supported on gpt-5.*; the
     *     o-series only supports `json_schema` (not used here).
     *
     * Chat models (gpt-4o*, gpt-4.1*, gpt-4-turbo, gpt-3.5*):
     *   - Accept `temperature` (0–2), `top_p`, `max_completion_tokens`.
     *   - The legacy `max_tokens` name is rejected by gpt-4o family
     *     since the late-2024 deprecation; `max_completion_tokens` is
     *     the only safe choice.
     *
     * Heuristic for `isReasoningModel`: any id whose alpha-then-digit
     * prefix is `gpt-5`, `o1`, `o3`, or `o4`. Adjust this when OpenAI
     * ships a new family. False positives risk passing the wrong
     * shape; false negatives risk a 400 like the one that drove this
     * branching in the first place.
     */
    const reasoning = isReasoningModel(model)

    const body: Record<string, unknown> = {
      model,
      response_format: { type: 'json_object' as const },
      max_completion_tokens: req.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system' as const, content: req.system },
        { role: 'user' as const,   content: req.user },
      ],
    }

    if (reasoning) {
      // Reasoning models — caller's `req.temperature` is intentionally
      // ignored (the API would reject it). We default to 'low' effort
      // because writing-assist tasks (proofread, focus, etc.) don't
      // need deep chains of thought; this keeps latency and cost down.
      body.reasoning_effort = 'low'
    } else {
      body.temperature = req.temperature ?? DEFAULT_TEMPERATURE
    }

    logger.debug('[openai] outbound request', {
      model,
      modelFamily: reasoning ? 'reasoning' : 'chat',
      temperature: reasoning ? '(omitted — locked to 1)' : body.temperature,
      reasoning_effort: reasoning ? body.reasoning_effort : undefined,
      max_completion_tokens: body.max_completion_tokens,
      systemChars: req.system.length,
      userChars: req.user.length,
    })

    const sentAt = Date.now()
    let response: Response
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (networkErr) {
      logger.error('[openai] network error', {
        model,
        ms: Date.now() - sentAt,
        message: networkErr instanceof Error ? networkErr.message : String(networkErr),
      })
      throw new LlmRequestError(
        `OpenAI request failed: ${networkErr instanceof Error ? networkErr.message : 'network error'}`
      )
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      logger.error('[openai] non-2xx response', {
        model,
        status: response.status,
        ms: Date.now() - sentAt,
        // Truncated server error so logs stay readable but the cause is visible.
        body: text.slice(0, 500),
      })
      throw new LlmRequestError(
        `OpenAI returned ${response.status}: ${text.slice(0, 500)}`,
        response.status
      )
    }

    const payload = await response.json() as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    const content = payload.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim() === '') {
      throw new LlmRequestError('OpenAI returned no message content')
    }

    let json: unknown
    try {
      json = JSON.parse(content)
    } catch (parseErr) {
      logger.error('[openai] non-JSON content despite json_object mode', {
        model,
        ms: Date.now() - sentAt,
        contentSnippet: content.slice(0, 200),
      })
      throw new LlmRequestError(
        `OpenAI returned non-JSON content despite json_object mode: ${content.slice(0, 200)}`
      )
    }

    logger.debug('[openai] response parsed', {
      model,
      ms: Date.now() - sentAt,
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens,
      contentChars: content.length,
    })

    return {
      json,
      model,
      usage: payload.usage && {
        promptTokens: payload.usage.prompt_tokens,
        completionTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens,
      },
    }
  }
}

let cachedClient: LlmClient | null = null

/**
 * Lazily construct the production OpenAI client. Throws
 * LlmConfigurationError if the env isn't set up - that's surfaced to the
 * user as a clean "AI not configured" error rather than a 500.
 */
export function getOpenAIClient(): LlmClient {
  if (!cachedClient) {
    cachedClient = new OpenAIClient(readConfig())
  }
  return cachedClient
}

/** For tests: clear the cached client so a re-read of env is forced. */
export function resetOpenAIClientForTests(): void {
  cachedClient = null
}
