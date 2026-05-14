/**
 * Pure planners for spine-layer mutations.
 *
 * The configurable spine refactor has two structural operations users can
 * trigger: "add a layer above" (wrap_above) and "remove this layer"
 * (flatten_to_grandparent). Both are non-trivial enough that the
 * algorithm deserves its own home, separate from DB persistence:
 *
 *   1. Pure functions are unit-testable without a Postgres connection.
 *      The plan calls for unit tests of wrap_above / flatten behaviour
 *      and the reject paths; this module is what those tests target.
 *
 *   2. The service layer can preview the mutation (for a confirmation
 *      modal) by running the planner without committing, then commit the
 *      plan transactionally via the repository.
 *
 * Inputs are the flat section list already returned by listSections().
 * Outputs are explicit "update X" / "create Y" / "delete Z" records the
 * repository can apply in a single transaction. We do not mutate the
 * inputs.
 */

import type {
  ManuscriptItem,
  ManuscriptSection,
} from '../models/Manuscript.js'
import { MAX_SPINE_DEPTH } from '../models/Manuscript.js'
import { ValidationError } from '../utils/errors.js'

/* ----- Plan record types ----- */

/** A section whose level (and optionally parent_section_id) changes. */
export interface SectionLevelUpdate {
  id: string
  level: number
  /** Only present when the parent changes (e.g. promotion to grandparent). */
  parentSectionId?: string | null
}

/** A brand-new section to be inserted. */
export interface SectionCreate {
  /** Caller-provided id (so the plan stays deterministic); repo uses gen_random_uuid if absent. */
  id?: string
  title: string
  orderIndex: number
  parentSectionId: string | null
  level: number
}

/** A section to be removed. Sections only, not items. */
export interface SectionDelete {
  id: string
}

/**
 * One coherent layer mutation. The repository applies it in a single
 * transaction so the manuscript never observes a half-updated tree.
 */
export interface SpineLayerPlan {
  /** Sections to update (level / parent reassignments). */
  updates: SectionLevelUpdate[]
  /** New sections to insert (wrap_above creates one; flatten creates none). */
  creates: SectionCreate[]
  /** Sections to delete (flatten removes the layer's nodes; wrap creates none). */
  deletes: SectionDelete[]
  /** spine_depth delta to apply to the manuscript. */
  spineDepthDelta: number
  /** New spine_layer_labels for the manuscript (full replacement). */
  spineLayerLabels: string[]
}

/* ----- wrap_above ----- */

// Callers must pass `sections` in the canonical (order_index ASC,
// created_at ASC) order returned by listSections(). The planners iterate
// in input order so the resulting plan preserves reading order at every
// level. Sorting inside the planner would couple the algorithm to a
// specific tiebreaker; trusting the input keeps the planner pure and
// matches the rest of the codebase's listSections() callers.

/**
 * Plan a wrap_above mutation. Every existing top-level (level=1) section
 * becomes a child of a single new parent named `label`. All existing
 * sections shift one level deeper (level += 1). The manuscript's
 * spine_depth grows by 1 and `label` is prepended to spine_layer_labels.
 *
 * Throws ValidationError when:
 *   - label is empty or too long
 *   - spineDepth is already at MAX_SPINE_DEPTH
 *
 * The plan creates exactly one new section, regardless of how many
 * top-level sections exist (could be zero — adding a layer to an empty
 * spine just gives you a single new container).
 */
export function planWrapAbove(args: {
  sections: ManuscriptSection[]
  currentSpineDepth: number
  currentLabels: string[]
  label: string
  /** Optional id for the new section; defaults to repo gen_random_uuid. */
  newSectionId?: string
}): SpineLayerPlan {
  const label = args.label.trim()
  if (!label) throw new ValidationError('Layer label is required')
  if (label.length > 120) throw new ValidationError('Layer label must be 120 characters or less')
  if (args.currentSpineDepth >= MAX_SPINE_DEPTH) {
    throw new ValidationError(`Spine depth is already at the maximum (${MAX_SPINE_DEPTH})`)
  }

  // Every existing section descends one level. Top-level ones also
  // reparent to the new wrapper. We can't yet know the wrapper's UUID
  // (the repo generates it on INSERT), so we encode the dependency with
  // a sentinel `WRAP_ABOVE_NEW_PARENT` that the repository resolves
  // after creating the wrapper. Keeping it as a value (not a closure
  // over a future id) means the planner stays pure and unit tests can
  // assert on the sentinel directly.
  const updates: SectionLevelUpdate[] = []
  for (const s of args.sections) {
    if (s.level === 1) {
      updates.push({ id: s.id, level: s.level + 1, parentSectionId: WRAP_ABOVE_NEW_PARENT })
    } else {
      // Non-top sections just deepen; their parent_section_id is
      // unchanged (their existing parent also moved down one level).
      updates.push({ id: s.id, level: s.level + 1 })
    }
  }

  const creates: SectionCreate[] = [{
    id: args.newSectionId,
    title: label,
    // The new wrapper is the (sole) top-level container until the user
    // splits it. order_index 0 keeps it at the head of the level-1 set
    // if multiple top-level rows ever exist concurrently.
    orderIndex: 0,
    parentSectionId: null,
    level: 1,
  }]

  return {
    updates,
    creates,
    deletes: [],
    spineDepthDelta: 1,
    spineLayerLabels: [label, ...args.currentLabels],
  }
}

/**
 * Sentinel value used in a `planWrapAbove` plan to mark which
 * `parentSectionId` slots the repository should populate with the
 * newly-created wrapper section's UUID after INSERT. Exported so the
 * repository can match against it without re-declaring the constant.
 */
export const WRAP_ABOVE_NEW_PARENT = '__WRAP_ABOVE_NEW_PARENT__'

/* ----- flatten_to_grandparent ----- */

/**
 * Plan a flatten_to_grandparent mutation for `level`. Sections AT the
 * removed level are deleted; their CHILDREN are promoted to that level's
 * grandparent (the parent of the removed section). Sections deeper than
 * the removed level keep their existing parent but have their level
 * decremented by 1 so the new tree's invariant holds. The manuscript's
 * spine_depth drops by 1 and the label at index (level - 1) is removed.
 *
 * Throws ValidationError when:
 *   - level is outside [1, currentSpineDepth]
 *   - currentSpineDepth is 1 (no layers left to remove)
 *   - any item references a section at `currentSpineDepth` and `level ==
 *     currentSpineDepth` (would orphan items; users must move items first)
 *
 * The "items remain attached to their (now-promoted) parents" rule from
 * the plan applies because items always hang off sections at the
 * deepest level. Removing a non-deepest level only changes some
 * sections' parent + level; the deepest-level sections (which still
 * hold items) keep their identity, so no item rewrite is needed.
 * Removing the deepest level itself, however, would orphan items — we
 * reject that case explicitly.
 */
export function planFlattenLevel(args: {
  sections: ManuscriptSection[]
  items: ManuscriptItem[]
  currentSpineDepth: number
  currentLabels: string[]
  level: number
}): SpineLayerPlan {
  const { level, currentSpineDepth } = args
  if (currentSpineDepth <= 1) {
    throw new ValidationError('Cannot remove the only remaining spine layer')
  }
  if (level < 1 || level > currentSpineDepth) {
    throw new ValidationError(
      `Layer ${level} is out of range; manuscript has ${currentSpineDepth} layer(s)`,
    )
  }
  if (level === currentSpineDepth) {
    // Items hang off sections at currentSpineDepth. Removing that layer
    // would leave them parented to sections that no longer exist.
    const deepestIds = new Set(
      args.sections.filter(s => s.level === currentSpineDepth).map(s => s.id),
    )
    const orphanCount = args.items.filter(i => i.sectionId && deepestIds.has(i.sectionId)).length
    if (orphanCount > 0) {
      throw new ValidationError(
        `Removing layer ${level} would orphan ${orphanCount} item(s); move or delete them first`,
      )
    }
  }

  // Index sections by id so we can look up grandparents efficiently.
  const byId = new Map<string, ManuscriptSection>()
  for (const s of args.sections) byId.set(s.id, s)

  const updates: SectionLevelUpdate[] = []
  const deletes: SectionDelete[] = []

  for (const s of args.sections) {
    if (s.level < level) {
      // Above the removed layer: untouched.
      continue
    }
    if (s.level === level) {
      // This is one of the removed nodes.
      deletes.push({ id: s.id })
      continue
    }
    if (s.level === level + 1) {
      // Direct child of a removed node: promote to grandparent.
      const removedParent = s.parentSectionId ? byId.get(s.parentSectionId) : null
      const newParentId = removedParent ? (removedParent.parentSectionId ?? null) : null
      updates.push({ id: s.id, level: s.level - 1, parentSectionId: newParentId })
      continue
    }
    // Deeper than removed: parent unchanged, level decremented.
    updates.push({ id: s.id, level: s.level - 1 })
  }

  const nextLabels = [...args.currentLabels]
  nextLabels.splice(level - 1, 1)

  return {
    updates,
    creates: [],
    deletes,
    spineDepthDelta: -1,
    spineLayerLabels: nextLabels,
  }
}

/* ----- Section-tree validation ----- */

/**
 * Compute the level for a section about to be created or moved, given
 * its proposed parent. The service layer uses this to enforce the
 * `level === parent.level + 1` invariant and reject parents that would
 * push past MAX_SPINE_DEPTH or the manuscript's configured spineDepth.
 *
 * Pass `manuscriptSpineDepth` to bound the result; pass undefined to
 * only bound by MAX_SPINE_DEPTH (used by add-layer flows that have
 * already grown spine_depth in the same transaction).
 */
export function computeSectionLevel(args: {
  parent: ManuscriptSection | null
  manuscriptSpineDepth?: number
}): number {
  const level = args.parent ? args.parent.level + 1 : 1
  if (level > MAX_SPINE_DEPTH) {
    throw new ValidationError(
      `Section would be level ${level}, exceeding the maximum spine depth of ${MAX_SPINE_DEPTH}`,
    )
  }
  if (args.manuscriptSpineDepth !== undefined && level > args.manuscriptSpineDepth) {
    throw new ValidationError(
      `Section would be level ${level}, exceeding the manuscript's configured depth of ${args.manuscriptSpineDepth}. Add a layer first.`,
    )
  }
  return level
}

/**
 * Assert that an item's target section is at the manuscript's deepest
 * level. Items must always be leaves below the deepest container — the
 * Configurable Spine Depth Refactor's central invariant. Throws if the
 * target section does not exist or is at a shallower level.
 *
 * `targetSection` may be null to signal "no section" (an orphan item),
 * which is always allowed regardless of depth.
 */
export function assertItemAtDeepestLevel(args: {
  targetSection: ManuscriptSection | null
  manuscriptSpineDepth: number
}): void {
  if (args.targetSection === null) return
  if (args.targetSection.level !== args.manuscriptSpineDepth) {
    throw new ValidationError(
      `Items can only attach to sections at the deepest spine level (${args.manuscriptSpineDepth}); ` +
      `target section is at level ${args.targetSection.level}`,
    )
  }
}
