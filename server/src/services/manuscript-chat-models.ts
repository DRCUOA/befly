/**
 * Manuscript chat — runtime constants.
 *
 * Lives server-side rather than in shared/ so the production runtime
 * can resolve them. (See the warning at the top of shared/ManuscriptChat.ts:
 * the shared workspace is shipped as raw TS in the Heroku image and any
 * runtime import path-aliased to it would fail at runtime.)
 *
 * The client never imports this file — it fetches the same list via the
 * GET /api/manuscripts/chats/models endpoint, which surfaces these exact
 * values.
 */

/**
 * Curated allow-list of chat models. Free-text would let a typo nuke a
 * conversation; the dropdown locks the writer to known-good options.
 * The default is the same as the rest of the app's assist surfaces.
 */
export const MANUSCRIPT_CHAT_MODELS = [
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini (fast, low cost — default)' },
  { id: 'gpt-4o',      label: 'gpt-4o (mid quality)' },
  { id: 'gpt-5-mini',  label: 'gpt-5-mini (newer reasoning, balanced)' },
  { id: 'gpt-5',       label: 'gpt-5 (newer reasoning, highest quality)' },
] as const

export const DEFAULT_MANUSCRIPT_CHAT_MODEL: string = 'gpt-4o-mini'

export const ALLOWED_MANUSCRIPT_CHAT_MODEL_IDS: readonly string[] =
  MANUSCRIPT_CHAT_MODELS.map(m => m.id)
