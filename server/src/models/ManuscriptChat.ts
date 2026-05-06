// Re-export shared types for consistency with the rest of the server models.
//
// Uses `export type *` (not `export *`) so tsc erases the runtime import.
// `@shared/*` is a compile-time path alias only; production Node has no
// resolver for it. shared/ManuscriptChat.ts is types-only by design.
export type * from '@shared/ManuscriptChat'
