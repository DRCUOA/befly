import { manuscriptRepo, buildSectionTree } from '../repositories/manuscript.repo.js'
import {
  ManuscriptProject,
  ManuscriptSection,
  ManuscriptItem,
  ManuscriptForm,
  ManuscriptStatus,
  ManuscriptVisibility,
  ManuscriptSectionPurpose,
  ManuscriptItemType,
  ManuscriptStructuralRole,
  ManuscriptWithSpine,
} from '../models/Manuscript.js'
import {
  planWrapAbove,
  planFlattenLevel,
  computeSectionLevel,
  assertItemAtDeepestLevel,
} from './spine-layer.js'
import { sanitizeString } from '../utils/sanitize.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'

const FORMS: readonly ManuscriptForm[] = [
  'memoir',
  'essay_collection',
  'long_form_essay',
  'creative_nonfiction',
  'hybrid',
  'fictionalised_memoir',
] as const

const STATUSES: readonly ManuscriptStatus[] = [
  'gathering',
  'structuring',
  'drafting',
  'bridging',
  'revising',
  'finalising',
] as const

const VISIBILITIES: readonly ManuscriptVisibility[] = ['private', 'shared', 'public'] as const

const SECTION_PURPOSES: readonly ManuscriptSectionPurpose[] = [
  'opening',
  'setup',
  'deepening',
  'turning_point',
  'contrast',
  'resolution',
  'ending',
  'appendix',
  'unassigned',
] as const

const ITEM_TYPES: readonly ManuscriptItemType[] = [
  'essay',
  'bridge',
  'placeholder',
  'note',
  'fragment',
] as const

const STRUCTURAL_ROLES: readonly ManuscriptStructuralRole[] = [
  'introduces_theme',
  'complicates_theme',
  'personal_example',
  'turning_point',
  'counterpoint',
  'deepening',
  'release',
  'conclusion',
] as const

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function ensureUuid(value: string, label: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ValidationError(`${label} must be a valid UUID`)
  }
  return value
}

function ensureUuidArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${label} must be an array`)
  }
  return value.map((v, i) => ensureUuid(String(v), `${label}[${i}]`))
}

function ensureEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${label} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

function nullableText(value: unknown, label: string, maxLen = 10_000): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new ValidationError(`${label} must be a string`)
  const cleaned = sanitizeString(value)
  if (cleaned.length > maxLen) {
    throw new ValidationError(`${label} must be ${maxLen} characters or less`)
  }
  return cleaned
}

export const manuscriptService = {
  // ---------- projects ----------

  async list(userId: string | null, isAdmin: boolean = false): Promise<ManuscriptProject[]> {
    return manuscriptRepo.findAll(userId, isAdmin)
  },

  async get(id: string, userId: string | null, isAdmin: boolean = false): Promise<ManuscriptProject> {
    return manuscriptRepo.findById(ensureUuid(id, 'id'), userId, isAdmin)
  },

  /**
   * Convenience for the Book Room view: fetch the manuscript along with
   * its full ordered spine in one call. Returns the flat section / item
   * lists (back-compat) plus a `sectionTree` forest (Phase 3+ clients).
   * The tree is derived from the flat list — no extra DB round-trip.
   */
  async getWithSpine(
    id: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<ManuscriptWithSpine> {
    const manuscript = await this.get(id, userId, isAdmin)
    const [sections, items] = await Promise.all([
      manuscriptRepo.listSections(manuscript.id, userId, isAdmin),
      manuscriptRepo.listItems(manuscript.id, userId, isAdmin),
    ])
    return { manuscript, sections, items, sectionTree: buildSectionTree(sections) }
  },

  async create(input: {
    userId: string
    title: unknown
    workingSubtitle?: unknown
    form?: unknown
    status?: unknown
    intendedReader?: unknown
    centralQuestion?: unknown
    throughLine?: unknown
    emotionalArc?: unknown
    narrativePromise?: unknown
    visibility?: unknown
    sourceThemeIds?: unknown
  }): Promise<ManuscriptProject> {
    const title = sanitizeString(typeof input.title === 'string' ? input.title : '')
    if (!title) throw new ValidationError('Title is required')
    if (title.length > 255) throw new ValidationError('Title must be 255 characters or less')

    const workingSubtitle = nullableText(input.workingSubtitle, 'workingSubtitle', 500)
    const form: ManuscriptForm = input.form === undefined
      ? 'essay_collection'
      : ensureEnum(input.form, FORMS, 'form')
    const status: ManuscriptStatus = input.status === undefined
      ? 'gathering'
      : ensureEnum(input.status, STATUSES, 'status')
    const visibility: ManuscriptVisibility = input.visibility === undefined
      ? 'private'
      : ensureEnum(input.visibility, VISIBILITIES, 'visibility')

    const sourceThemeIds = input.sourceThemeIds === undefined
      ? []
      : ensureUuidArray(input.sourceThemeIds, 'sourceThemeIds')

    return manuscriptRepo.create({
      userId: input.userId,
      title,
      workingSubtitle,
      form,
      status,
      intendedReader: nullableText(input.intendedReader, 'intendedReader', 1000),
      centralQuestion: nullableText(input.centralQuestion, 'centralQuestion', 2000),
      throughLine: nullableText(input.throughLine, 'throughLine', 4000),
      emotionalArc: nullableText(input.emotionalArc, 'emotionalArc', 4000),
      narrativePromise: nullableText(input.narrativePromise, 'narrativePromise', 2000),
      visibility,
      sourceThemeIds,
    })
  },

  async update(
    id: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin: boolean = false
  ): Promise<ManuscriptProject> {
    const updates: Parameters<typeof manuscriptRepo.update>[2] = {}

    if (input.title !== undefined) {
      const t = sanitizeString(typeof input.title === 'string' ? input.title : '')
      if (!t) throw new ValidationError('Title cannot be empty')
      if (t.length > 255) throw new ValidationError('Title must be 255 characters or less')
      updates.title = t
    }
    if (input.workingSubtitle !== undefined) updates.workingSubtitle = nullableText(input.workingSubtitle, 'workingSubtitle', 500)
    if (input.form !== undefined) updates.form = ensureEnum(input.form, FORMS, 'form')
    if (input.status !== undefined) updates.status = ensureEnum(input.status, STATUSES, 'status')
    if (input.intendedReader !== undefined) updates.intendedReader = nullableText(input.intendedReader, 'intendedReader', 1000)
    if (input.centralQuestion !== undefined) updates.centralQuestion = nullableText(input.centralQuestion, 'centralQuestion', 2000)
    if (input.throughLine !== undefined) updates.throughLine = nullableText(input.throughLine, 'throughLine', 4000)
    if (input.emotionalArc !== undefined) updates.emotionalArc = nullableText(input.emotionalArc, 'emotionalArc', 4000)
    if (input.narrativePromise !== undefined) updates.narrativePromise = nullableText(input.narrativePromise, 'narrativePromise', 2000)
    if (input.visibility !== undefined) updates.visibility = ensureEnum(input.visibility, VISIBILITIES, 'visibility')
    if (input.sourceThemeIds !== undefined) updates.sourceThemeIds = ensureUuidArray(input.sourceThemeIds, 'sourceThemeIds')

    return manuscriptRepo.update(ensureUuid(id, 'id'), userId, updates, isAdmin)
  },

  async delete(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    return manuscriptRepo.delete(ensureUuid(id, 'id'), userId, isAdmin)
  },

  // ---------- sections ----------

  async listSections(manuscriptId: string, userId: string | null, isAdmin: boolean = false): Promise<ManuscriptSection[]> {
    return manuscriptRepo.listSections(ensureUuid(manuscriptId, 'manuscriptId'), userId, isAdmin)
  },

  async createSection(
    manuscriptId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin: boolean = false
  ): Promise<ManuscriptSection> {
    const mid = ensureUuid(manuscriptId, 'manuscriptId')
    const title = sanitizeString(typeof input.title === 'string' ? input.title : '')
    if (!title) throw new ValidationError('Section title is required')
    if (title.length > 255) throw new ValidationError('Section title must be 255 characters or less')

    const purpose = input.purpose === undefined
      ? 'unassigned' as const
      : ensureEnum(input.purpose, SECTION_PURPOSES, 'purpose')

    // Resolve the parent section (if any) and compute the new section's
    // level. The level is fully determined by the parent — the wire
    // input shouldn't supply it. computeSectionLevel enforces both the
    // hard cap (MAX_SPINE_DEPTH=4) and the manuscript's configured
    // spineDepth; together they keep the tree consistent with the
    // "items only at deepest level" invariant.
    let parentSectionId: string | null = null
    let parent: ManuscriptSection | null = null
    let manuscriptSpineDepth: number | undefined
    if (input.parentSectionId !== undefined && input.parentSectionId !== null) {
      parentSectionId = ensureUuid(String(input.parentSectionId), 'parentSectionId')
      const manuscript = await manuscriptRepo.findById(mid, userId, isAdmin)
      manuscriptSpineDepth = manuscript.spineDepth
      const sections = await manuscriptRepo.listSections(mid, userId, isAdmin)
      parent = sections.find(s => s.id === parentSectionId) ?? null
      if (!parent) {
        throw new ValidationError('parentSectionId must reference a section in the same manuscript')
      }
    }
    const level = computeSectionLevel({ parent, manuscriptSpineDepth })

    return manuscriptRepo.createSection(
      mid,
      userId,
      {
        title,
        purpose,
        notes: nullableText(input.notes, 'notes', 4000),
        orderIndex: typeof input.orderIndex === 'number' ? input.orderIndex : undefined,
        parentSectionId,
        level,
      },
      isAdmin
    )
  },

  async updateSection(
    sectionId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin: boolean = false
  ): Promise<ManuscriptSection> {
    const sid = ensureUuid(sectionId, 'sectionId')
    const updates: Parameters<typeof manuscriptRepo.updateSection>[2] = {}
    if (input.title !== undefined) {
      const t = sanitizeString(typeof input.title === 'string' ? input.title : '')
      if (!t) throw new ValidationError('Section title cannot be empty')
      if (t.length > 255) throw new ValidationError('Section title must be 255 characters or less')
      updates.title = t
    }
    if (input.orderIndex !== undefined) {
      if (typeof input.orderIndex !== 'number' || !Number.isFinite(input.orderIndex)) {
        throw new ValidationError('orderIndex must be a number')
      }
      updates.orderIndex = Math.trunc(input.orderIndex)
    }
    if (input.purpose !== undefined) updates.purpose = ensureEnum(input.purpose, SECTION_PURPOSES, 'purpose')
    if (input.notes !== undefined) updates.notes = nullableText(input.notes, 'notes', 4000)

    // Reparent + level change: same invariant guards as createSection.
    // A section cannot become its own parent (CHECK constraint also
    // enforces this at the DB) or move under a descendant — we catch
    // both client-side here so the error message is meaningful.
    if (input.parentSectionId !== undefined) {
      const newParentId = input.parentSectionId === null
        ? null
        : ensureUuid(String(input.parentSectionId), 'parentSectionId')
      if (newParentId === sid) {
        throw new ValidationError('A section cannot be its own parent')
      }
      // Load the section's manuscript and its sibling tree so we can
      // resolve the proposed parent, compute the new level, and detect
      // cycles. listSections enforces read access; updateSection at the
      // repo level enforces write access, so we don't repeat that check.
      const existingRow = await manuscriptRepo.findSectionManuscriptId(sid)
      if (!existingRow) throw new NotFoundError('Section not found')
      const manuscript = await manuscriptRepo.findById(existingRow, userId, isAdmin)
      const sections = await manuscriptRepo.listSections(manuscript.id, userId, isAdmin)
      let parent: ManuscriptSection | null = null
      if (newParentId !== null) {
        parent = sections.find(s => s.id === newParentId) ?? null
        if (!parent) {
          throw new ValidationError('parentSectionId must reference a section in the same manuscript')
        }
        // Reject moves that would create a cycle: walk up from the
        // proposed parent; if we hit the section being moved, refuse.
        const byId = new Map(sections.map(s => [s.id, s]))
        let walker: ManuscriptSection | undefined = parent
        const visited = new Set<string>()
        while (walker) {
          if (walker.id === sid) {
            throw new ValidationError('Cannot move a section under one of its own descendants')
          }
          if (visited.has(walker.id)) break
          visited.add(walker.id)
          walker = walker.parentSectionId ? byId.get(walker.parentSectionId) : undefined
        }
      }
      const level = computeSectionLevel({ parent, manuscriptSpineDepth: manuscript.spineDepth })
      updates.parentSectionId = newParentId
      updates.level = level
    }

    return manuscriptRepo.updateSection(sid, userId, updates, isAdmin)
  },

  async deleteSection(sectionId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    return manuscriptRepo.deleteSection(ensureUuid(sectionId, 'sectionId'), userId, isAdmin)
  },

  // ---------- items ----------

  async listItems(manuscriptId: string, userId: string | null, isAdmin: boolean = false): Promise<ManuscriptItem[]> {
    return manuscriptRepo.listItems(ensureUuid(manuscriptId, 'manuscriptId'), userId, isAdmin)
  },

  async createItem(
    manuscriptId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin: boolean = false
  ): Promise<ManuscriptItem> {
    const mid = ensureUuid(manuscriptId, 'manuscriptId')
    const title = sanitizeString(typeof input.title === 'string' ? input.title : '')
    if (!title) throw new ValidationError('Item title is required')
    if (title.length > 500) throw new ValidationError('Item title must be 500 characters or less')

    const itemType = input.itemType === undefined
      ? 'essay' as const
      : ensureEnum(input.itemType, ITEM_TYPES, 'itemType')

    const sectionId = input.sectionId === undefined || input.sectionId === null
      ? null
      : ensureUuid(String(input.sectionId), 'sectionId')

    const writingBlockId = input.writingBlockId === undefined || input.writingBlockId === null
      ? null
      : ensureUuid(String(input.writingBlockId), 'writingBlockId')

    const structuralRole = input.structuralRole === undefined || input.structuralRole === null
      ? null
      : ensureEnum(input.structuralRole, STRUCTURAL_ROLES, 'structuralRole')

    // Items must attach only at the deepest spine layer. Depth-1
    // manuscripts (today's default) trivially satisfy this since every
    // section is at level 1; the check only constrains depth>1 cases.
    if (sectionId !== null) {
      const [manuscript, sections] = await Promise.all([
        manuscriptRepo.findById(mid, userId, isAdmin),
        manuscriptRepo.listSections(mid, userId, isAdmin),
      ])
      const target = sections.find(s => s.id === sectionId) ?? null
      if (!target) {
        throw new ValidationError('sectionId must reference a section in the same manuscript')
      }
      assertItemAtDeepestLevel({ targetSection: target, manuscriptSpineDepth: manuscript.spineDepth })
    }

    return manuscriptRepo.createItem(
      mid,
      userId,
      {
        title,
        itemType,
        sectionId,
        writingBlockId,
        structuralRole,
        summary: nullableText(input.summary, 'summary', 4000),
        orderIndex: typeof input.orderIndex === 'number' ? input.orderIndex : undefined,
      },
      isAdmin
    )
  },

  async updateItem(
    itemId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin: boolean = false
  ): Promise<ManuscriptItem> {
    const iid = ensureUuid(itemId, 'itemId')
    const updates: Parameters<typeof manuscriptRepo.updateItem>[2] = {}
    if (input.title !== undefined) {
      const t = sanitizeString(typeof input.title === 'string' ? input.title : '')
      if (!t) throw new ValidationError('Item title cannot be empty')
      if (t.length > 500) throw new ValidationError('Item title must be 500 characters or less')
      updates.title = t
    }
    if (input.itemType !== undefined) updates.itemType = ensureEnum(input.itemType, ITEM_TYPES, 'itemType')
    if (input.sectionId !== undefined) {
      const newSectionId = input.sectionId === null ? null : ensureUuid(String(input.sectionId), 'sectionId')
      // Items remain leaves under the deepest container. If the move
      // targets a section, it must be at manuscript.spineDepth — the
      // central invariant from the Configurable Spine Depth Refactor.
      if (newSectionId !== null) {
        const existingMid = await manuscriptRepo.findItemManuscriptId(iid)
        if (!existingMid) throw new NotFoundError('Item not found')
        const [manuscript, sections] = await Promise.all([
          manuscriptRepo.findById(existingMid, userId, isAdmin),
          manuscriptRepo.listSections(existingMid, userId, isAdmin),
        ])
        const target = sections.find(s => s.id === newSectionId) ?? null
        if (!target) {
          throw new ValidationError('sectionId must reference a section in the same manuscript')
        }
        assertItemAtDeepestLevel({ targetSection: target, manuscriptSpineDepth: manuscript.spineDepth })
      }
      updates.sectionId = newSectionId
    }
    if (input.writingBlockId !== undefined) {
      updates.writingBlockId = input.writingBlockId === null ? null : ensureUuid(String(input.writingBlockId), 'writingBlockId')
    }
    if (input.orderIndex !== undefined) {
      if (typeof input.orderIndex !== 'number' || !Number.isFinite(input.orderIndex)) {
        throw new ValidationError('orderIndex must be a number')
      }
      updates.orderIndex = Math.trunc(input.orderIndex)
    }
    if (input.structuralRole !== undefined) {
      updates.structuralRole = input.structuralRole === null ? null : ensureEnum(input.structuralRole, STRUCTURAL_ROLES, 'structuralRole')
    }
    if (input.summary !== undefined) updates.summary = nullableText(input.summary, 'summary', 4000)
    if (input.aiNotes !== undefined) updates.aiNotes = nullableText(input.aiNotes, 'aiNotes', 8000)

    return manuscriptRepo.updateItem(iid, userId, updates, isAdmin)
  },

  async deleteItem(itemId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    return manuscriptRepo.deleteItem(ensureUuid(itemId, 'itemId'), userId, isAdmin)
  },

  /**
   * Bulk reorder for drag-and-drop. Frontend sends the full set of items it has
   * touched with their new orderIndex (and optionally new sectionId).
   *
   * Items can only land in sections at the manuscript's deepest spine
   * level. We resolve the manuscript + sections once for the whole
   * batch (the cheap path) and assert each move's target section
   * against that — keeps depth-1 manuscripts fast (one extra round-trip
   * before the transactional write) and avoids per-move queries.
   */
  async reorderItems(
    manuscriptId: string,
    userId: string,
    moves: unknown,
    isAdmin: boolean = false
  ): Promise<ManuscriptItem[]> {
    if (!Array.isArray(moves)) {
      throw new ValidationError('moves must be an array')
    }
    const cleaned = moves.map((m, i) => {
      if (typeof m !== 'object' || m === null) {
        throw new ValidationError(`moves[${i}] must be an object`)
      }
      const obj = m as Record<string, unknown>
      const id = ensureUuid(String(obj.id), `moves[${i}].id`)
      if (typeof obj.orderIndex !== 'number' || !Number.isFinite(obj.orderIndex)) {
        throw new ValidationError(`moves[${i}].orderIndex must be a number`)
      }
      const out: { id: string; orderIndex: number; sectionId?: string | null } = {
        id,
        orderIndex: Math.trunc(obj.orderIndex),
      }
      if (obj.sectionId !== undefined) {
        out.sectionId = obj.sectionId === null ? null : ensureUuid(String(obj.sectionId), `moves[${i}].sectionId`)
      }
      return out
    })

    const mid = ensureUuid(manuscriptId, 'manuscriptId')

    // Validate cross-section moves up front. We only need this lookup
    // if at least one move targets a non-null sectionId — most reorders
    // within a single parent skip the network hop entirely.
    const movesWithNewSection = cleaned.filter(m => m.sectionId !== undefined && m.sectionId !== null)
    if (movesWithNewSection.length > 0) {
      const [manuscript, sections] = await Promise.all([
        manuscriptRepo.findById(mid, userId, isAdmin),
        manuscriptRepo.listSections(mid, userId, isAdmin),
      ])
      const byId = new Map(sections.map(s => [s.id, s]))
      for (const move of movesWithNewSection) {
        const target = byId.get(move.sectionId!) ?? null
        if (!target) {
          throw new ValidationError(`Item move targets section ${move.sectionId} which is not in this manuscript`)
        }
        assertItemAtDeepestLevel({ targetSection: target, manuscriptSpineDepth: manuscript.spineDepth })
      }
    }

    return manuscriptRepo.reorderItems(mid, userId, cleaned, isAdmin)
  },

  // ---------- spine layers ----------

  /**
   * Bulk reorder for sections — Phase 3 drag-and-drop. Each move may
   * change `orderIndex` (within current parent) and/or `parentSectionId`
   * (cross-parent moves). Level is NOT changed by reorder — the
   * receiving parent must be at the move's current level minus 1,
   * which keeps the tree's per-row level column consistent without
   * needing a re-walk after the write. Promotions / demotions across
   * levels go through the add/remove layer flow instead.
   */
  async reorderSections(
    manuscriptId: string,
    userId: string,
    moves: unknown,
    isAdmin: boolean = false
  ): Promise<ManuscriptSection[]> {
    if (!Array.isArray(moves)) {
      throw new ValidationError('moves must be an array')
    }
    const mid = ensureUuid(manuscriptId, 'manuscriptId')
    const cleaned: { id: string; orderIndex: number; parentSectionId?: string | null }[] = moves.map((m, i) => {
      if (typeof m !== 'object' || m === null) {
        throw new ValidationError(`moves[${i}] must be an object`)
      }
      const obj = m as Record<string, unknown>
      const id = ensureUuid(String(obj.id), `moves[${i}].id`)
      if (typeof obj.orderIndex !== 'number' || !Number.isFinite(obj.orderIndex)) {
        throw new ValidationError(`moves[${i}].orderIndex must be a number`)
      }
      const out: { id: string; orderIndex: number; parentSectionId?: string | null } = {
        id,
        orderIndex: Math.trunc(obj.orderIndex),
      }
      if (obj.parentSectionId !== undefined) {
        out.parentSectionId = obj.parentSectionId === null
          ? null
          : ensureUuid(String(obj.parentSectionId), `moves[${i}].parentSectionId`)
      }
      return out
    })

    // Validate cross-parent moves: the receiving parent must be at the
    // moved section's level - 1 (or null for a move to top-level by a
    // current level-1 section, which is a no-op). Sections cannot
    // promote/demote via reorder — use add/remove layer for that.
    const reparenting = cleaned.filter(m => m.parentSectionId !== undefined)
    if (reparenting.length > 0) {
      const sections = await manuscriptRepo.listSections(mid, userId, isAdmin)
      const byId = new Map(sections.map(s => [s.id, s]))
      for (const move of reparenting) {
        const current = byId.get(move.id)
        if (!current) {
          throw new ValidationError(`Section ${move.id} does not belong to this manuscript`)
        }
        if (move.parentSectionId === null) {
          if (current.level !== 1) {
            throw new ValidationError(
              `Cannot move section ${move.id} (level ${current.level}) to top-level via reorder — use the remove-layer flow`,
            )
          }
        } else {
          // TS doesn't carry the filter narrowing through; we already
          // ruled out undefined via the outer filter and null via the
          // branch above.
          const newParentId = move.parentSectionId as string
          const newParent = byId.get(newParentId)
          if (!newParent) {
            throw new ValidationError(`Section ${move.id} targets a non-existent parent`)
          }
          if (newParent.level !== current.level - 1) {
            throw new ValidationError(
              `Cannot move section ${move.id} (level ${current.level}) under parent at level ${newParent.level}; ` +
              `parent must be at level ${current.level - 1}`,
            )
          }
          // No cycles: a section cannot become a child of one of its
          // descendants. Walk up from the proposed parent.
          let walker: ManuscriptSection | undefined = newParent
          const visited = new Set<string>()
          while (walker) {
            if (walker.id === move.id) {
              throw new ValidationError(`Cannot move section ${move.id} under one of its own descendants`)
            }
            if (visited.has(walker.id)) break
            visited.add(walker.id)
            walker = walker.parentSectionId ? byId.get(walker.parentSectionId) : undefined
          }
        }
      }
    }

    return manuscriptRepo.reorderSections(mid, userId, cleaned, isAdmin)
  },

  /**
   * Add a layer above the current top of the spine (wrap_above policy).
   * Every existing top-level section becomes a child of a single new
   * parent named `label`; `label` is prepended to spineLayerLabels;
   * spineDepth grows by 1. Non-destructive and reversible via
   * removeSpineLayer(1).
   *
   * Throws ValidationError when the label is empty or too long, or
   * when spineDepth is already at MAX_SPINE_DEPTH.
   */
  async addSpineLayer(
    manuscriptId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin: boolean = false
  ): Promise<ManuscriptWithSpine> {
    const mid = ensureUuid(manuscriptId, 'manuscriptId')

    // Today only one policy exists; keeping the field on the wire so
    // future policies (e.g. wrap-around-selection) don't need an
    // endpoint rename.
    const policy = input.policy === undefined ? 'wrap_above' : input.policy
    if (policy !== 'wrap_above') {
      throw new ValidationError(`Unsupported add-layer policy: ${String(policy)}`)
    }

    const label = sanitizeString(typeof input.label === 'string' ? input.label : '')
    if (!label) throw new ValidationError('Layer label is required')

    // Load the manuscript + current sections, plan the mutation, then
    // commit. Read access is enforced by listSections; the repo's
    // applySpineLayerPlan enforces write access.
    const [manuscript, sections] = await Promise.all([
      manuscriptRepo.findById(mid, userId, isAdmin),
      manuscriptRepo.listSections(mid, userId, isAdmin),
    ])
    const plan = planWrapAbove({
      sections,
      currentSpineDepth: manuscript.spineDepth,
      currentLabels: manuscript.spineLayerLabels,
      label,
    })
    const { manuscript: updated, sections: updatedSections } =
      await manuscriptRepo.applySpineLayerPlan(mid, userId, plan, isAdmin)
    const items = await manuscriptRepo.listItems(mid, userId, isAdmin)
    return {
      manuscript: updated,
      sections: updatedSections,
      items,
      sectionTree: buildSectionTree(updatedSections),
    }
  },

  /**
   * Remove the given spine layer (flatten_to_grandparent policy).
   * Children of removed-layer nodes are promoted to their grandparent
   * in original reading order; the label at index `level - 1` is
   * dropped from spineLayerLabels; spineDepth shrinks by 1.
   *
   * Refuses to remove the deepest layer when any item is attached
   * (would orphan the item); the UI surfaces this error and asks the
   * user to move items first.
   */
  async removeSpineLayer(
    manuscriptId: string,
    userId: string,
    level: number,
    isAdmin: boolean = false
  ): Promise<ManuscriptWithSpine> {
    if (!Number.isInteger(level) || level < 1) {
      throw new ValidationError('level must be a positive integer')
    }
    const mid = ensureUuid(manuscriptId, 'manuscriptId')
    const [manuscript, sections, items] = await Promise.all([
      manuscriptRepo.findById(mid, userId, isAdmin),
      manuscriptRepo.listSections(mid, userId, isAdmin),
      manuscriptRepo.listItems(mid, userId, isAdmin),
    ])
    const plan = planFlattenLevel({
      sections,
      items,
      currentSpineDepth: manuscript.spineDepth,
      currentLabels: manuscript.spineLayerLabels,
      level,
    })
    const { manuscript: updated, sections: updatedSections } =
      await manuscriptRepo.applySpineLayerPlan(mid, userId, plan, isAdmin)
    const updatedItems = await manuscriptRepo.listItems(mid, userId, isAdmin)
    return {
      manuscript: updated,
      sections: updatedSections,
      items: updatedItems,
      sectionTree: buildSectionTree(updatedSections),
    }
  },
}
