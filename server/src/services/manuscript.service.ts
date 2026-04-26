import { manuscriptRepo } from '../repositories/manuscript.repo.js'
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
import { sanitizeString } from '../utils/sanitize.js'
import { ValidationError } from '../utils/errors.js'

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
   * Convenience for the Book Room view: fetch the manuscript along with its
   * full ordered spine in one call.
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
    return { manuscript, sections, items }
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
    const title = sanitizeString(typeof input.title === 'string' ? input.title : '')
    if (!title) throw new ValidationError('Section title is required')
    if (title.length > 255) throw new ValidationError('Section title must be 255 characters or less')

    const purpose = input.purpose === undefined
      ? 'unassigned' as const
      : ensureEnum(input.purpose, SECTION_PURPOSES, 'purpose')

    return manuscriptRepo.createSection(
      ensureUuid(manuscriptId, 'manuscriptId'),
      userId,
      {
        title,
        purpose,
        notes: nullableText(input.notes, 'notes', 4000),
        orderIndex: typeof input.orderIndex === 'number' ? input.orderIndex : undefined,
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

    return manuscriptRepo.updateSection(ensureUuid(sectionId, 'sectionId'), userId, updates, isAdmin)
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

    return manuscriptRepo.createItem(
      ensureUuid(manuscriptId, 'manuscriptId'),
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
    const updates: Parameters<typeof manuscriptRepo.updateItem>[2] = {}
    if (input.title !== undefined) {
      const t = sanitizeString(typeof input.title === 'string' ? input.title : '')
      if (!t) throw new ValidationError('Item title cannot be empty')
      if (t.length > 500) throw new ValidationError('Item title must be 500 characters or less')
      updates.title = t
    }
    if (input.itemType !== undefined) updates.itemType = ensureEnum(input.itemType, ITEM_TYPES, 'itemType')
    if (input.sectionId !== undefined) {
      updates.sectionId = input.sectionId === null ? null : ensureUuid(String(input.sectionId), 'sectionId')
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

    return manuscriptRepo.updateItem(ensureUuid(itemId, 'itemId'), userId, updates, isAdmin)
  },

  async deleteItem(itemId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    return manuscriptRepo.deleteItem(ensureUuid(itemId, 'itemId'), userId, isAdmin)
  },

  /**
   * Bulk reorder for drag-and-drop. Frontend sends the full set of items it has
   * touched with their new orderIndex (and optionally new sectionId).
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

    return manuscriptRepo.reorderItems(ensureUuid(manuscriptId, 'manuscriptId'), userId, cleaned, isAdmin)
  },
}
