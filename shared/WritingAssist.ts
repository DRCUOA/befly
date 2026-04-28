/**
 * Writing-assist domain types.
 *
 * Shared between the client (composable, panel UI) and the server (route,
 * service). The discriminated `mode` field is the single source of truth
 * for which `args` shape is valid.
 *
 * Sister to the manuscript-level `assist` mode ("gaps") which lives in
 * Manuscript.ts. That one persists ManuscriptArtifacts; this one is
 * ephemeral — the writer either inserts the suggestion into their prose
 * or dismisses it. No artifact rows are created.
 */

export type WritingAssistMode =
  | 'coherence'             // free-form Q&A about the essay (with sibling-essay context)
  | 'define'                // dictionary-style definition for a word or phrase
  | 'focus'                 // tighten a selection without losing meaning
  | 'expand'                // add substance to a selection or whole essay (no padding)
  | 'proofread'             // light-touch spelling/grammar/style fixes that preserve voice
  | 'factcheck'             // evaluate factual claims for plausibility / accuracy
  /* ---- Develop quadrant ---- four sister modes, each pushes the
   * piece outward in one of two directions for one of two registers.
   * Sister to 'expand', but each is opinionated about the kind of
   * growth it produces. The cluster groups them under a single
   * "Develop" sub-menu so the top toolbar stays zen.
   */
  | 'fiction-breadth'       // "Broaden the canvas" — subplots, POVs, regions, supporting cast
  | 'fiction-depth'         // "Deepen the stakes" — interiority, backstory, sensory atmosphere
  | 'nonfiction-breadth'    // "Cast a wider net" — adjacent topics, broader inquiry
  | 'nonfiction-depth'      // "Drill down" — rigorous development of one specific point

/* ---- Args, one shape per mode ---- */

export interface WritingAssistCoherenceArgs {
  /** The writer's question. Required. */
  question: string
  /**
   * Optional selected text the question is anchored to. Sent verbatim to the
   * model so it can quote when answering. Trim before sending — the server
   * will reject anything over 4000 chars.
   */
  selection?: string
}

export interface WritingAssistDefineArgs {
  /** The word or phrase to define. Required. */
  term: string
  /** Surrounding sentence(s) to disambiguate sense. Optional. */
  contextSnippet?: string
}

export interface WritingAssistFocusArgs {
  /** The text to refocus. Required, must be non-empty after trim. */
  selection: string
}

export interface WritingAssistExpandArgs {
  /**
   * The piece of text to expand. If omitted, the server expands the whole
   * essay body. Either way, the model is instructed to add substance, not
   * filler — see prompt for the explicit anti-padding constraints.
   */
  selection?: string
  /** Whether the operation is whole-essay or section-only. */
  target: 'whole' | 'section'
}

export interface WritingAssistProofreadArgs {
  /**
   * The piece of text to proofread. If omitted, server proofreads the
   * whole essay. Voice-preserving, minimal-edit.
   */
  selection?: string
}

export interface WritingAssistFactCheckArgs {
  /**
   * The piece of text to fact-check. If omitted, the server checks the
   * whole essay. Returns advisory findings (not replacement prose).
   */
  selection?: string
}

/* ---- Develop-quadrant args ----
 *
 * All four modes share the same shape (selection? + target). The four
 * are kept as distinct interfaces (rather than one shared shape with a
 * 'register' discriminator) so each can evolve its own knobs later
 * without breaking the union — e.g. fiction-depth might one day take
 * a `pov?: 'first' | 'third'` arg, and nonfiction-depth might take
 * a `claimToDevelop?: string` arg.
 *
 * Like `expand`, each is transformative: the response carries
 * `replacement` prose the writer can drop into the essay. The prompts
 * (server-side) carry the per-mode bias — what KIND of growth to
 * produce — so this layer stays simple.
 */

export interface WritingAssistFictionBreadthArgs {
  /** The text to broaden. If omitted, the server works on the whole essay. */
  selection?: string
  /** 'whole' = broaden the entire essay; 'section' = a selection only. */
  target: 'whole' | 'section'
}

export interface WritingAssistFictionDepthArgs {
  /** The text to deepen. If omitted, the server works on the whole essay. */
  selection?: string
  /** 'whole' = deepen the entire essay; 'section' = a selection only. */
  target: 'whole' | 'section'
}

export interface WritingAssistNonfictionBreadthArgs {
  /** The text to widen. If omitted, the server works on the whole essay. */
  selection?: string
  /** 'whole' = widen the entire essay; 'section' = a selection only. */
  target: 'whole' | 'section'
}

export interface WritingAssistNonfictionDepthArgs {
  /** The text to drill into. If omitted, the server works on the whole essay. */
  selection?: string
  /** 'whole' = develop the entire essay's core thesis; 'section' = a selection only. */
  target: 'whole' | 'section'
}

/* ---- Discriminated request union ---- */

export type WritingAssistRequest =
  | { mode: 'coherence';            args: WritingAssistCoherenceArgs }
  | { mode: 'define';               args: WritingAssistDefineArgs }
  | { mode: 'focus';                args: WritingAssistFocusArgs }
  | { mode: 'expand';               args: WritingAssistExpandArgs }
  | { mode: 'proofread';            args: WritingAssistProofreadArgs }
  | { mode: 'factcheck';            args: WritingAssistFactCheckArgs }
  | { mode: 'fiction-breadth';      args: WritingAssistFictionBreadthArgs }
  | { mode: 'fiction-depth';        args: WritingAssistFictionDepthArgs }
  | { mode: 'nonfiction-breadth';   args: WritingAssistNonfictionBreadthArgs }
  | { mode: 'nonfiction-depth';     args: WritingAssistNonfictionDepthArgs }

/* ---- Response ---- */

export interface WritingAssistResponse {
  mode: WritingAssistMode
  /**
   * Markdown body the panel renders. Always populated, even on a
   * "nothing to suggest" outcome (the model is instructed to say so
   * explicitly rather than return empty).
   */
  body: string
  /**
   * Optional drop-in replacement text for tools whose output is meant to
   * substitute the user's selection. Set for focus/expand/proofread when
   * the model produced replacement prose; null for coherence/define
   * (those are advisory, not transformative).
   */
  replacement?: string | null
  /** Model name that produced this response — provenance for the UI. */
  model?: string
}
