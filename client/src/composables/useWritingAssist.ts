/**
 * useWritingAssist — wraps POST /writing/:id/assist for the editor toolset.
 *
 * One method per mode (coherence, define, focus, expand, proofread). Each
 * returns the WritingAssistResponse and, importantly, also stamps the
 * composable's reactive state so the panel can watch a single source of
 * truth for what to render. State is intentionally singleton-per-call:
 * starting a new assist clears the previous result.
 *
 * Errors surface via the `error` ref and are also rejected from the
 * returned promise so callers can choose how to react. The 503
 * "AI not configured" case is detected by message and shown as a special
 * 'unconfigured' state so the UI can offer a friendlier message than a
 * generic error.
 */

import { shallowRef, computed } from 'vue'
import { api } from '../api/client'
import type {
  WritingAssistMode,
  WritingAssistRequest,
  WritingAssistResponse,
  WritingAssistCoherenceArgs,
  WritingAssistDefineArgs,
  WritingAssistFocusArgs,
  WritingAssistExpandArgs,
  WritingAssistProofreadArgs,
  WritingAssistFactCheckArgs,
  WritingAssistFictionBreadthArgs,
  WritingAssistFictionDepthArgs,
  WritingAssistNonfictionBreadthArgs,
  WritingAssistNonfictionDepthArgs,
} from '@shared/WritingAssist'
import type { ApiResponse } from '@shared/ApiResponses'

export type AssistStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; mode: WritingAssistMode }
  | { kind: 'ready'; mode: WritingAssistMode; response: WritingAssistResponse }
  | { kind: 'error'; mode: WritingAssistMode; message: string; unconfigured: boolean }

export function useWritingAssist(
  writingId: () => string | null,
  /**
   * Optional getter for the writer's chosen model. Returns one of the
   * allow-listed model ids (e.g. 'gpt-5.5'), or null/undefined to let
   * the server use its default. Read fresh on every request so the
   * cluster's selector is honoured immediately.
   */
  modelGetter?: () => string | null | undefined,
) {
  const status = shallowRef<AssistStatus>({ kind: 'idle' })

  // Convenience flags for templates
  const isLoading = computed(() => status.value.kind === 'loading')
  const isReady = computed(() => status.value.kind === 'ready')
  const isError = computed(() => status.value.kind === 'error')

  const response = computed<WritingAssistResponse | null>(() =>
    status.value.kind === 'ready' ? status.value.response : null
  )
  const errorMessage = computed<string | null>(() =>
    status.value.kind === 'error' ? status.value.message : null
  )
  const unconfigured = computed<boolean>(() =>
    status.value.kind === 'error' && status.value.unconfigured
  )

  function clear(): void {
    status.value = { kind: 'idle' }
  }

  /** Internal — sends the request, manages reactive state, returns the response. */
  async function run(request: WritingAssistRequest): Promise<WritingAssistResponse> {
    const id = writingId()
    if (!id) {
      const message = 'Cannot run assist before the frag has been saved.'
      console.warn('[writing-assist] skipped — no writingId yet', { mode: request.mode })
      status.value = { kind: 'error', mode: request.mode, message, unconfigured: false }
      throw new Error(message)
    }

    // Snapshot what we're about to send. Args themselves are short (a
    // question, a term, or a selection capped at 4k chars) so logging
    // them verbatim is fine and far more useful than logging shapes.
    const argsPreview = previewArgs(request)
    console.log('[writing-assist] firing', {
      mode: request.mode,
      writingId: id,
      args: argsPreview,
    })

    status.value = { kind: 'loading', mode: request.mode }
    const startedAt = performance.now()

    try {
      // Include the writer's chosen model when one is set; server falls
      // back to its default if absent or not in the allow-list.
      const model = modelGetter?.() ?? null
      const body: Record<string, unknown> = { mode: request.mode, args: request.args }
      if (model) body.model = model

      const wrapped = await api.post<ApiResponse<WritingAssistResponse>>(
        `/writing/${id}/assist`,
        body
      )
      // The server unwraps to { data: WritingAssistResponse }; api.post returns
      // the raw envelope so we extract here.
      const result = wrapped.data
      const ms = Math.round(performance.now() - startedAt)
      console.log('[writing-assist] ok', {
        mode: request.mode,
        ms,
        model: result.model,
        bodyChars: result.body?.length ?? 0,
        hasReplacement: !!result.replacement,
      })
      status.value = { kind: 'ready', mode: request.mode, response: result }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed'
      // Heuristic: the server returns 503 with a config-specific message
      // when OPENAI_API_KEY is missing. The fetch wrapper turns that into
      // a thrown Error whose message starts with the server's text.
      const unconfigured = /OPENAI_API_KEY|AI assist is unavailable/i.test(message)
      const ms = Math.round(performance.now() - startedAt)
      console.error('[writing-assist] failed', {
        mode: request.mode,
        ms,
        unconfigured,
        message,
      })
      status.value = { kind: 'error', mode: request.mode, message, unconfigured }
      throw err
    }
  }

  /**
   * Build a small, safe-to-log preview of a request's args. Truncates long
   * fields so the console doesn't get flooded if a writer attached a huge
   * selection.
   */
  function previewArgs(request: WritingAssistRequest): Record<string, unknown> {
    const cap = (s: string | undefined, n: number): string | undefined =>
      s == null ? s : s.length > n ? `${s.slice(0, n)}…(+${s.length - n} chars)` : s
    switch (request.mode) {
      case 'coherence':
        return {
          question: cap(request.args.question, 200),
          selectionChars: request.args.selection?.length ?? 0,
        }
      case 'define':
        return {
          term: request.args.term,
          contextChars: request.args.contextSnippet?.length ?? 0,
        }
      case 'focus':
        return { selectionChars: request.args.selection?.length ?? 0 }
      case 'expand':
        return {
          target: request.args.target,
          selectionChars: request.args.selection?.length ?? 0,
        }
      case 'proofread':
        return { selectionChars: request.args.selection?.length ?? 0 }
      case 'factcheck':
        return { selectionChars: request.args.selection?.length ?? 0 }
      // Develop quadrant — same shape as expand, log it the same way so
      // the four modes are visually consistent in the console.
      case 'fiction-breadth':
      case 'fiction-depth':
      case 'nonfiction-breadth':
      case 'nonfiction-depth':
        return {
          target: request.args.target,
          selectionChars: request.args.selection?.length ?? 0,
        }
    }
  }

  /* ----- Per-mode wrappers — narrow types at the call-site ----- */

  function coherence(args: WritingAssistCoherenceArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'coherence', args })
  }

  function define(args: WritingAssistDefineArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'define', args })
  }

  function focus(args: WritingAssistFocusArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'focus', args })
  }

  function expand(args: WritingAssistExpandArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'expand', args })
  }

  function proofread(args: WritingAssistProofreadArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'proofread', args })
  }

  function factCheck(args: WritingAssistFactCheckArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'factcheck', args })
  }

  /* ----- Develop quadrant ----- four sister wrappers, one per mode.
   * Same shape as `expand` from the call-site's perspective; the
   * difference is which prompt the server runs.
   */

  function fictionBreadth(args: WritingAssistFictionBreadthArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'fiction-breadth', args })
  }

  function fictionDepth(args: WritingAssistFictionDepthArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'fiction-depth', args })
  }

  function nonfictionBreadth(args: WritingAssistNonfictionBreadthArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'nonfiction-breadth', args })
  }

  function nonfictionDepth(args: WritingAssistNonfictionDepthArgs): Promise<WritingAssistResponse> {
    return run({ mode: 'nonfiction-depth', args })
  }

  return {
    // state
    status,
    isLoading,
    isReady,
    isError,
    response,
    errorMessage,
    unconfigured,
    // actions
    coherence,
    define,
    focus,
    expand,
    proofread,
    factCheck,
    // Develop quadrant
    fictionBreadth,
    fictionDepth,
    nonfictionBreadth,
    nonfictionDepth,
    clear,
  }
}

export type UseWritingAssist = ReturnType<typeof useWritingAssist>
