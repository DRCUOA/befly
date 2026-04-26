/**
 * Essay export/import envelope.
 *
 * Stable JSON shape that travels between deployments. Versioned so we can
 * evolve the format without silently breaking older files - the importer
 * checks the version and refuses anything it doesn't understand.
 *
 * Design choices worth knowing about:
 *
 *   - Themes travel inline (not by foreign key), because IDs are local to a
 *     deployment. The importer resolves themes by name within the target
 *     owner's theme list, creating them on demand.
 *
 *   - Cover images travel as URL references only, never as embedded base64.
 *     A JSON-only envelope is small and forgiving; a 50MB envelope full of
 *     embedded images is neither. Admin moves the actual cover-image files
 *     out of band (e.g. by copying /uploads/cover/... or re-uploading).
 *
 *   - Essay IDs in the envelope are advisory. The importer always assigns
 *     fresh UUIDs on insert. This makes the same file safe to import twice
 *     (you'll get duplicates, not collisions).
 */

export const ESSAY_EXPORT_VERSION = '1.0' as const

export interface EssayExportTheme {
  /** Original id at export time. Not used by the importer. */
  id: string
  name: string
  slug: string
  visibility: 'private' | 'shared' | 'public'
}

export interface EssayExportEssay {
  /** Original id at export time. Not used by the importer. */
  id: string
  /** Original owner id at export time. Used only to label the export, not on import. */
  userId: string
  title: string
  body: string
  /** Theme ids referencing the themes[] array in the same envelope. */
  themeIds: string[]
  visibility: 'private' | 'shared' | 'public'
  coverImageUrl: string | null
  coverImagePosition: string | null
  createdAt: string
  updatedAt: string | null
}

/**
 * Optional summary information about the originating users. Useful when the
 * admin is exporting multiple users' essays - lets you see who wrote what
 * without having to dig in the database afterwards.
 */
export interface EssayExportUser {
  id: string
  email: string
  displayName: string
}

export interface EssayExportEnvelope {
  version: typeof ESSAY_EXPORT_VERSION
  /** ISO 8601 timestamp the export was created. */
  exportedAt: string
  /**
   * What this file contains. Today only "essays"; reserved for future bundle
   * types (e.g. full-account exports including manuscripts).
   */
  type: 'essays'
  /**
   * Free-text label set at export time so the importer can show "you're about
   * to import 12 essays from richard@example.com". Optional.
   */
  scopeLabel?: string
  themes: EssayExportTheme[]
  essays: EssayExportEssay[]
  /** Source-side users summary. Optional, included by default for batch exports. */
  users?: EssayExportUser[]
}

/* ----- Import options & result ----- */

export type ImportOwnershipMode =
  /** Every imported essay is owned by the admin running the import. */
  | 'self'
  /** Every imported essay is owned by a single specified user. */
  | 'target'

export interface EssayImportOptions {
  ownership: ImportOwnershipMode
  /** Required when ownership === 'target'. */
  targetUserId?: string
  /**
   * Limit the import to a subset of the envelope. If omitted, every essay in
   * the envelope is imported.
   */
  onlyEssayIds?: string[]
}

export interface EssayImportResult {
  /** Essays successfully created. */
  created: { newId: string; sourceId: string; title: string }[]
  /** Themes resolved or created during the import. */
  themes: { name: string; resolvedId: string; created: boolean }[]
  /** Per-essay errors that didn't stop the import. */
  errors: { sourceId: string; title: string; error: string }[]
  /** Total essays seen in the envelope (including skipped). */
  total: number
}
