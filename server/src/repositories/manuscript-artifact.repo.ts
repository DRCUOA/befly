import { pool } from '../config/db.js'
import {
  ManuscriptArtifact,
  ManuscriptArtifactType,
  ManuscriptArtifactStatus,
} from '../models/Manuscript.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'

/**
 * Manuscript artifact repository.
 *
 * Access checks mirror manuscript_projects: a user can read an artifact if
 * they can read its parent manuscript, and write if they own it (or admin).
 * The check happens by joining to manuscript_projects so we don't have to
 * duplicate the visibility logic.
 */

// Column projection. Kept unprefixed so it works in three contexts:
//   - aliased SELECT (`FROM manuscript_artifacts a` in list())
//   - INSERT ... RETURNING (no alias scope)
//   - UPDATE ... RETURNING (alias optional, projection has no FROM scope)
// There are no JOINs in any artifact query, so unprefixed names are unambiguous.
const ARTIFACT_COLUMNS = `
  id,
  manuscript_id              AS "manuscriptId",
  type,
  title,
  content,
  status,
  related_writing_block_ids  AS "relatedWritingBlockIds",
  from_item_id               AS "fromItemId",
  to_item_id                 AS "toItemId",
  source_model               AS "sourceModel",
  created_by                 AS "createdBy",
  created_at                 AS "createdAt",
  updated_at                 AS "updatedAt"
`

type AccessMode = 'read' | 'write'

async function assertParentAccess(
  manuscriptId: string,
  userId: string | null,
  isAdmin: boolean,
  mode: AccessMode
): Promise<void> {
  const result = await pool.query(
    `SELECT user_id, visibility FROM manuscript_projects WHERE id = $1`,
    [manuscriptId]
  )
  if (result.rows.length === 0) throw new NotFoundError('Manuscript not found')
  const ownerId: string = result.rows[0].user_id
  const visibility: string = result.rows[0].visibility

  if (isAdmin) return
  if (mode === 'read') {
    if (userId && ownerId === userId) return
    if (visibility === 'shared' || visibility === 'public') return
    throw new NotFoundError('Manuscript not found') // hide existence
  }
  if (!userId) throw new ForbiddenError('Not authorized')
  if (ownerId !== userId) throw new ForbiddenError('Not authorized to modify this manuscript')
}

async function loadArtifactForWrite(
  artifactId: string,
  userId: string | null,
  isAdmin: boolean
): Promise<{ manuscriptId: string }> {
  const owner = await pool.query(
    `SELECT manuscript_id FROM manuscript_artifacts WHERE id = $1`,
    [artifactId]
  )
  if (owner.rows.length === 0) throw new NotFoundError('Artifact not found')
  const manuscriptId: string = owner.rows[0].manuscript_id
  await assertParentAccess(manuscriptId, userId, isAdmin, 'write')
  return { manuscriptId }
}

export const manuscriptArtifactRepo = {
  async list(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false,
    filter: { type?: ManuscriptArtifactType; status?: ManuscriptArtifactStatus } = {}
  ): Promise<ManuscriptArtifact[]> {
    await assertParentAccess(manuscriptId, userId, isAdmin, 'read')
    const conditions: string[] = ['manuscript_id = $1']
    const params: unknown[] = [manuscriptId]
    let i = 2
    if (filter.type) { conditions.push(`type = $${i++}`); params.push(filter.type) }
    if (filter.status) { conditions.push(`status = $${i++}`); params.push(filter.status) }
    const result = await pool.query(
      `SELECT ${ARTIFACT_COLUMNS} FROM manuscript_artifacts
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      params
    )
    return result.rows
  },

  async create(input: {
    manuscriptId: string
    type: ManuscriptArtifactType
    title: string
    /** Any JSON-serialisable payload. Each artifact type defines its own shape. */
    content: object
    relatedWritingBlockIds?: string[]
    fromItemId?: string | null
    toItemId?: string | null
    sourceModel?: string | null
    createdBy?: string | null
  }): Promise<ManuscriptArtifact> {
    const result = await pool.query(
      `INSERT INTO manuscript_artifacts (
         manuscript_id, type, title, content,
         related_writing_block_ids, from_item_id, to_item_id,
         source_model, created_by
       )
       VALUES ($1, $2, $3, $4::jsonb, $5::uuid[], $6, $7, $8, $9)
       RETURNING ${ARTIFACT_COLUMNS}`,
      [
        input.manuscriptId,
        input.type,
        input.title,
        JSON.stringify(input.content),
        input.relatedWritingBlockIds ?? [],
        input.fromItemId ?? null,
        input.toItemId ?? null,
        input.sourceModel ?? null,
        input.createdBy ?? null,
      ]
    )
    return result.rows[0]
  },

  async updateStatus(
    artifactId: string,
    userId: string,
    status: ManuscriptArtifactStatus,
    isAdmin: boolean = false
  ): Promise<ManuscriptArtifact> {
    await loadArtifactForWrite(artifactId, userId, isAdmin)
    const result = await pool.query(
      `UPDATE manuscript_artifacts
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING ${ARTIFACT_COLUMNS}`,
      [status, artifactId]
    )
    return result.rows[0]
  },

  async delete(artifactId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await loadArtifactForWrite(artifactId, userId, isAdmin)
    await pool.query('DELETE FROM manuscript_artifacts WHERE id = $1', [artifactId])
  },
}
