// Re-export shared types for the server-side model layer. Types-only
// (mirror of ManuscriptChat.ts) — @shared/* is a compile-time path
// alias and must not produce runtime imports in the production build.
export type * from '@shared/BookPrinting'
