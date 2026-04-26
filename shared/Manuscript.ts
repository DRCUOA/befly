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
