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
  SpineNode,
} from '../models/Manuscript.js'
import type { SpineLayerPlan } from '../services/spine-layer.js'
import { WRAP_ABOVE_NEW_PARENT } from '../services/spine-layer.js'
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
  user_id            AS "userId",
  title,
  working_subtitle   AS "workingSubtitle",
  form,
  status,
  intended_reader    AS "intendedReader",
  central_question   AS "centralQuestion",
  through_line       AS "throughLine",
  emotional_arc      AS "emotionalArc",
  narrative_promise  AS "narrativePromise",
  visibility,
  spine_depth        AS "spineDepth",
  spine_layer_labels AS "spineLayerLabels",
  created_at         AS "createdAt",
  updated_at         AS "updatedAt"
`

// parent_section_id is NULL for any section that sits at the top of the
// spine (level === 1). level is 1..manuscript.spineDepth and is
// denormalised from parent_section_id so consumers can paginate without
// recursive joins. Phase 2 surfaces both fields read-only; the service
// layer's parent-tracking + level invariants land in Phase 3.
const SECTION_COLUMNS = `
  id,
  manuscript_id      AS "manuscriptId",
  title,
  order_index        AS "orderIndex",
  purpose,
  notes,
  parent_section_id  AS "parentSectionId",
  level,
  created_at         AS "createdAt",
  updated_at         AS "updatedAt"
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

/**
 * Assemble a SpineNode forest from a flat section list ordered by
 * (order_index, created_at). Exported so service-layer code and tests
 * can build the same tree from sections fetched through other paths
 * (e.g. an already-loaded list, an export pipeline) without re-hitting
 * the database.
 *
 * Sections whose `parentSectionId` points at an ID not in the input
 * list become roots — a defensive fallback for rows that survive a
 * partial cascade. The input order is preserved at every level: rows
 * arrive in the desired sibling order, so we just push as we go.
 */
export function buildSectionTree(sections: ManuscriptSection[]): SpineNode[] {
  const byId = new Map<string, SpineNode>()
  for (const s of sections) byId.set(s.id, { section: s, children: [] })

  const roots: SpineNode[] = []
  for (const s of sections) {
    const node = byId.get(s.id)!
    const parentId = s.parentSectionId
    const parent = parentId ? byId.get(parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

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

  /**
   * Find the manuscript that contains a given writing-block, if any. Returns
   * the project plus a lightweight list of sibling items (other essays /
   * placeholders in the same spine, with a one-line summary derived from
   * either the item's writer-set summary or the first paragraph of the
   * essay body). Used by writing-assist's coherence mode so the model can
   * answer character-arc / cross-chapter questions with real context.
   *
   * Returns null if the writing-block is not part of any manuscript the
   * caller can read. Visibility is enforced via assertAccess on the
   * containing manuscript before any sibling rows are returned.
   */
  async findContextForWriting(
    writingBlockId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<{
    manuscript: ManuscriptProject
    siblings: { itemId: string; title: string; summary: string }[]
  } | null> {
    // Step 1: locate the manuscript via the items table.
    const lookup = await pool.query(
      `SELECT manuscript_id AS "manuscriptId"
         FROM manuscript_items
        WHERE writing_block_id = $1
        LIMIT 1`,
      [writingBlockId]
    )
    if (lookup.rows.length === 0) return null
    const manuscriptId = lookup.rows[0].manuscriptId as string

    // Step 2: enforce read access on the containing manuscript. Throws
    // ForbiddenError if the caller can't see it; we surface that as null
    // so coherence falls back to "no manuscript context" rather than a 403.
    try {
      await assertAccess(manuscriptId, userId, isAdmin, 'read')
    } catch {
      return null
    }

    // Step 3: load the manuscript itself.
    const projectResult = await pool.query(
      `SELECT ${PROJECT_COLUMNS} FROM manuscript_projects WHERE id = $1`,
      [manuscriptId]
    )
    if (projectResult.rows.length === 0) return null
    const themeMap = await loadSourceThemeIds([manuscriptId])
    const manuscript = attachSourceThemes(projectResult.rows, themeMap)[0] as ManuscriptProject

    // Step 4: load sibling items. We deliberately use the writer's summary
    // when present and fall back to the first ~280 chars of essay body —
    // never the full body, because coherence prompts can pull in many
    // siblings and we'd blow the token budget otherwise.
    const siblingResult = await pool.query(
      `SELECT
         mi.id          AS "itemId",
         mi.title,
         mi.summary,
         w.body         AS "body"
       FROM manuscript_items mi
       LEFT JOIN writing_blocks w ON w.id = mi.writing_block_id
       WHERE mi.manuscript_id = $1
         AND (mi.writing_block_id IS NULL OR mi.writing_block_id != $2)
       ORDER BY mi.order_index ASC, mi.created_at ASC
       LIMIT 30`,
      [manuscriptId, writingBlockId]
    )

    const siblings = siblingResult.rows.map((r: { itemId: string; title: string; summary: string | null; body: string | null }) => {
      const summary = r.summary?.trim()
        || r.body?.trim().split(/\n\s*\n/, 1)[0]?.slice(0, 280)
        || '(no summary or body yet)'
      return { itemId: r.itemId, title: r.title, summary }
    })

    return { manuscript, siblings }
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

  /**
   * Lightweight lookup: given a sectionId, return the manuscript_id it
   * belongs to, or null if the section does not exist. Used by the
   * service layer to resolve a section's parent manuscript before
   * running visibility checks. Visibility itself is enforced by the
   * caller via assertAccess on the returned manuscript_id.
   */
  async findSectionManuscriptId(sectionId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT manuscript_id FROM manuscript_sections WHERE id = $1`,
      [sectionId]
    )
    return result.rows.length > 0 ? (result.rows[0].manuscript_id as string) : null
  },

  /**
   * Symmetric lookup for items: resolve an item's manuscript_id so the
   * service can validate moves (e.g. section_id changes must target a
   * section in the same manuscript at the deepest spine level).
   */
  async findItemManuscriptId(itemId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT manuscript_id FROM manuscript_items WHERE id = $1`,
      [itemId]
    )
    return result.rows.length > 0 ? (result.rows[0].manuscript_id as string) : null
  },

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

  /**
   * Tree view of the section spine. Returns SpineNode[] rooted at the
   * top-level sections (parent_section_id IS NULL), with `children`
   * populated recursively by walking parent_section_id. Sibling order
   * is `order_index ASC, created_at ASC` at every level, matching the
   * flat `listSections()` ordering.
   *
   * Coexists with `listSections()`: the Book Room view that already
   * exists keeps using the flat list and sees level=1 / parentSectionId=
   * null on every row (depth=1 manuscripts are byte-identical to before).
   * Phase 5's depth-aware renderer will consume this tree instead.
   *
   * Implementation note: we fetch all sections for the manuscript in one
   * query and assemble the tree in memory rather than issuing one query
   * per level. Max depth is 4 (MAX_SPINE_DEPTH), so most manuscripts have
   * fewer than ~50 sections and one round-trip beats four. Orphaned
   * children (parent_section_id pointing at a section that does not
   * exist or belongs to another manuscript) are surfaced as roots so the
   * tree stays a forest, not a partial graph. ON DELETE CASCADE on the
   * parent FK should keep this case empty in practice; the fallback
   * exists so a corrupt row can never hide from the user.
   */
  async listSectionTree(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<SpineNode[]> {
    const sections = await this.listSections(manuscriptId, userId, isAdmin)
    return buildSectionTree(sections)
  },

  async createSection(
    manuscriptId: string,
    userId: string,
    input: {
      title: string
      orderIndex?: number
      purpose?: ManuscriptSectionPurpose
      notes?: string | null
      /** Parent section for nested spines; NULL means top-level (level=1). */
      parentSectionId?: string | null
      /**
       * Level the new row should land at. Caller is responsible for
       * ensuring this matches `parent.level + 1` (or 1 for a root) and
       * stays within MAX_SPINE_DEPTH / the manuscript's spineDepth.
       * The service's computeSectionLevel() enforces those rules.
       */
      level?: number
    },
    isAdmin: boolean = false
  ): Promise<ManuscriptSection> {
    await assertAccess(manuscriptId, userId, isAdmin, 'write')
    // If no orderIndex supplied, append to the end of the section's
    // sibling group (within the same parent). Sparse integers are fine.
    let orderIndex = input.orderIndex
    if (orderIndex === undefined) {
      const tail = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) AS max FROM manuscript_sections
          WHERE manuscript_id = $1
            AND parent_section_id IS NOT DISTINCT FROM $2`,
        [manuscriptId, input.parentSectionId ?? null]
      )
      orderIndex = (tail.rows[0].max as number) + 1
    }
    const result = await pool.query(
      `INSERT INTO manuscript_sections
         (manuscript_id, title, order_index, purpose, notes, parent_section_id, level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SECTION_COLUMNS}`,
      [
        manuscriptId,
        input.title,
        orderIndex,
        input.purpose ?? 'unassigned',
        input.notes ?? null,
        input.parentSectionId ?? null,
        input.level ?? 1,
      ]
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
      /**
       * Reparent the section. NULL promotes to top-level (level=1).
       * Caller is responsible for keeping `level` consistent with the
       * new parent — typically the service computes it via
       * computeSectionLevel() and passes both in the same update.
       */
      parentSectionId: string | null
      level: number
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
    if (updates.parentSectionId !== undefined) { fields.push(`parent_section_id = $${i++}`); values.push(updates.parentSectionId) }
    if (updates.level !== undefined) { fields.push(`level = $${i++}`); values.push(updates.level) }
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

  /**
   * Bulk reorder for sections — Phase 3 cross-parent move support. The
   * Book Room can now drag a section between containers (changing its
   * parent_section_id) and reorder siblings within a parent. The service
   * validates that any new parent leaves the section's level intact;
   * the repo just rewrites the rows in one transaction.
   *
   * Items don't move as a side effect — they're attached to specific
   * (deepest-level) sections, and those sections retain their identity
   * across this reorder, so their items follow automatically.
   */
  async reorderSections(
    manuscriptId: string,
    userId: string,
    moves: { id: string; orderIndex: number; parentSectionId?: string | null }[],
    isAdmin: boolean = false
  ): Promise<ManuscriptSection[]> {
    await assertAccess(manuscriptId, userId, isAdmin, 'write')
    if (moves.length === 0) return this.listSections(manuscriptId, userId, isAdmin)

    const ids = moves.map(m => m.id)
    const owns = await pool.query(
      `SELECT id FROM manuscript_sections WHERE manuscript_id = $1 AND id = ANY($2::uuid[])`,
      [manuscriptId, ids]
    )
    if (owns.rows.length !== ids.length) {
      throw new ForbiddenError('Some sections do not belong to this manuscript')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const move of moves) {
        if (move.parentSectionId !== undefined) {
          await client.query(
            `UPDATE manuscript_sections
                SET order_index = $1, parent_section_id = $2, updated_at = NOW()
              WHERE id = $3`,
            [move.orderIndex, move.parentSectionId, move.id]
          )
        } else {
          await client.query(
            `UPDATE manuscript_sections
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

    return this.listSections(manuscriptId, userId, isAdmin)
  },

  /**
   * Apply a spine-layer plan (from spine-layer.ts planners) in a single
   * transaction. Mutates the section tree and the parent manuscript's
   * spine_depth / spine_layer_labels atomically — the schema never
   * shows a half-updated state.
   *
   * The plan may reference a sentinel parentSectionId
   * (WRAP_ABOVE_NEW_PARENT) to indicate "use the wrapper row's id once
   * it's inserted." That sentinel only appears in wrap_above plans;
   * flatten plans use real ids or null.
   *
   * Returns the manuscript and full updated section list so callers
   * can refresh client state in one round-trip.
   */
  async applySpineLayerPlan(
    manuscriptId: string,
    userId: string,
    plan: SpineLayerPlan,
    isAdmin: boolean = false
  ): Promise<{ manuscript: ManuscriptProject; sections: ManuscriptSection[] }> {
    await assertAccess(manuscriptId, userId, isAdmin, 'write')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Insert any new wrapper section(s) first so their UUIDs are
      //    available to resolve the WRAP_ABOVE_NEW_PARENT sentinel.
      //    Today planWrapAbove always produces exactly one create; we
      //    iterate to stay forward-compatible with future planners.
      let newWrapperId: string | null = null
      for (const c of plan.creates) {
        // Insert with the provided id if any, else let the DB generate
        // one via gen_random_uuid().
        const insert = c.id
          ? await client.query(
              `INSERT INTO manuscript_sections
                 (id, manuscript_id, title, order_index, purpose, notes, parent_section_id, level)
               VALUES ($1, $2, $3, $4, 'unassigned', NULL, $5, $6)
               RETURNING id`,
              [c.id, manuscriptId, c.title, c.orderIndex, c.parentSectionId, c.level]
            )
          : await client.query(
              `INSERT INTO manuscript_sections
                 (manuscript_id, title, order_index, purpose, notes, parent_section_id, level)
               VALUES ($1, $2, $3, 'unassigned', NULL, $4, $5)
               RETURNING id`,
              [manuscriptId, c.title, c.orderIndex, c.parentSectionId, c.level]
            )
        newWrapperId = insert.rows[0].id
      }

      // 2. Apply updates. Resolve WRAP_ABOVE_NEW_PARENT to the wrapper
      //    we just inserted. If the plan referenced the sentinel but
      //    no wrapper was created, that's a bug in the planner — fail
      //    loudly rather than silently null out parents.
      for (const u of plan.updates) {
        const parent = u.parentSectionId === WRAP_ABOVE_NEW_PARENT
          ? newWrapperId
          : u.parentSectionId
        if (u.parentSectionId === WRAP_ABOVE_NEW_PARENT && newWrapperId === null) {
          throw new Error('Plan references WRAP_ABOVE_NEW_PARENT but no wrapper was created')
        }
        if (parent !== undefined) {
          await client.query(
            `UPDATE manuscript_sections
                SET level = $1, parent_section_id = $2, updated_at = NOW()
              WHERE id = $3 AND manuscript_id = $4`,
            [u.level, parent, u.id, manuscriptId]
          )
        } else {
          // Only level changes — parent is unchanged.
          await client.query(
            `UPDATE manuscript_sections
                SET level = $1, updated_at = NOW()
              WHERE id = $2 AND manuscript_id = $3`,
            [u.level, u.id, manuscriptId]
          )
        }
      }

      // 3. Delete removed sections. The FK's ON DELETE CASCADE would
      //    drop children too — but flatten plans already promoted
      //    children to the grandparent in step 2, so deletes here
      //    affect only the targeted layer's nodes.
      for (const d of plan.deletes) {
        await client.query(
          `DELETE FROM manuscript_sections WHERE id = $1 AND manuscript_id = $2`,
          [d.id, manuscriptId]
        )
      }

      // 4. Update the manuscript's spine depth + labels in one shot.
      await client.query(
        `UPDATE manuscript_projects
            SET spine_depth = spine_depth + $1,
                spine_layer_labels = $2::jsonb,
                updated_at = NOW()
          WHERE id = $3`,
        [plan.spineDepthDelta, JSON.stringify(plan.spineLayerLabels), manuscriptId]
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    const [manuscript, sections] = await Promise.all([
      this.findById(manuscriptId, userId, isAdmin),
      this.listSections(manuscriptId, userId, isAdmin),
    ])
    return { manuscript, sections }
  },
}
