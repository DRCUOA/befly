// Re-export the SHARED types (interfaces, type aliases). `export type *`
// guarantees TS strips this at compile time — nothing emitted to JS — so the
// `@shared/*` path alias is never asked to resolve at Node runtime. (Without
// the `type` modifier, tsc preserves `export * from '@shared/StoryCraft'` in
// the emitted JS, and Heroku crashes with ERR_MODULE_NOT_FOUND because
// `@shared` is a TS path alias, not a real npm package.)
export type * from '@shared/StoryCraft'

// ---------------------------------------------------------------------------
// Runtime constants — kept LOCAL to the server because the `@shared/*` path
// alias is compile-time only. The client imports these same arrays directly
// from `@shared/StoryCraft` (vite resolves the alias at bundle time, so it's
// fine there). Keep this list in sync with shared/StoryCraft.ts; if you add a
// new enum value, update both places.
//
// This mirrors the convention used by services/manuscript.service.ts which
// keeps its own FORMS / STATUSES / etc. as local constants for the same
// reason.
// ---------------------------------------------------------------------------

import type {
  SceneFunctionType,
  WithholdingLevel,
  KnowledgeKind,
  CausalLinkType,
  SilenceType,
} from '@shared/StoryCraft'

export const SCENE_FUNCTION_TYPES: readonly SceneFunctionType[] = [
  'establishing_voice',
  'counterpoint',
  'correction',
  'echo',
  'withholding',
  'fragment',
  'reframing',
  'stretto',
  'other',
] as const

export const WITHHOLDING_LEVELS: readonly WithholdingLevel[] = ['low', 'medium', 'high'] as const

export const KNOWLEDGE_KINDS: readonly KnowledgeKind[] = [
  'known',
  'suspected',
  'misread',
  'hidden',
  'silent',
] as const

export const CAUSAL_LINK_TYPES: readonly CausalLinkType[] = [
  'because',
  'therefore',
  'but_because',
  'until',
  'reversal',
  'recognition',
  'crisis_choice',
  'climax',
  'plant',
  'payoff',
  'and_then',
] as const

export const SILENCE_TYPES: readonly SilenceType[] = [
  'psychological',
  'social',
  'institutional',
  'formal',
  'ethical',
] as const
