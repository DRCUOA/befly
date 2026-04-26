/**
 * Prompt assembly for assist modes.
 *
 * Pure functions - no I/O, no LLM calls. They take already-fetched user
 * material and produce strings ready to feed into LlmClient.chatJson.
 *
 * Two design rules from the product spec drive this module:
 *
 *   Rule 1 (retrieval before generation): the prompt MUST include the user's
 *   actual material (essay bodies, structural context). The model never
 *   reasons from general literary knowledge alone.
 *
 *   Rule 3 (no invented facts): the system prompt explicitly forbids
 *   inventing events, memories, people. The mode-specific output schema
 *   demands provenance for every suggestion so the UI can show grounding.
 */
import {
  ManuscriptProject,
  ManuscriptItem,
} from '../../models/Manuscript.js'

/**
 * The system prompt is the same for every assist mode. Per spec section 11.
 * Kept here so it lives next to the rest of the AI plumbing rather than
 * floating in a markdown doc that drifts.
 */
export const ASSIST_SYSTEM_PROMPT = `You are a structural writing assistant for a personal essay and creative nonfiction app.

Your role is not to replace the writer.

Your role is to help the writer discover, organise, deepen, and connect their own material into a coherent manuscript.

You must:
- Work only from the provided user material.
- Preserve the writer's voice.
- Avoid generic literary advice unless directly relevant.
- Avoid inventing facts, events, memories, motives, or biographical details.
- Prefer structural comments, questions, outlines, and bridge suggestions over full rewrites.
- Identify gaps where a reader may need context.
- Identify recurring images, phrases, tensions, emotional patterns, and contradictions.
- Treat contradiction and roughness as potentially valuable, not automatically as errors.
- Show which excerpts your suggestions are grounded in.
- Ask questions where the manuscript needs missing information.

You must not:
- Produce polished generic prose that overwrites the user's style.
- Flatten unusual phrasing into corporate clarity.
- Add invented scenes or emotional conclusions.
- Pretend the manuscript is more coherent than it is.
- Praise vaguely.

When giving feedback, be specific, grounded, and useful.

You always respond with a single JSON object that conforms to the schema described in the user message. Do not wrap the JSON in code fences. Do not include any text outside the JSON.`

/* ----- Body trimming helpers ----- */

/**
 * Cap an essay body to a reasonable token-equivalent for prompt budgeting.
 * Char-based not token-based: it's a hard ceiling, not a precise count.
 * The opening and closing matter most - we keep both.
 */
export function trimBodyForPrompt(body: string | null, maxChars: number = 3500): string {
  if (!body) return ''
  const trimmed = body.trim()
  if (trimmed.length <= maxChars) return trimmed
  const half = Math.floor((maxChars - 100) / 2)
  const head = trimmed.slice(0, half)
  const tail = trimmed.slice(-half)
  return `${head}\n\n[…body trimmed for length…]\n\n${tail}`
}

/* ----- Gap analysis ----- */

export interface GapPromptItem extends ManuscriptItem {
  body: string | null
}

interface BuildGapPromptInput {
  manuscript: ManuscriptProject
  /** Section title that contains `from`/`to`, if any, for context. */
  sectionTitle?: string | null
  /** The earlier item in the spine. */
  from: GapPromptItem
  /** The later item in the spine. */
  to: GapPromptItem
  /** Optional - any prior accepted artifacts to avoid duplicate suggestions. */
  priorAcceptedNotes?: string[]
  /** Char-budget per essay body. Lowered automatically if both bodies are long. */
  bodyCharBudget?: number
}

/**
 * Build the user-message prompt for the gap_analysis mode. Returns the string
 * to send as `user`. The system prompt is `ASSIST_SYSTEM_PROMPT`.
 *
 * The prompt is structured so the JSON schema is unambiguous - the model
 * doesn't have to guess at field names.
 */
export function buildGapAnalysisPrompt(input: BuildGapPromptInput): string {
  const { manuscript, sectionTitle, from, to, priorAcceptedNotes } = input
  const budget = input.bodyCharBudget ?? 3500

  const fromBody = trimBodyForPrompt(from.body, budget)
  const toBody = trimBodyForPrompt(to.body, budget)

  const direction: string[] = []
  if (manuscript.workingSubtitle) direction.push(`Subtitle: ${manuscript.workingSubtitle}`)
  if (manuscript.centralQuestion) direction.push(`Central question: ${manuscript.centralQuestion}`)
  if (manuscript.throughLine)     direction.push(`Through-line: ${manuscript.throughLine}`)
  if (manuscript.emotionalArc)    direction.push(`Emotional arc: ${manuscript.emotionalArc}`)
  if (manuscript.narrativePromise) direction.push(`Narrative promise: ${manuscript.narrativePromise}`)
  const directionBlock = direction.length > 0
    ? direction.map(d => `- ${d}`).join('\n')
    : '(none provided)'

  const priorBlock = priorAcceptedNotes && priorAcceptedNotes.length > 0
    ? priorAcceptedNotes.map(n => `- ${n}`).join('\n')
    : '(none)'

  return `# Task: Gap analysis at one junction

You are analyzing a single junction in a manuscript-in-progress. The reader will move directly from "${from.title}" to "${to.title}". Your job is to identify whether this transition has gaps that would lose or confuse the reader, and if so, what kind of gap and what kind of bridge or revision could close it.

Categorize each gap as one of: context, emotional, logical, time, character, motif, repetition, other.

Important constraints:
- Work only from the material below. Do not invent events, people, places, or facts not present in the user's writing.
- If a gap exists because something is genuinely missing from the writer's material, prefer asking a question over fabricating an answer.
- Treat productive roughness (contradiction, unresolved feeling, odd phrasing that carries meaning) as potentially valuable, not as a problem to fix.
- It is acceptable to report that no significant gap exists - return an empty suggestions array in that case.

# Manuscript context

Title: ${manuscript.title}
Form: ${manuscript.form}
${sectionTitle ? `Section: ${sectionTitle}` : 'Section: (none)'}

Literary direction:
${directionBlock}

Previously accepted notes about this manuscript:
${priorBlock}

# Junction to analyze

## Earlier piece: "${from.title}" (${from.itemType})
${from.summary ? `Writer's summary: ${from.summary}\n` : ''}
${fromBody ? fromBody : '(No body text - this item is a placeholder, bridge, or fragment.)'}

---

## Later piece: "${to.title}" (${to.itemType})
${to.summary ? `Writer's summary: ${to.summary}\n` : ''}
${toBody ? toBody : '(No body text - this item is a placeholder, bridge, or fragment.)'}

# Required JSON response shape

Return exactly this shape (no other keys, no prose outside JSON):

{
  "summary": "One short sentence describing the transition as it currently stands.",
  "suggestions": [
    {
      "title": "Short label for this gap (under 80 chars).",
      "gapType": "context | emotional | logical | time | character | motif | repetition | other",
      "body": "The problem and the suggested fix, in two short paragraphs. The first paragraph names the gap concretely, citing the user's material. The second paragraph proposes a bridge or revision - structural, not prose - and may include one short sentence example only if it sits naturally in the writer's voice. Do not write a finished bridge.",
      "confidence": "low | medium | high",
      "actionType": "add_bridge | revise | reorder | cut | expand | question | note",
      "groundedIn": [
        {
          "itemId": "${from.id}",
          "title": "${from.title}",
          "excerpt": "A short verbatim excerpt (under 200 chars) from the earlier piece that anchors this suggestion."
        },
        {
          "itemId": "${to.id}",
          "title": "${to.title}",
          "excerpt": "A short verbatim excerpt (under 200 chars) from the later piece that anchors this suggestion."
        }
      ]
    }
  ]
}

If no significant gap exists, return:
{ "summary": "...", "suggestions": [] }`
}
