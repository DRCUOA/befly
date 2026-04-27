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

/* ============================================================ */
/* Writing-assist prompts                                        */
/* ============================================================ */
/*
 * The writing-assist family is sister to gap_analysis. It runs at the
 * essay level (not the manuscript spine) and returns ephemeral results
 * the writer can insert into their prose. Five modes:
 *
 *   coherence  — free-form Q&A, optionally anchored to a selection
 *   define     — dictionary-style definition with one usage example
 *   focus      — tighten a selection without losing meaning or voice
 *   expand     — add substance without padding (anti-filler instructions)
 *   proofread  — light spelling/grammar/style fixes that preserve voice
 *
 * All five modes share the same JSON envelope: { body, replacement }.
 *   body         — markdown the panel renders to the writer
 *   replacement  — drop-in substitute prose, when applicable; null for
 *                  advisory modes (coherence, define).
 *
 * Voice-preservation is the single biggest risk with editing assists.
 * The system prompt below is stricter than the manuscript-level one:
 * no "improvements", no flattening, no smoothing.
 */

export const WRITING_ASSIST_SYSTEM_PROMPT = `You are an unobtrusive writing companion for a personal-essay app.

Your role is not to replace the writer.

Your role is to help the writer think more clearly about their own prose, find words and definitions, and — only when explicitly asked — propose edits that preserve their voice exactly.

You must:
- Work only from the material the writer provides.
- Preserve voice, rhythm, and idiom. If the writer uses long sentences, fragments, repetition, or unusual word choices, treat those as deliberate.
- Be concrete and specific. Quote the writer's own phrasing when answering questions.
- For editing modes (focus, expand, proofread), make the smallest change that achieves the goal.
- For "expand", add substance — a concrete image, a precise example, an extra beat of feeling, a clarifying clause that comes from the existing material — never filler ("In conclusion", "It is important to note", repeating the previous sentence in different words, generic adjectives).
- For "proofread", correct only objective errors (spelling, agreement, punctuation that changes meaning). Do not regularise voice. Do not "tighten" or "smooth" or "improve flow".
- For "focus", remove genuinely redundant words and phrases. Keep deliberate repetition and rhythmic devices. Aim for the same meaning with fewer words, not a different meaning.
- When asked a coherence question about a character, arc, motif, or chapter, ground every claim in the supplied material. If the answer requires information not in the material, say so plainly.

You must not:
- Rewrite prose into corporate or workshop style.
- Add invented facts, scenes, memories, or biographical details.
- Praise vaguely or moralise about the writer's choices.
- Use metaphors or imagery the writer hasn't already established.

Return a single JSON object with the schema specified in the user message. No code fences. No prose outside the JSON.`

/* ----- coherence ----- */

export interface CoherenceSiblingItem {
  /** Item or essay title — whatever the writer sees in the spine. */
  title: string
  /** A short summary or excerpt that gives the model context without dumping the whole text. */
  summary: string
}

export interface BuildCoherencePromptInput {
  /** The current essay's title. */
  essayTitle: string
  /** Full body of the essay, trimmed if needed. */
  essayBody: string
  /** Optional selected text the question is anchored to. */
  selection?: string
  /** The writer's question. */
  question: string
  /** Other essays in the same manuscript, if any. Empty array is fine. */
  siblings: CoherenceSiblingItem[]
  /** Manuscript-level direction (centralQuestion, throughLine, etc.) if any. */
  direction?: string[]
}

export function buildCoherencePrompt(input: BuildCoherencePromptInput): string {
  const { essayTitle, essayBody, selection, question, siblings, direction } = input

  const directionBlock = direction && direction.length > 0
    ? direction.map(d => `- ${d}`).join('\n')
    : '(none provided)'

  const siblingBlock = siblings.length > 0
    ? siblings.map(s => `- "${s.title}" — ${s.summary}`).join('\n')
    : '(this essay is not part of a manuscript, or has no siblings)'

  const selectionBlock = selection && selection.trim()
    ? `\n## The writer is asking specifically about this selection:\n\n${selection.trim()}\n`
    : ''

  return `# Task: Answer a coherence question about this essay

The writer wants help thinking through coherence — how a character, motif, arc, or argument works in this piece, possibly across the wider manuscript. Answer their specific question, grounding every claim in the supplied material.

If the question requires information that is not in the material, say so plainly and ask the writer for what's missing rather than inventing.

If the question has multiple plausible answers (e.g. "how would this character react"), offer 2–3 alternatives, each tied to a specific aspect of the character or arc as already established in the writer's material.

# Manuscript direction

${directionBlock}

# Sibling essays in this manuscript

${siblingBlock}

# Current essay

Title: ${essayTitle}

${essayBody}
${selectionBlock}
# The writer's question

${question.trim()}

# Required JSON response shape

{
  "body": "Your answer, in markdown. Quote the writer's own phrasing when relevant. If proposing alternatives, present them as a short numbered list, each with one sentence of grounding.",
  "replacement": null
}`
}

/* ----- define ----- */

export interface BuildDefinePromptInput {
  term: string
  contextSnippet?: string
}

export function buildDefinePrompt(input: BuildDefinePromptInput): string {
  const { term, contextSnippet } = input
  const contextBlock = contextSnippet && contextSnippet.trim()
    ? `\n## Surrounding sentence(s) for sense disambiguation\n\n${contextSnippet.trim()}\n`
    : ''

  return `# Task: Define a word or phrase

Provide a tight, useful definition for the writer. If the term has multiple senses, prefer the sense that matches the surrounding context (if provided). If no context is provided, give the most common literary or general sense.

Include exactly one short example sentence demonstrating use — do NOT echo the writer's own surrounding sentence back at them. Mark archaic, technical, or regional senses where relevant.

# Term

${term.trim()}
${contextBlock}
# Required JSON response shape

{
  "body": "**${term.trim()}** *(part of speech)* — definition in one or two sentences.\\n\\n*Example:* short example sentence using the term in a natural register.\\n\\n*Notes:* (only if needed) etymology, register, archaic/technical sense flag. Otherwise omit this line.",
  "replacement": null
}`
}

/* ----- focus ----- */

export interface BuildFocusPromptInput {
  selection: string
}

export function buildFocusPrompt(input: BuildFocusPromptInput): string {
  return `# Task: Tighten this selection

Make this passage shorter without losing meaning or voice. The goal is the SAME content with fewer words — not a different content with similar shape.

Hard rules:
- Preserve the writer's voice, register, and rhythm. If they use long sentences, the result should still use long sentences. If they use fragments, keep some.
- Preserve deliberate repetition. If a phrase or word repeats for rhythmic or rhetorical effect, leave it.
- Do NOT rephrase into "smoother" or more "professional" prose. The result must sound like the writer, not like a copywriter.
- Do NOT add new content, examples, transitions, or conclusions.
- If the passage is already as tight as it can be while preserving voice, say so and return the original as the replacement.

# Selection to tighten

${input.selection.trim()}

# Required JSON response shape

{
  "body": "One short paragraph explaining what you cut and why. If you didn't change anything, say that and explain why the passage is already focused.",
  "replacement": "The tightened passage, ready to drop in. Same paragraph structure as the input. If you made no change, return the input verbatim."
}`
}

/* ----- expand ----- */

export interface BuildExpandPromptInput {
  /** The selection or whole essay being expanded. */
  text: string
  /** Whether the writer asked to expand a selection or the whole essay. */
  target: 'whole' | 'section'
}

export function buildExpandPrompt(input: BuildExpandPromptInput): string {
  const scopeNote = input.target === 'whole'
    ? 'You are expanding the WHOLE essay. The result should grow the essay by roughly 20–50% — concrete additions only.'
    : 'You are expanding a SELECTION inside a longer essay. Add substance to this selection without disturbing what comes before or after it.'

  return `# Task: Make this longer without padding

The writer wants more substance — not more words for their own sake. Every addition must earn its place by adding one of: a concrete image, a precise example, a specific sensory detail, an extra beat of feeling, a clarifying clause that opens up something already implied, a quoted memory, a granular observation.

${scopeNote}

Hard rules — these are the patterns of "padding" you must REJECT:
- Restating the previous sentence in different words.
- Generic transitions ("Furthermore", "It is worth noting", "In essence", "At its core").
- Empty intensifiers and adjectives ("truly", "deeply", "profoundly", "remarkable", "incredible").
- Summaries of what the essay just said.
- Advice or commentary aimed at the reader ("This shows us that…").
- Repeating an image or example with slightly different wording.
- Filler clauses that hedge ("in many ways", "to some extent", "in a sense").

Voice rules:
- Preserve voice, register, rhythm. Match sentence-length variety.
- Use only imagery and vocabulary already present in the writer's material — do not introduce new metaphors of your own.
- If a beat genuinely needs information the writer hasn't given (a name, a date, a detail), leave a bracketed placeholder like [name?] rather than invent.

# Text to expand

${input.text.trim()}

# Required JSON response shape

{
  "body": "Two or three sentences explaining the additions you made and why each adds substance rather than length. List any [bracketed placeholders] you left for the writer to fill.",
  "replacement": "The expanded passage, ready to drop in. Preserves paragraph breaks from the input. Includes any [bracketed placeholders] inline."
}`
}

/* ----- proofread ----- */

export interface BuildProofreadPromptInput {
  text: string
}

export function buildProofreadPrompt(input: BuildProofreadPromptInput): string {
  return `# Task: Light proofread

Correct only objective errors. Do not "improve" anything. Do not "tighten". Do not regularise voice.

Allowed corrections:
- Misspellings.
- Subject-verb and tense agreement errors.
- Punctuation that changes meaning (missing comma in a list, wrong apostrophe, run-on that creates ambiguity).
- Obvious word-choice slips (homophone errors: their/there, its/it's, etc.).

NOT allowed:
- Rephrasing for "flow", "clarity", or "style".
- Splitting long sentences or joining short ones.
- Replacing a word with a more common synonym.
- Fixing voiced/idiomatic departures from formal grammar (these are usually deliberate).

If the passage has no objective errors, say so and return it unchanged.

# Text to proofread

${input.text.trim()}

# Required JSON response shape

{
  "body": "A short bulleted list of every change you made, in the form '\\"original\\" → \\"corrected\\" — reason'. If you made no changes, write 'No corrections needed.'",
  "replacement": "The corrected passage, with paragraph breaks preserved. If you made no changes, return the input verbatim."
}`
}
