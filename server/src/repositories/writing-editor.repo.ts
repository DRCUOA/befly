import { pool } from '../config/db.js'
import { WritingBlockEditor, WritingBlockEditorPermission } from '../models/WritingBlockEditor.js'
import { NotFoundError } from '../utils/errors.js'

const SELECT_COLS = `
  e.id,
  e.writing_block_id  AS "writingBlockId",
  e.user_id           AS "userId",
  e.granted_by        AS "grantedBy",
  e.permission,
  e.created_at        AS "createdAt",
  e.updated_at        AS "updatedAt",
  u.display_name      AS "userDisplayName",
  u.email             AS "userEmail",
  g.display_name      AS "grantedByDisplayName"
`

const FROM_JOINS = `
  FROM writing_block_editors e
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN users g ON g.id = e.granted_by
`

export const writingEditorRepo = {
  async listForBlock(writingBlockId: string): Promise<WritingBlockEditor[]> {
    const result = await pool.query(
      `SELECT ${SELECT_COLS} ${FROM_JOINS}
       WHERE e.writing_block_id = $1
       ORDER BY e.created_at ASC`,
      [writingBlockId]
    )
    return result.rows
  },

  async findGrant(writingBlockId: string, userId: string): Promise<WritingBlockEditor | null> {
    const result = await pool.query(
      `SELECT ${SELECT_COLS} ${FROM_JOINS}
       WHERE e.writing_block_id = $1 AND e.user_id = $2`,
      [writingBlockId, userId]
    )
    return result.rows[0] || null
  },

  async upsert(
    writingBlockId: string,
    userId: string,
    permission: WritingBlockEditorPermission,
    grantedBy: string
  ): Promise<WritingBlockEditor> {
    const result = await pool.query(
      `INSERT INTO writing_block_editors (writing_block_id, user_id, granted_by, permission)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (writing_block_id, user_id)
       DO UPDATE SET permission = EXCLUDED.permission,
                     granted_by = EXCLUDED.granted_by,
                     updated_at = NOW()
       RETURNING id`,
      [writingBlockId, userId, grantedBy, permission]
    )
    const grant = await this.findGrant(writingBlockId, userId)
    if (!grant) {
      throw new NotFoundError('Grant not found after upsert')
    }
    return grant
  },

  async remove(writingBlockId: string, userId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM writing_block_editors
       WHERE writing_block_id = $1 AND user_id = $2`,
      [writingBlockId, userId]
    )
    if (result.rowCount === 0) {
      throw new NotFoundError('Editor grant not found')
    }
  },

  /**
   * Frags the user has at least the given permission on. Used by the
   * "Shared with me" filter on the client.
   */
  async listFragsForUser(
    userId: string,
    minPermission: WritingBlockEditorPermission = 'edit'
  ): Promise<Array<{ writingBlockId: string; permission: WritingBlockEditorPermission }>> {
    const allowed = permissionsAtLeast(minPermission)
    const result = await pool.query(
      `SELECT writing_block_id AS "writingBlockId", permission
       FROM writing_block_editors
       WHERE user_id = $1 AND permission = ANY($2::text[])`,
      [userId, allowed]
    )
    return result.rows
  }
}

const RANK: Record<WritingBlockEditorPermission, number> = { edit: 1, manage: 2 }

function permissionsAtLeast(min: WritingBlockEditorPermission): WritingBlockEditorPermission[] {
  return (['edit', 'manage'] as WritingBlockEditorPermission[]).filter(p => RANK[p] >= RANK[min])
}
