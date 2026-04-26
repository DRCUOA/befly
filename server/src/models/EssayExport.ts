/**
 * Re-export the cross-workspace types from shared. Note these are TYPE-ONLY
 * imports - shared files contain only types/interfaces, with no runtime
 * value exports, because the server's tsx dev loader doesn't resolve path
 * aliases to .ts value-exports the way vitest does. Types are erased at
 * runtime so this is safe.
 */
export type {
  EssayExportVersion,
  EssayExportTheme,
  EssayExportEssay,
  EssayExportUser,
  EssayExportEnvelope,
  ImportOwnershipMode,
  EssayImportOptions,
  EssayImportResult,
} from '@shared/EssayExport'

import type { EssayExportVersion } from '@shared/EssayExport'

/**
 * Runtime version constant. Single source of truth for what version the
 * server stamps on its exports and accepts on its imports. Bump this when
 * the envelope shape changes in a way that older importers can't handle.
 */
export const ESSAY_EXPORT_VERSION: EssayExportVersion = '1.0'
