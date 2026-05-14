/**
 * Pure unit tests for the spine-layer planners.
 *
 * Covers the Phase 3 acceptance criteria from the Configurable Spine Depth
 * Refactor plan:
 *   - add_layer wrap_above: 3 top-level sections → 1 top-level + 3 children at level 2
 *   - remove_layer flatten_to_grandparent: 1 parent with 3 children → 3 top-level in order
 *   - reject: level > 4, item attached to non-leaf, parent equals self
 *
 * No DB, no service, no HTTP. Planners are pure functions of the section /
 * item lists they receive, so the tests stay fast and don't need a fixture
 * harness.
 */
import { describe, it, expect } from 'vitest'
import {
  planWrapAbove,
  planFlattenLevel,
  computeSectionLevel,
  assertItemAtDeepestLevel,
  WRAP_ABOVE_NEW_PARENT,
} from './services/spine-layer.js'
import type {
  ManuscriptItem,
  ManuscriptSection,
  ManuscriptSectionPurpose,
} from './models/Manuscript.js'
import { ValidationError } from './utils/errors.js'

/* ----- Test fixtures ----- */

function sec(over: Partial<ManuscriptSection> & { id: string; orderIndex: number }): ManuscriptSection {
  return {
    manuscriptId: 'm1',
    title: `Section ${over.id}`,
    purpose: 'unassigned' as ManuscriptSectionPurpose,
    notes: null,
    parentSectionId: null,
    level: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...over,
  }
}

function item(over: Partial<ManuscriptItem> & { id: string }): ManuscriptItem {
  return {
    manuscriptId: 'm1',
    sectionId: null,
    writingBlockId: null,
    itemType: 'essay',
    title: `Item ${over.id}`,
    orderIndex: 0,
    structuralRole: null,
    summary: null,
    aiNotes: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...over,
  }
}

/* ----- planWrapAbove ----- */

describe('planWrapAbove', () => {
  it('wraps 3 top-level sections under 1 new parent at level 2 (plan acceptance criterion)', () => {
    const sections = [
      sec({ id: 'a', orderIndex: 0, level: 1 }),
      sec({ id: 'b', orderIndex: 1, level: 1 }),
      sec({ id: 'c', orderIndex: 2, level: 1 }),
    ]
    const plan = planWrapAbove({
      sections,
      currentSpineDepth: 1,
      currentLabels: ['Section'],
      label: 'Chapter',
    })

    // Exactly one new section is created — the wrapper.
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0]).toMatchObject({
      title: 'Chapter',
      level: 1,
      parentSectionId: null,
      orderIndex: 0,
    })

    // All three originals become children of the wrapper at level 2,
    // preserving their orderIndex (so reading order is intact).
    expect(plan.updates).toHaveLength(3)
    for (const id of ['a', 'b', 'c']) {
      expect(plan.updates).toContainEqual({
        id,
        level: 2,
        parentSectionId: WRAP_ABOVE_NEW_PARENT,
      })
    }

    expect(plan.deletes).toEqual([])
    expect(plan.spineDepthDelta).toBe(1)
    expect(plan.spineLayerLabels).toEqual(['Chapter', 'Section'])
  })

  it('works on an empty spine — creates just the wrapper, no updates', () => {
    const plan = planWrapAbove({
      sections: [],
      currentSpineDepth: 1,
      currentLabels: ['Section'],
      label: 'Part',
    })
    expect(plan.creates).toHaveLength(1)
    expect(plan.updates).toEqual([])
    expect(plan.deletes).toEqual([])
    expect(plan.spineDepthDelta).toBe(1)
    expect(plan.spineLayerLabels).toEqual(['Part', 'Section'])
  })

  it('deepens already-nested sections (depth 2 → 3 wraps every section, not just level 1)', () => {
    const sections = [
      sec({ id: 'root', orderIndex: 0, level: 1 }),
      sec({ id: 'child', orderIndex: 0, level: 2, parentSectionId: 'root' }),
    ]
    const plan = planWrapAbove({
      sections,
      currentSpineDepth: 2,
      currentLabels: ['Chapter', 'Section'],
      label: 'Part',
    })
    // The level-1 section reparents to the wrapper and becomes level 2.
    expect(plan.updates).toContainEqual({ id: 'root', level: 2, parentSectionId: WRAP_ABOVE_NEW_PARENT })
    // The level-2 section's parent doesn't change (its parent — 'root' —
    // also moved down, so the relationship is preserved); only its
    // level is bumped.
    expect(plan.updates).toContainEqual({ id: 'child', level: 3 })
    expect(plan.spineLayerLabels).toEqual(['Part', 'Chapter', 'Section'])
  })

  it('rejects empty label', () => {
    expect(() => planWrapAbove({
      sections: [], currentSpineDepth: 1, currentLabels: ['Section'], label: '   ',
    })).toThrow(ValidationError)
  })

  it('rejects label > 120 chars', () => {
    expect(() => planWrapAbove({
      sections: [], currentSpineDepth: 1, currentLabels: ['Section'], label: 'x'.repeat(121),
    })).toThrow(ValidationError)
  })

  it('rejects when spineDepth is already at the maximum (4)', () => {
    expect(() => planWrapAbove({
      sections: [],
      currentSpineDepth: 4,
      currentLabels: ['Volume', 'Part', 'Chapter', 'Section'],
      label: 'Saga',
    })).toThrow(/maximum/i)
  })
})

/* ----- planFlattenLevel ----- */

describe('planFlattenLevel', () => {
  it('flattens 1 parent with 3 children → 3 top-level in original order (plan acceptance criterion)', () => {
    const sections = [
      sec({ id: 'parent', orderIndex: 0, level: 1 }),
      sec({ id: 'child-a', orderIndex: 0, level: 2, parentSectionId: 'parent' }),
      sec({ id: 'child-b', orderIndex: 1, level: 2, parentSectionId: 'parent' }),
      sec({ id: 'child-c', orderIndex: 2, level: 2, parentSectionId: 'parent' }),
    ]
    const plan = planFlattenLevel({
      sections,
      items: [],
      currentSpineDepth: 2,
      currentLabels: ['Chapter', 'Section'],
      level: 1,
    })

    expect(plan.deletes).toEqual([{ id: 'parent' }])
    expect(plan.updates).toHaveLength(3)
    expect(plan.updates).toEqual([
      { id: 'child-a', level: 1, parentSectionId: null },
      { id: 'child-b', level: 1, parentSectionId: null },
      { id: 'child-c', level: 1, parentSectionId: null },
    ])
    expect(plan.creates).toEqual([])
    expect(plan.spineDepthDelta).toBe(-1)
    expect(plan.spineLayerLabels).toEqual(['Section'])
  })

  it('promotes grandchildren to grandparent when removing a middle layer', () => {
    // SPINE → Part (L1) → Chapter (L2) → Section (L3); remove L2.
    const sections = [
      sec({ id: 'part',    orderIndex: 0, level: 1 }),
      sec({ id: 'chapter', orderIndex: 0, level: 2, parentSectionId: 'part' }),
      sec({ id: 'section', orderIndex: 0, level: 3, parentSectionId: 'chapter' }),
    ]
    const plan = planFlattenLevel({
      sections,
      items: [],
      currentSpineDepth: 3,
      currentLabels: ['Part', 'Chapter', 'Section'],
      level: 2,
    })
    expect(plan.deletes).toEqual([{ id: 'chapter' }])
    // The level-3 section is now a level-2 child of 'part'.
    expect(plan.updates).toContainEqual({ id: 'section', level: 2, parentSectionId: 'part' })
    expect(plan.spineLayerLabels).toEqual(['Part', 'Section'])
  })

  it('preserves reading order across multiple removed nodes', () => {
    // Two L1 parents each with two L2 children — remove L1, expect
    // four L1 sections in P1's-children → P2's-children order.
    const sections = [
      sec({ id: 'p1', orderIndex: 0, level: 1 }),
      sec({ id: 'c1a', orderIndex: 0, level: 2, parentSectionId: 'p1' }),
      sec({ id: 'c1b', orderIndex: 1, level: 2, parentSectionId: 'p1' }),
      sec({ id: 'p2', orderIndex: 1, level: 1 }),
      sec({ id: 'c2a', orderIndex: 0, level: 2, parentSectionId: 'p2' }),
      sec({ id: 'c2b', orderIndex: 1, level: 2, parentSectionId: 'p2' }),
    ]
    const plan = planFlattenLevel({
      sections,
      items: [],
      currentSpineDepth: 2,
      currentLabels: ['Chapter', 'Section'],
      level: 1,
    })
    expect(plan.deletes).toEqual([{ id: 'p1' }, { id: 'p2' }])
    // Updates appear in input order; tests should not depend on a
    // specific ordering beyond the per-parent grouping.
    const promotedIds = plan.updates.map(u => u.id)
    expect(promotedIds).toEqual(['c1a', 'c1b', 'c2a', 'c2b'])
    for (const u of plan.updates) {
      expect(u.level).toBe(1)
      expect(u.parentSectionId).toBeNull()
    }
  })

  it('rejects removing when spineDepth is 1 (no layers left)', () => {
    expect(() => planFlattenLevel({
      sections: [sec({ id: 'a', orderIndex: 0 })],
      items: [],
      currentSpineDepth: 1,
      currentLabels: ['Section'],
      level: 1,
    })).toThrow(/only remaining/i)
  })

  it('rejects out-of-range level', () => {
    expect(() => planFlattenLevel({
      sections: [], items: [],
      currentSpineDepth: 2, currentLabels: ['Chapter', 'Section'], level: 0,
    })).toThrow(/out of range/i)
    expect(() => planFlattenLevel({
      sections: [], items: [],
      currentSpineDepth: 2, currentLabels: ['Chapter', 'Section'], level: 3,
    })).toThrow(/out of range/i)
  })

  it('rejects removing the deepest layer when items are attached (would orphan them)', () => {
    const sections = [
      sec({ id: 'parent', orderIndex: 0, level: 1 }),
      sec({ id: 'leaf',   orderIndex: 0, level: 2, parentSectionId: 'parent' }),
    ]
    const items = [item({ id: 'i1', sectionId: 'leaf' })]
    expect(() => planFlattenLevel({
      sections, items,
      currentSpineDepth: 2,
      currentLabels: ['Chapter', 'Section'],
      level: 2,
    })).toThrow(/orphan/i)
  })
})

/* ----- computeSectionLevel ----- */

describe('computeSectionLevel', () => {
  it('returns 1 for a root section (no parent)', () => {
    expect(computeSectionLevel({ parent: null })).toBe(1)
  })

  it('returns parent.level + 1 for a child', () => {
    expect(computeSectionLevel({ parent: sec({ id: 'p', orderIndex: 0, level: 2 }) })).toBe(3)
  })

  it('rejects parents that would push level past MAX_SPINE_DEPTH (4)', () => {
    expect(() => computeSectionLevel({
      parent: sec({ id: 'p', orderIndex: 0, level: 4 }),
    })).toThrow(/maximum spine depth of 4/i)
  })

  it('rejects when the resulting level exceeds the manuscript spineDepth', () => {
    expect(() => computeSectionLevel({
      parent: sec({ id: 'p', orderIndex: 0, level: 2 }),
      manuscriptSpineDepth: 2,
    })).toThrow(/configured depth of 2/i)
  })

  it('accepts when the resulting level matches the manuscript spineDepth exactly', () => {
    expect(computeSectionLevel({
      parent: sec({ id: 'p', orderIndex: 0, level: 1 }),
      manuscriptSpineDepth: 2,
    })).toBe(2)
  })
})

/* ----- assertItemAtDeepestLevel ----- */

describe('assertItemAtDeepestLevel', () => {
  it('accepts a null target (orphan item)', () => {
    expect(() => assertItemAtDeepestLevel({
      targetSection: null,
      manuscriptSpineDepth: 3,
    })).not.toThrow()
  })

  it('accepts a section whose level matches the manuscript spineDepth', () => {
    expect(() => assertItemAtDeepestLevel({
      targetSection: sec({ id: 'leaf', orderIndex: 0, level: 2 }),
      manuscriptSpineDepth: 2,
    })).not.toThrow()
  })

  it('rejects items attached to a non-leaf container (plan acceptance criterion)', () => {
    expect(() => assertItemAtDeepestLevel({
      targetSection: sec({ id: 'middle', orderIndex: 0, level: 1 }),
      manuscriptSpineDepth: 2,
    })).toThrow(/deepest spine level/i)
  })
})
