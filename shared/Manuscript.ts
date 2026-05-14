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

/**
 * Maximum number of container layers in a manuscript spine. The cap
 * bounds tree depth so the UI's indent and the renderer's recursion stay
 * predictable. Items always live below the deepest container.
 */
export const MAX_SPINE_DEPTH = 4

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

  /**
   * Number of container layers in this manuscript's spine. 1 = the legacy
   * SPINE → SECTION → ITEM shape; 2 = SPINE → CHAPTER → SECTION → ITEM;
   * up to MAX_SPINE_DEPTH (4). Manuscripts created before the
   * Configurable Spine Depth refactor backfill to 1.
   */
  spineDepth: number

  /**
   * Human label for each layer, ordered from outermost to innermost.
   * Length always equals `spineDepth`. Defaults to ["Section"] for
   * legacy depth-1 manuscripts; depth-2 typically labels ["Chapter",
   * "Section"], etc. Users may rename layers freely.
   */
  spineLayerLabels: string[]

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

  /**
   * Parent section for nested spines (e.g. a "Chapter" contains
   * "Sections"). NULL means this section sits at the top of the spine.
   * Items still attach via `ManuscriptItem.sectionId` to whichever
   * section is at the deepest level of the manuscript's configured
   * spineDepth.
   *
   * Backfilled to NULL for all rows that predate the Configurable Spine
   * Depth refactor — a flat spine looks like every section at level 1
   * with no parent.
   */
  parentSectionId?: string | null

  /**
   * Depth of this section within the spine (1-based). A top-level
   * section is level 1; its direct children are level 2; etc. Bounded by
   * the parent manuscript's `spineDepth`. Denormalised from
   * parentSectionId so consumers (Book Room renderer, export, RAG) can
   * paginate without recursive joins.
   */
  level: number

  createdAt: string
  updatedAt: string
}

/**
 * Recursive tree node returned by repository helpers that walk the spine
 * top-down. `children` is empty for sections at `level === spineDepth`
 * (the deepest layer). Items aren't part of the tree — they hang off
 * sections at the deepest level via `ManuscriptItem.sectionId`.
 *
 * Phase 2 introduces this alongside the existing flat `listSections()`
 * helper; callers that don't yet know about nesting continue to use the
 * flat list and see level=1 / parentSectionId=null on every row.
 */
export interface SpineNode {
  section: ManuscriptSection
  children: SpineNode[]
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
 * Convenience composite returned by GET /api/manuscripts/:id/spine — the
 * manuscript along with its full ordered spine. Cheaper for the Book
 * Room view than three separate round-trips.
 *
 * `sectionTree` is the same data as `sections`, just shaped as a forest
 * rooted at top-level (parentSectionId IS NULL) sections. Phase 3+
 * clients with depth-aware UIs consume the tree directly; older clients
 * ignore it and keep using the flat `sections` list. For depth-1
 * manuscripts the tree is a single level — same information either way.
 */
export interface ManuscriptWithSpine {
  manuscript: ManuscriptProject
  sections: ManuscriptSection[]
  items: ManuscriptItem[]
  sectionTree: SpineNode[]
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
