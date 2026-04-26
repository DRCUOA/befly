/**
 * Manuscript domain types.
 *
 * A ManuscriptProject is a layer above Themes: it gives a body of writing
 * literary direction (a central question, through-line, intended form) and
 * an ordered structural spine made of ManuscriptSections containing
 * ManuscriptItems. Items most commonly point at an existing WritingBlock,
 * but may also represent bridges, placeholders, notes, or fragments that
 * are not yet backed by an essay.
 */

export type ManuscriptForm =
  | 'memoir'
  | 'essay_collection'
  | 'long_form_essay'
  | 'creative_nonfiction'
  | 'hybrid'
  | 'fictionalised_memoir'

export type ManuscriptStatus =
  | 'gathering'
  | 'structuring'
  | 'drafting'
  | 'bridging'
  | 'revising'
  | 'finalising'

export type ManuscriptVisibility = 'private' | 'shared' | 'public'

export interface ManuscriptProject {
  id: string
  userId: string
  title: string
  workingSubtitle?: string | null

  /** Themes whose material seeds this manuscript. May be empty. */
  sourceThemeIds: string[]

  form: ManuscriptForm
  status: ManuscriptStatus

  intendedReader?: string | null
  centralQuestion?: string | null
  throughLine?: string | null
  emotionalArc?: string | null
  narrativePromise?: string | null

  visibility: ManuscriptVisibility

  createdAt: string
  updatedAt: string
}

export type ManuscriptSectionPurpose =
  | 'opening'
  | 'setup'
  | 'deepening'
  | 'turning_point'
  | 'contrast'
  | 'resolution'
  | 'ending'
  | 'appendix'
  | 'unassigned'

export interface ManuscriptSection {
  id: string
  manuscriptId: string
  title: string
  orderIndex: number
  purpose: ManuscriptSectionPurpose
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type ManuscriptItemType =
  | 'essay'
  | 'bridge'
  | 'placeholder'
  | 'note'
  | 'fragment'

export type ManuscriptStructuralRole =
  | 'introduces_theme'
  | 'complicates_theme'
  | 'personal_example'
  | 'turning_point'
  | 'counterpoint'
  | 'deepening'
  | 'release'
  | 'conclusion'

export interface ManuscriptItem {
  id: string
  manuscriptId: string
  sectionId?: string | null
  /** Optional link to an existing WritingBlock. Bridges and placeholders may have none. */
  writingBlockId?: string | null

  itemType: ManuscriptItemType
  title: string
  orderIndex: number

  structuralRole?: ManuscriptStructuralRole | null
  summary?: string | null
  /** Notes written by an AI assist mode. Phase 2+. */
  aiNotes?: string | null

  createdAt: string
  updatedAt: string
}

/**
 * Convenience composite returned by GET /api/manuscripts/:id - the manuscript
 * along with its full ordered spine. Cheaper for the Book Room view than
 * three separate round-trips.
 */
export interface ManuscriptWithSpine {
  manuscript: ManuscriptProject
  sections: ManuscriptSection[]
  items: ManuscriptItem[]
}

/* ----- Manuscript artifacts (durable AI assist output) ----- */

export type ManuscriptArtifactType =
  | 'spine_suggestion'
  | 'through_line'
  | 'gap_analysis'
  | 'bridge'
  | 'voice_audit'
  | 'motif_map'
  | 'reader_journey'

export type ManuscriptArtifactStatus =
  | 'draft'
  | 'accepted'
  | 'rejected'
  | 'archived'

/**
 * One AI-grounded suggestion that lives inside an artifact's `content`.
 * Mirrors the response shape from spec section 6.
 */
export interface AssistSuggestion {
  title: string
  body: string
  confidence: 'low' | 'medium' | 'high'
  /** Items the suggestion was grounded in (provenance). */
  groundedIn: { writingBlockId: string | null; itemId: string | null; title: string; excerpt: string }[]
  actionType:
    | 'reorder'
    | 'add_bridge'
    | 'revise'
    | 'cut'
    | 'expand'
    | 'question'
    | 'note'
}

/**
 * Per-type content shapes. Stored as JSONB; keys are stable.
 * gap_analysis content includes the gap type and the suggested fix.
 */
export interface GapAnalysisContent {
  /** Brief framing of the junction in the writer's own structure. */
  summary: string
  suggestions: (AssistSuggestion & {
    gapType:
      | 'context'
      | 'emotional'
      | 'logical'
      | 'time'
      | 'character'
      | 'motif'
      | 'repetition'
      | 'other'
  })[]
}

export interface ManuscriptArtifact {
  id: string
  manuscriptId: string
  type: ManuscriptArtifactType
  title: string
  /** Type-specific structured payload. Cast to the right shape based on `type`. */
  content: Record<string, unknown> | GapAnalysisContent
  status: ManuscriptArtifactStatus
  relatedWritingBlockIds: string[]
  fromItemId?: string | null
  toItemId?: string | null
  sourceModel?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}
