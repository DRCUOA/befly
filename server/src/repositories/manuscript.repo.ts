import { pool } from '../config/db.js'
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
} from '../models/Manuscript.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'

/**
 * Manuscript repository - thin DAO layer.
 *
 * Visibility/ownership rules mirror themes:
 *   - read access: own manuscript, OR visibility in (shared, public), OR isAdmin
 *   - write access: own manuscript, OR isAdmin
 *
 * Section/item access is derived from the parent manuscript via assertAccess().
 *
 * No defensive "column might not exist" branches here - migration 016 is the
 * starting point for these tables, so the schema is always present when this
 * repo runs.
 */

const PROJECT_COLUMNS = `
  id,
  user_id           AS "userId",
  title,
  working_subtitle  AS "workingSubtitle",
  form,
  status,
  intended_reader   AS "intendedReader",
  central_question  AS "centralQuestion",
  through_line      AS "throughLine",
  emotional_arc     AS "emotionalArc",
  narrative_promise AS "narrativePromise",
  visibility,
  created_at        AS "createdAt",
  updated_at        AS "updatedAt"
`

const SECTION_COLUMNS = `
  id,
  manuscript_id  AS "manuscriptId",
  title,
  order_index    AS "orderIndex",
  purpose,
  notes,
  created_at     AS "createdAt",
  updated_at     AS "updatedAt"
`

const ITEM_COLUMNS = `
  id,
  manuscript_id     AS "manuscriptId",
  section_id        AS "sectionId",
  writing_block_id  AS "writingBlockId",
  item_type         AS "itemType",
  title,
  order_index       AS "orderIndex",
  structural_role   AS "structuralRole",
  summary,
  ai_notes          AS "aiNotes",
  created_at        AS "createdAt",
  updated_at        AS "updatedAt"
`

type AccessMode = 'read' | 'write'

async function loadSourceThemeIds(manuscriptIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (manuscriptIds.length === 0) return map
  const result = await pool.query(
    `SELECT manuscript_id, theme_id FROM manuscript_themes WHERE manuscript_id = ANY($1::uuid[])`,
    [manuscriptIds]
  )
  for (const row of result.rows) {
    const list = map.get(row.manuscript_id) ?? []
    list.push(row.theme_id)
    map.set(row.manuscript_id, list)
  }
  return map
}

function attachSourceThemes<T extends { id: string }>(
  rows: T[],
  themeMap: Map<string, string[]>
): (T & { sourceThemeIds: string[] })[] {
  return rows.map(row => ({
    ...row,
    sourceThemeIds: themeMap.get(row.id) ?? []
  }))
}

async function replaceSourceThemes(manuscriptId: string, themeIds: string[]): Promise<void> {
  // Replace the full set in a single round-trip pair so the junction always reflects
  // the desired state. Caller is responsible for validating that themeIds are real.
  await pool.query('DELETE FROM manuscript_themes WHERE manuscript_id = $1', [manuscriptId])
  if (themeIds.length === 0) return
  // Build a multi-row INSERT with positional params.
  const values: string[] = []
  const params: unknown[] = [manuscriptId]
  themeIds.forEach((tid, i) => {
    values.push(`($1, $${i + 2})`)
    params.push(tid)
  })
  await pool.query(
    `INSERT INTO manuscript_themes (manuscript_id, theme_id) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
    params
  )
}

/**
 * Internal: confirm the caller may read or write the given manuscript.
 * Returns the row's user_id and visibility for callers that need it.
 */
async function assertAccess(
  manuscriptId: string,
  userId: string | null,
  isAdmin: boolean,
  mode: AccessMode
): Promise<{ ownerId: string; visibility: ManuscriptVisibility }> {
  const result = await pool.query(
    `SELECT user_id, visibility FROM manuscript_projects WHERE id = $1`,
    [manuscriptId]
  )
  if (result.rows.length === 0) {
    throw new NotFoundError('Manuscript not found')
  }
  const ownerId: string = result.rows[0].user_id
  const visibility: ManuscriptVisibility = result.rows[0].visibility

  if (isAdmin) return { ownerId, visibility }

  if (mode === 'read') {
    if (userId && ownerId === userId) return { ownerId, visibility }
    if (visibility === 'shared' || visibility === 'public') return { ownerId, visibility }
    throw new NotFoundError('Manuscript not found') // hide existence
  }

  // write
  if (!userId) throw new ForbiddenError('Not authorized to modify this manuscript')
  if (ownerId !== userId) throw new ForbiddenError('Not authorized to modify this manuscript')
  return { ownerId, visibility }
}

export const manuscriptRepo = {
  // ---------- projects ----------

  async findAll(userId: string | null, isAdmin: boolean = false): Promise<ManuscriptProject[]> {
    let query: string
    let params: unknown[]
    if (isAdmin) {
      query = `SELECT ${PROJECT_COLUMNS} FROM manuscript_projects ORDER BY updated_at DESC`
      params = []
    } else if (userId) {
      query = `
        SELECT ${PROJECT_COLUMNS} FROM manuscript_projects
        WHERE user_id = $1 OR visibility IN ('shared', 'public')
        ORDER BY updated_at DESC
      `
      params = [userId]
    } else {
      query = `
        SELECT ${PROJECT_COLUMNS} FROM manuscript_projects
        WHERE visibility = 'public'
        ORDER BY updated_at DESC
      `
      params = []
    }
    const result = await pool.query(query, params)
    const themeMap = await loadSourceThemeIds(result.rows.map((r: any) => r.id))
    return attachSourceThemes(result.rows, themeMap) as ManuscriptProject[]
  },

  async findById(id: string, userId: string | null, isAdmin: boolean = false): Promise<ManuscriptProject> {
    await assertAccess(id, userId, isAdmin, 'read')
    const result = await pool.query(
      `SELECT ${PROJECT_COLUMNS} FROM manuscript_projects WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) throw new NotFoundError('Manuscript not found')
    const themeMap = await loadSourceThemeIds([id])
    return attachSourceThemes(result.rows, themeMap)[0] as ManuscriptProject
  },

  async create(input: {
    userId: string
    title: string
    workingSubtitle?: string | null
    form: ManuscriptForm
    status?: ManuscriptStatus
    intendedReader?: string | null
    centralQuestion?: string | null
    throughLine?: string | null
    emotionalArc?: string | null
    narrativePromise?: string | null
    visibility?: ManuscriptVisibility
    sourceThemeIds?: string[]
  }): Promise<ManuscriptProject> {
    const result = await pool.query(
      `INSERT INTO manuscript_projects (
         user_id, title, working_subtitle,
         form, status,
         intended_reader, central_question, through_line, emotional_arc, narrative_promise,
         visibility
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${PROJECT_COLUMNS}`,
      [
        input.userId,
        input.title,
        input.workingSubtitle ?? null,
        input.form,
        input.status ?? 'gathering',
        input.intendedReader ?? null,
        input.centralQuestion ?? null,
        input.throughLine ?? null,
        input.emotionalArc ?? null,
        input.narrativePromise ?? null,
        input.visibility ?? 'private',
      ]
    )
    const project = result.rows[0]
    const themeIds = input.sourceThemeIds ?? []
    if (themeIds.length > 0) {
      await replaceSourceThemes(project.id, themeIds)
    }
    return { ...project, sourceThemeIds: themeIds }
  },

  async update(
    id: string,
    userId: string,
    updates: Partial<{
      title: string
      workingSubtitle: string | null
      form: ManuscriptForm
      status: ManuscriptStatus
      intendedReader: string | null
      centralQuestion: string | null
      throughLine: string | null
      emotionalArc: string | null
      narrativePromise: string | null
      visibility: ManuscriptVisibility
      sourceThemeIds: string[]
    }>,
    isAdmin: boolean = false
  ): Promise<ManuscriptProject> {
    await assertAccess(id, userId, isAdmin, 'write')

    const fields: string[] = []
    const values: unknown[] = []
    let i = 1
    const set = (col: string, val: unknown) => {
      fields.push(`${col} = $${i++}`)
      values.push(val)
    }

    if (updates.title !== undefined) set('title', updates.title)
    if (updates.workingSubtitle !== undefined) set('working_subtitle', updates.workingSubtitle)
    if (updates.form !== undefined) set('form', updates.form)
    if (updates.status !== undefined) set('status', updates.status)
    if (updates.intendedReader !== undefined) set('intended_reader', updates.intendedReader)
    if (updates.centralQuestion !== undefined) set('central_question', updates.centralQuestion)
    if (updates.throughLine !== undefined) set('through_line', updates.throughLine)
    if (updates.emotionalArc !== undefined) set('emotional_arc', updates.emotionalArc)
    if (updates.narrativePromise !== undefined) set('narrative_promise', updates.narrativePromise)
    if (updates.visibility !== undefined) set('visibility', updates.visibility)

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`)
      values.push(id)
      await pool.query(
        `UPDATE manuscript_projects SET ${fields.join(', ')} WHERE id = $${i}`,
        values
      )
    }

    if (updates.sourceThemeIds !== undefined) {
      await replaceSourceThemes(id, updates.sourceThemeIds)
    }

    return this.findById(id, userId, isAdmin)
  },

  async delete(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await assertAccess(id, userId, isAdmin, 'write')
    const result = await pool.query('DELETE FROM manuscript_projects WHERE id = $1', [id])
    if (result.rowCount === 0) throw new NotFoundError('Manuscript not found')
  },

  // ---------- sections ----------

  async listSections(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<ManuscriptSection[]> {
    await assertAccess(manuscriptId, userId, isAdmin, 'read')
    const result = await pool.query(
      `SELECT ${SECTION_COLUMNS} FROM manuscript_sections
       WHERE manuscript_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [manuscriptId]
    )
    return result.rows
  },

  async createSection(
    manuscriptId: string,
    userId: string,
    input: {
      title: string
      orderIndex?: number
      purpose?: ManuscriptSectionPurpose
      notes?: string | null
    },
    isAdmin: boolean = false
  ): Promise<ManuscriptSection> {
    await assertAccess(manuscriptId, userId, isAdmin, 'write')
    // If no orderIndex supplied, append to the end.
    let orderIndex = input.orderIndex
    if (orderIndex === undefined) {
      const tail = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) AS max FROM manuscript_sections WHERE manuscript_id = $1`,
        [manuscriptId]
      )
      orderIndex = (tail.rows[0].max as number) + 1
    }
    const result = await pool.query(
      `INSERT INTO manuscript_sections (manuscript_id, title, order_index, purpose, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SECTION_COLUMNS}`,
      [manuscriptId, input.title, orderIndex, input.purpose ?? 'unassigned', input.notes ?? null]
    )
    return result.rows[0]
  },

  async updateSection(
    sectionId: string,
    userId: string,
    updates: Partial<{
      title: string
      orderIndex: number
      purpose: ManuscriptSectionPurpose
      notes: string | null
    }>,
    isAdmin: boolean = false
  ): Promise<ManuscriptSection> {
    const owner = await pool.query(
      `SELECT manuscript_id FROM manuscript_sections WHERE id = $1`,
      [sectionId]
    )
    if (owner.rows.length === 0) throw new NotFoundError('Section not found')
    await assertAccess(owner.rows[0].manuscript_id, userId, isAdmin, 'write')

    const fields: string[] = []
    const values: unknown[] = []
    let i = 1
    if (updates.title !== undefined) { fields.push(`title = $${i++}`); values.push(updates.title) }
    if (updates.orderIndex !== undefined) { fields.push(`order_index = $${i++}`); values.push(updates.orderIndex) }
    if (updates.purpose !== undefined) { fields.push(`purpose = $${i++}`); values.push(updates.purpose) }
    if (updates.notes !== undefined) { fields.push(`notes = $${i++}`); values.push(updates.notes) }
    if (fields.length === 0) {
      const out = await pool.query(`SELECT ${SECTION_COLUMNS} FROM manuscript_sections WHERE id = $1`, [sectionId])
      return out.rows[0]
    }
    fields.push(`updated_at = NOW()`)
    values.push(sectionId)
    const result = await pool.query(
      `UPDATE manuscript_sections SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SECTION_COLUMNS}`,
      values
    )
    return result.rows[0]
  },

  async deleteSection(sectionId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const owner = await pool.query(
      `SELECT manuscript_id FROM manuscript_sections WHERE id = $1`,
      [sectionId]
    )
    if (owner.rows.length === 0) throw new NotFoundError('Section not found')
    await assertAccess(owner.rows[0].manuscript_id, userId, isAdmin, 'write')
    // Items in this section will have their section_id set to NULL by the FK rule.
    await pool.query('DELETE FROM manuscript_sections WHERE id = $1', [sectionId])
  },

  // ---------- items ----------

  async listItems(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<ManuscriptItem[]> {
    await assertAccess(manuscriptId, userId, isAdmin, 'read')
    const result = await pool.query(
      `SELECT ${ITEM_COLUMNS} FROM manuscript_items
       WHERE manuscript_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [manuscriptId]
    )
    return result.rows
  },

  /**
   * Like listItems, but joins writing_blocks so essay bodies come back in the
   * same round-trip. Used by the export path. Kept separate from listItems so
   * the Book Room view doesn't pay the cost of dragging full essay text around
   * just to render the spine.
   *
   * Returned shape adds a `body` field on items whose writing_block_id resolves
   * to a still-existing block; null otherwise (e.g. placeholder, bridge,
   * orphaned essay link).
   */
  async listItemsWithBodies(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<(ManuscriptItem & { body: string | null })[]> {
    await assertAccess(manuscriptId, userId, isAdmin, 'read')
    // Columns are qualified with mi. because writing_blocks has overlapping
    // names (id, title, created_at, updated_at) that would otherwise be
    // ambiguous in the JOIN.
    const result = await pool.query(
      `SELECT
         mi.id,
         mi.manuscript_id     AS "manuscriptId",
         mi.section_id        AS "sectionId",
         mi.writing_block_id  AS "writingBlockId",
         mi.item_type         AS "itemType",
         mi.title,
         mi.order_index       AS "orderIndex",
         mi.structural_role   AS "structuralRole",
         mi.summary,
         mi.ai_notes          AS "aiNotes",
         mi.created_at        AS "createdAt",
         mi.updated_at        AS "updatedAt",
         w.body               AS body
       FROM manuscript_items mi
       LEFT JOIN writing_blocks w ON w.id = mi.writing_block_id
       WHERE mi.manuscript_id = $1
       ORDER BY mi.order_index ASC, mi.created_at ASC`,
      [manuscriptId]
    )
    return result.rows
  },

  async createItem(
    manuscriptId: string,
    userId: string,
    input: {
      title: string
      itemType?: ManuscriptItemType
      sectionId?: string | null
      writingBlockId?: string | null
      orderIndex?: number
      structuralRole?: ManuscriptStructuralRole | null
      summary?: string | null
    },
    isAdmin: boolean = false
  ): Promise<ManuscriptItem> {
    await assertAccess(manuscriptId, userId, isAdmin, 'write')
    let orderIndex = input.orderIndex
    if (orderIndex === undefined) {
      const tail = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) AS max FROM manuscript_items WHERE manuscript_id = $1`,
        [manuscriptId]
      )
      orderIndex = (tail.rows[0].max as number) + 1
    }
    const result = await pool.query(
      `INSERT INTO manuscript_items
         (manuscript_id, section_id, writing_block_id, item_type, title, order_index, structural_role, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${ITEM_COLUMNS}`,
      [
        manuscriptId,
        input.sectionId ?? null,
        input.writingBlockId ?? null,
        input.itemType ?? 'essay',
        input.title,
        orderIndex,
        input.structuralRole ?? null,
        input.summary ?? null,
      ]
    )
    return result.rows[0]
  },

  async updateItem(
    itemId: string,
    userId: string,
    updates: Partial<{
      title: string
      itemType: ManuscriptItemType
      sectionId: string | null
      writingBlockId: string | null
      orderIndex: number
      structuralRole: ManuscriptStructuralRole | null
      summary: string | null
      aiNotes: string | null
    }>,
    isAdmin: boolean = false
  ): Promise<ManuscriptItem> {
    const owner = await pool.query(
      `SELECT manuscript_id FROM manuscript_items WHERE id = $1`,
      [itemId]
    )
    if (owner.rows.length === 0) throw new NotFoundError('Item not found')
    await assertAccess(owner.rows[0].manuscript_id, userId, isAdmin, 'write')

    const fields: string[] = []
    const values: unknown[] = []
    let i = 1
    if (updates.title !== undefined) { fields.push(`title = $${i++}`); values.push(updates.title) }
    if (updates.itemType !== undefined) { fields.push(`item_type = $${i++}`); values.push(updates.itemType) }
    if (updates.sectionId !== undefined) { fields.push(`section_id = $${i++}`); values.push(updates.sectionId) }
    if (updates.writingBlockId !== undefined) { fields.push(`writing_block_id = $${i++}`); values.push(updates.writingBlockId) }
    if (updates.orderIndex !== undefined) { fields.push(`order_index = $${i++}`); values.push(updates.orderIndex) }
    if (updates.structuralRole !== undefined) { fields.push(`structural_role = $${i++}`); values.push(updates.structuralRole) }
    if (updates.summary !== undefined) { fields.push(`summary = $${i++}`); values.push(updates.summary) }
    if (updates.aiNotes !== undefined) { fields.push(`ai_notes = $${i++}`); values.push(updates.aiNotes) }

    if (fields.length === 0) {
      const out = await pool.query(`SELECT ${ITEM_COLUMNS} FROM manuscript_items WHERE id = $1`, [itemId])
      return out.rows[0]
    }
    fields.push(`updated_at = NOW()`)
    values.push(itemId)
    const result = await pool.query(
      `UPDATE manuscript_items SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${ITEM_COLUMNS}`,
      values
    )
    return result.rows[0]
  },

  async deleteItem(itemId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const owner = await pool.query(
      `SELECT manuscript_id FROM manuscript_items WHERE id = $1`,
      [itemId]
    )
    if (owner.rows.length === 0) throw new NotFoundError('Item not found')
    await assertAccess(owner.rows[0].manuscript_id, userId, isAdmin, 'write')
    await pool.query('DELETE FROM manuscript_items WHERE id = $1', [itemId])
  },

  /**
   * Bulk reorder for drag-and-drop. Atomically updates order_index (and optionally
   * section_id) for many items in one transaction. The frontend sends the full
   * desired ordering; we trust that and rewrite. All items must belong to the
   * given manuscript.
   */
  async reorderItems(
    manuscriptId: string,
    userId: string,
    moves: { id: string; orderIndex: number; sectionId?: string | null }[],
    isAdmin: boolean = false
  ): Promise<ManuscriptItem[]> {
    await assertAccess(manuscriptId, userId, isAdmin, 'write')
    if (moves.length === 0) return this.listItems(manuscriptId, userId, isAdmin)

    const ids = moves.map(m => m.id)
    const owns = await pool.query(
      `SELECT id FROM manuscript_items WHERE manuscript_id = $1 AND id = ANY($2::uuid[])`,
      [manuscriptId, ids]
    )
    if (owns.rows.length !== ids.length) {
      throw new ForbiddenError('Some items do not belong to this manuscript')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const move of moves) {
        if (move.sectionId !== undefined) {
          await client.query(
            `UPDATE manuscript_items
             SET order_index = $1, section_id = $2, updated_at = NOW()
             WHERE id = $3`,
            [move.orderIndex, move.sectionId, move.id]
          )
        } else {
          await client.query(
            `UPDATE manuscript_items
             SET order_index = $1, updated_at = NOW()
             WHERE id = $2`,
            [move.orderIndex, move.id]
          )
        }
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return this.listItems(manuscriptId, userId, isAdmin)
  },
}
