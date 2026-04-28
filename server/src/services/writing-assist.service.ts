/**
 * Writing-assist service — orchestrates the essay-level AI assist modes.
 *
 * Sister to manuscript-assist.service.ts but operates on a single essay
 * (writing block) rather than a manuscript spine. Ten modes:
 *
 *   coherence            — free-form Q&A about the essay (with sibling context if
 *                          the essay belongs to a manuscript)
 *   define               — dictionary-style definition for a word or phrase
 *   focus                — tighten a selection without losing meaning
 *   expand               — add substance without padding
 *   proofread            — light spelling/grammar that preserves voice
 *   factcheck            — flag checkable claims with confidence markers
 *   fiction-breadth      — "Broaden the canvas" — subplots, POVs, regions
 *   fiction-depth        — "Deepen the stakes" — interiority, sensory atmosphere
 *   nonfiction-breadth   — "Cast a wider net" — adjacent topics, broader inquiry
 *   nonfiction-depth     — "Drill down" — rigorous development of one point
 *
 * Results are ephemeral. Unlike gap_analysis, no artifact rows are
 * persisted — the writer either inserts the suggestion into their prose
 * or dismisses it. This keeps the assist flow fast and disposable.
 *
 * Design rules borrowed from manuscript-assist:
 *   1. Authorize via writingService.getById (throws NotFoundError /
 *      ForbiddenError exactly like other writing endpoints).
 *   2. Retrieval before generation — every mode pulls real material
 *      (essay body, sibling items, manuscript direction) before
 *      building the prompt.
 *   3. LlmClient is injectable for tests via setLlmClientForTests.
 */

import { writingService } from './writing.service.js'
import { manuscriptRepo } from '../repositories/manuscript.repo.js'
import { LlmClient, LlmConfigurationError } from './llm/llm-client.js'
import { getOpenAIClient } from './llm/openai-client.js'
import {
  WRITING_ASSIST_SYSTEM_PROMPT,
  buildCoherencePrompt,
  buildDefinePrompt,
  buildFocusPrompt,
  buildExpandPrompt,
  buildProofreadPrompt,
  buildFactCheckPrompt,
  buildFictionBreadthPrompt,
  buildFictionDepthPrompt,
  buildNonfictionBreadthPrompt,
  buildNonfictionDepthPrompt,
  trimBodyForPrompt,
  CoherenceSiblingItem,
} from './llm/prompts.js'
import { ValidationError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import type {
  WritingAssistRequest,
  WritingAssistResponse,
  WritingAssistMode,
} from '@shared/WritingAssist'

/* ----- LLM client injection (mirrors manuscript-assist) ----- */

let activeClient: LlmClient | null = null

/** Tests inject a fake LlmClient so the service never touches the network. */
export function setLlmClientForTests(client: LlmClient | null): void {
  activeClient = client
}

function client(): LlmClient {
  return activeClient ?? getOpenAIClient()
}

/* ----- Limits ----- */

const MAX_QUESTION_CHARS    = 1000
const MAX_TERM_CHARS        = 200
const MAX_CONTEXT_CHARS     = 2000
const MAX_SELECTION_CHARS   = 4000
const MAX_ESSAY_BODY_CHARS  = 8000   // for coherence — generous since we trim siblings hard
const MAX_SIBLINGS          = 12     // hard cap to bound token cost
const MAX_SIBLING_SUMMARY   = 240

/* ----- Response normalisation ----- */

interface RawAssistResponse {
  body?: unknown
  replacement?: unknown
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/**
 * Modes that never carry replacement prose. The model is instructed in
 * the prompt to return `replacement: null`; this guards against a model
 * that returns garbage replacement text for an advisory mode anyway.
 *
 * Everything NOT in this set is treated as transformative — i.e. the
 * UI will surface an Insert / Replace button whenever the model returns
 * a non-empty replacement string.
 */
const ADVISORY_MODES: ReadonlySet<WritingAssistMode> = new Set([
  'coherence',
  'define',
  'factcheck',
])

function normaliseAssistResponse(raw: unknown, mode: WritingAssistMode): { body: string; replacement: string | null } {
  const r = (raw && typeof raw === 'object') ? raw as RawAssistResponse : {}
  const body = asString(r.body, '').trim()
    || (mode === 'coherence'
        ? 'The model returned no answer.'
        : 'The model returned no suggestion.')

  if (ADVISORY_MODES.has(mode)) {
    return { body, replacement: null }
  }
  // Transformative modes — replacement is required to be a string. Fall
  // back to null if the model refused or omitted it; the UI will gate
  // the Insert/Replace button on its presence.
  const replacement = asString(r.replacement, '').trim()
  return { body, replacement: replacement || null }
}

/* ----- Develop-quadrant helpers (shared by the four sister modes) ----- */

interface DevelopArgsLike {
  selection?: string
  target: 'whole' | 'section'
}

/**
 * Validate + resolve the text the develop-quadrant model should grow.
 * Mirrors `expand`'s logic exactly so the four modes feel identical
 * from the caller's point of view: pick whole-essay vs. selection,
 * trim to budget, refuse if there's nothing to work with.
 */
function resolveDevelopText(mode: WritingAssistMode, args: DevelopArgsLike, essayBody: string | null): string {
  const target = args.target
  if (target !== 'whole' && target !== 'section') {
    throw new ValidationError(`${mode}: target must be 'whole' or 'section'`)
  }
  const selection = (args.selection ?? '').slice(0, MAX_SELECTION_CHARS)
  const text = target === 'whole'
    ? trimBodyForPrompt(essayBody, MAX_ESSAY_BODY_CHARS)
    : selection.trim()
  if (!text) {
    throw new ValidationError(
      target === 'section'
        ? `${mode}: selection is required when target=section`
        : `${mode}: essay body is empty`
    )
  }
  return text
}

/**
 * Temperature + token budget for the develop-quadrant. Same numbers
 * as `expand` for now — both are "make this longer with substance"
 * jobs and the same anti-padding rules apply. Centralised so a future
 * tuning pass changes one number, not four.
 */
function developDispatchKnobs(text: string): { temperature: number; maxOutputTokens: number } {
  return {
    temperature: 0.5,
    maxOutputTokens: Math.min(3000, Math.ceil(text.length * 1.5) + 600),
  }
}

/* ----- Public entrypoint ----- */

export interface RunWritingAssistInput {
  writingId: string
  request: WritingAssistRequest
  /**
   * Optional model override (e.g. 'gpt-5.5'). Falls back to OPENAI_MODEL
   * env var, then 'gpt-4o-mini', when not provided. The controller
   * validates this against an allow-list before passing it in.
   */
  model?: string
}

export const writingAssistService = {
  async run(
    input: RunWritingAssistInput,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<WritingAssistResponse> {
    logger.debug('[writing-assist] service.run start', {
      writingId: input.writingId,
      mode: input.request.mode,
      userId,
      isAdmin,
    })

    // 1. Authorize. Reusing writingService.getById means the caller sees
    //    exactly the same NotFound / Forbidden semantics as the regular
    //    writing endpoints — and we keep the access policy in one place.
    const writing = await writingService.getById(input.writingId, userId, isAdmin)
    logger.debug('[writing-assist] writing loaded', {
      writingId: writing.id,
      titleLen: writing.title?.length ?? 0,
      bodyLen: writing.body?.length ?? 0,
    })

    // 2. Refuse early if the LLM client isn't configured. We do this AFTER
    //    access checks but BEFORE building any prompt, so misconfigured
    //    deploys give a clean 5xx with a useful message at the front door.
    let llm: LlmClient
    try {
      llm = client()
    } catch (err) {
      if (err instanceof LlmConfigurationError) {
        logger.warn('[writing-assist] LLM client not configured', { message: err.message })
        throw err
      }
      throw err
    }

    // 3. Mode dispatch. Each branch validates its own args and builds a
    //    mode-specific prompt before a single shared chatJson call.
    const { request } = input
    let userPrompt: string
    let temperature: number | undefined
    let maxOutputTokens: number | undefined

    switch (request.mode) {
      case 'coherence': {
        const question = (request.args.question ?? '').trim()
        if (!question) throw new ValidationError('coherence: question is required')
        if (question.length > MAX_QUESTION_CHARS) {
          throw new ValidationError(`coherence: question exceeds ${MAX_QUESTION_CHARS} chars`)
        }
        const selection = (request.args.selection ?? '').slice(0, MAX_SELECTION_CHARS)

        // Optional manuscript context — sibling titles + short summaries,
        // plus literary direction. Falls back gracefully when this essay
        // isn't in any manuscript the user can read.
        const ctx = userId
          ? await manuscriptRepo.findContextForWriting(writing.id, userId, isAdmin)
          : null

        const siblings: CoherenceSiblingItem[] = (ctx?.siblings ?? [])
          .slice(0, MAX_SIBLINGS)
          .map(s => ({ title: s.title, summary: s.summary.slice(0, MAX_SIBLING_SUMMARY) }))

        const direction: string[] = []
        if (ctx?.manuscript) {
          const m = ctx.manuscript
          if (m.workingSubtitle)   direction.push(`Subtitle: ${m.workingSubtitle}`)
          if (m.centralQuestion)   direction.push(`Central question: ${m.centralQuestion}`)
          if (m.throughLine)       direction.push(`Through-line: ${m.throughLine}`)
          if (m.emotionalArc)      direction.push(`Emotional arc: ${m.emotionalArc}`)
          if (m.narrativePromise)  direction.push(`Narrative promise: ${m.narrativePromise}`)
          if (m.intendedReader)    direction.push(`Intended reader: ${m.intendedReader}`)
        }

        userPrompt = buildCoherencePrompt({
          essayTitle: writing.title,
          essayBody: trimBodyForPrompt(writing.body, MAX_ESSAY_BODY_CHARS),
          selection: selection || undefined,
          question,
          siblings,
          direction,
        })
        // Slightly higher temperature so coherence answers don't read as
        // template responses. Still bounded so the model stays grounded.
        temperature = 0.6
        maxOutputTokens = 1200
        break
      }

      case 'define': {
        const term = (request.args.term ?? '').trim()
        if (!term) throw new ValidationError('define: term is required')
        if (term.length > MAX_TERM_CHARS) {
          throw new ValidationError(`define: term exceeds ${MAX_TERM_CHARS} chars`)
        }
        const contextSnippet = (request.args.contextSnippet ?? '').slice(0, MAX_CONTEXT_CHARS)
        userPrompt = buildDefinePrompt({ term, contextSnippet: contextSnippet || undefined })
        // Definitions should be deterministic — keep temperature low.
        temperature = 0.2
        maxOutputTokens = 500
        break
      }

      case 'focus': {
        const selection = (request.args.selection ?? '').trim()
        if (!selection) throw new ValidationError('focus: selection is required')
        if (selection.length > MAX_SELECTION_CHARS) {
          throw new ValidationError(`focus: selection exceeds ${MAX_SELECTION_CHARS} chars`)
        }
        userPrompt = buildFocusPrompt({ selection })
        // Voice preservation is the priority — low temperature.
        temperature = 0.3
        maxOutputTokens = Math.min(2000, Math.ceil(selection.length / 2) + 500)
        break
      }

      case 'expand': {
        const target = request.args.target
        if (target !== 'whole' && target !== 'section') {
          throw new ValidationError(`expand: target must be 'whole' or 'section'`)
        }
        const selection = (request.args.selection ?? '').slice(0, MAX_SELECTION_CHARS)
        const text = target === 'whole'
          ? trimBodyForPrompt(writing.body, MAX_ESSAY_BODY_CHARS)
          : selection.trim()
        if (!text) {
          throw new ValidationError(
            target === 'section'
              ? 'expand: selection is required when target=section'
              : 'expand: essay body is empty'
          )
        }
        userPrompt = buildExpandPrompt({ text, target })
        // Slightly higher temperature than focus — we want the model to
        // find substance, not just rearrange words. Still bounded to keep
        // it inside the writer's voice.
        temperature = 0.5
        // Budget for ~50% growth on whole-essay; 2x on a small selection.
        maxOutputTokens = Math.min(3000, Math.ceil(text.length * 1.5) + 600)
        break
      }

      case 'proofread': {
        const selection = (request.args.selection ?? '').trim()
        const text = selection
          ? selection.slice(0, MAX_SELECTION_CHARS)
          : trimBodyForPrompt(writing.body, MAX_ESSAY_BODY_CHARS)
        if (!text) throw new ValidationError('proofread: nothing to check')
        userPrompt = buildProofreadPrompt({ text })
        // Lowest temperature — corrections must be objective.
        temperature = 0.1
        maxOutputTokens = Math.min(2500, Math.ceil(text.length / 2) + 500)
        break
      }

      case 'factcheck': {
        const selection = (request.args.selection ?? '').trim()
        const text = selection
          ? selection.slice(0, MAX_SELECTION_CHARS)
          : trimBodyForPrompt(writing.body, MAX_ESSAY_BODY_CHARS)
        if (!text) throw new ValidationError('factcheck: nothing to check')
        userPrompt = buildFactCheckPrompt({ text })
        // Low temperature — fact-check should be cautious + consistent.
        // The prompt itself biases toward "unable to verify" rather than
        // guessing, but lower temperature compounds that.
        temperature = 0.2
        // Generous budget — fact-check listings can be longer than the
        // input if there are many claims to discuss.
        maxOutputTokens = Math.min(2500, Math.ceil(text.length / 2) + 800)
        break
      }

      /* ---- Develop quadrant ----
       *
       * The four sister modes share `expand`'s arg shape, validation,
       * temperature, and token budget. Only the prompt builder changes.
       * `resolveDevelopText` collapses the shared validation; the per-
       * case body stays focused on which builder to call.
       */
      case 'fiction-breadth': {
        const text = resolveDevelopText(request.mode, request.args, writing.body)
        userPrompt = buildFictionBreadthPrompt({ text, target: request.args.target })
        ;({ temperature, maxOutputTokens } = developDispatchKnobs(text))
        break
      }
      case 'fiction-depth': {
        const text = resolveDevelopText(request.mode, request.args, writing.body)
        userPrompt = buildFictionDepthPrompt({ text, target: request.args.target })
        ;({ temperature, maxOutputTokens } = developDispatchKnobs(text))
        break
      }
      case 'nonfiction-breadth': {
        const text = resolveDevelopText(request.mode, request.args, writing.body)
        userPrompt = buildNonfictionBreadthPrompt({ text, target: request.args.target })
        ;({ temperature, maxOutputTokens } = developDispatchKnobs(text))
        break
      }
      case 'nonfiction-depth': {
        const text = resolveDevelopText(request.mode, request.args, writing.body)
        userPrompt = buildNonfictionDepthPrompt({ text, target: request.args.target })
        ;({ temperature, maxOutputTokens } = developDispatchKnobs(text))
        break
      }

      default: {
        // Exhaustive check — the discriminated union should never reach here.
        const _exhaustive: never = request
        throw new ValidationError(`Unsupported writing-assist mode: ${(_exhaustive as { mode?: string }).mode}`)
      }
    }

    // 4. Single shared chatJson call. Mode-specific args were already baked
    //    into the prompt above. Model precedence: explicit input → env var →
    //    'gpt-4o-mini' default.
    const model = input.model
      || process.env.OPENAI_MODEL?.trim()
      || 'gpt-4o-mini'
    logger.debug('[writing-assist] dispatching to LLM', {
      mode: request.mode,
      model,
      temperature,
      maxOutputTokens,
      systemChars: WRITING_ASSIST_SYSTEM_PROMPT.length,
      userPromptChars: userPrompt.length,
    })

    const llmStart = Date.now()
    const response = await llm.chatJson({
      model,
      system: WRITING_ASSIST_SYSTEM_PROMPT,
      user: userPrompt,
      temperature,
      maxOutputTokens,
    })
    logger.info('[writing-assist] LLM response received', {
      mode: request.mode,
      model: response.model,
      ms: Date.now() - llmStart,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
      totalTokens: response.usage?.totalTokens,
    })

    // 5. Normalise. Defensive — bad responses degrade to a usable error
    //    body rather than throwing.
    const normalised = normaliseAssistResponse(response.json, request.mode)

    return {
      mode: request.mode,
      body: normalised.body,
      replacement: normalised.replacement,
      model: response.model,
    }
  },
}
