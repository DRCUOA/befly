// Re-export the SHARED types (interfaces, type aliases). `export type *`
// guarantees TS strips this at compile time — nothing emitted to JS — so the
// `@shared/*` path alias is never asked to resolve at Node runtime. (Without
// the `type` modifier, tsc preserves `export * from '@shared/Manuscript'` in
// the emitted JS, and Heroku crashes with ERR_MODULE_NOT_FOUND because
// `@shared` is a TS path alias, not a real npm package.)
export type * from '@shared/Manuscript'

// ---------------------------------------------------------------------------
// Runtime constants — kept LOCAL to the server because the `@shared/*` path
// alias is compile-time only. The client imports MAX_SPINE_DEPTH directly
// from `@shared/Manuscript` (vite resolves the alias at bundle time, so
// it's fine there). Keep this value in sync with shared/Manuscript.ts; if
// the cap ever changes, update both places AND the CHECK constraints in
// server/src/db/migrations/030_configurable_spine_depth.sql.
//
// Mirrors the StoryCraft.ts model precedent — same reason, same fix.
// ---------------------------------------------------------------------------

/**
 * Maximum number of container layers in a manuscript spine. The cap
 * bounds tree depth so the UI's indent and the renderer's recursion
 * stay predictable, and matches the CHECK constraint enforced by
 * migration 030 on both manuscript_sections.level and
 * manuscript_projects.spine_depth.
 */
export const MAX_SPINE_DEPTH = 4
