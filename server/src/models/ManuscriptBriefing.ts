/**
 * Re-export the briefing types from shared, plus the runtime version
 * constant. Mirrors the EssayExport pattern: types are erased at runtime,
 * so importing them from @shared works under the tsx dev loader; runtime
 * values like the version literal must live server-side.
 */
export type {
  ManuscriptBriefingVersion,
  ManuscriptBriefingEnvelope,
  ProseLevel,
  BriefingProject,
  BriefingTheme,
  BriefingSection,
  BriefingItem,
  BriefingCharacter,
  BriefingMotif,
  BriefingBeat,
  BriefingCausalLink,
  BriefingSilence,
  BriefingArtifact,
  BriefingCounts,
  BriefingFreshness,
  BriefingRequestOptions,
  BeatsImportEnvelope,
  BeatImportInput,
  CausalLinkImportInput,
  BeatsImportResult,
} from '@shared/ManuscriptBriefing'

import type { ManuscriptBriefingVersion } from '@shared/ManuscriptBriefing'

/**
 * Single source of truth for the briefing envelope version. Bump when the
 * shape changes in a way that older consumers may not handle (e.g. a new
 * required field, a renamed key).
 */
export const MANUSCRIPT_BRIEFING_VERSION: ManuscriptBriefingVersion = '1.0'
