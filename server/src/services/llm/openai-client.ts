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

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_TEMPERATURE = 0.4
const DEFAULT_MAX_TOKENS = 1500
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

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
    const body = {
      model,
      response_format: { type: 'json_object' as const },
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system' as const, content: req.system },
        { role: 'user' as const,   content: req.user },
      ],
    }

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
      throw new LlmRequestError(
        `OpenAI request failed: ${networkErr instanceof Error ? networkErr.message : 'network error'}`
      )
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
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
      throw new LlmRequestError(
        `OpenAI returned non-JSON content despite json_object mode: ${content.slice(0, 200)}`
      )
    }

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
