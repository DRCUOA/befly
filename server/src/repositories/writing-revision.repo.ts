import { pool } from '../config/db.js'
import type { PoolClient } from 'pg'
import {
  WritingBlockRevision,
  WritingBlockRevisionKind,
  WritingBlockRevisionSummary,
} from '../models/WritingBlockRevision.js'
import { NotFoundError } from '../utils/errors.js'

const FULL_COLS = `
  r.id,
  r.writing_block_id     AS "writingBlockId",
  r.version_number       AS "versionNumber",
  r.edited_by            AS "editedBy",
  r.edited_at            AS "editedAt",
  r.title,
  r.body,
  r.visibility,
  r.cover_image_url      AS "coverImageUrl",
  r.cover_image_position AS "coverImagePosition",
  r.revision_kind        AS "revisionKind",
  r.restored_from_version AS "restoredFromVersion",
  r.note,
  u.display_name         AS "editorDisplayName"
`

const SUMMARY_COLS = `
  r.id,
  r.writing_block_id     AS "writingBlockId",
  r.version_number       AS "versionNumber",
  r.edited_by            AS "editedBy",
  r.edited_at            AS "editedAt",
  r.revision_kind        AS "revisionKind",
  r.restored_from_version AS "restoredFromVersion",
  r.note,
  u.display_name         AS "editorDisplayName"
`

const JOIN = `
  FROM writing_block_revisions r
  LEFT JOIN users u ON u.id = r.edited_by
`

export interface RevisionSnapshot {
  title: string
  body: string
  visibility: 'private' | 'shared' | 'public'
  coverImageUrl: string | null
  coverImagePosition: string | null
}

export const writingRevisionRepo = {
  async listSummaries(writingBlockId: string): Promise<WritingBlockRevisionSummary[]> {
    const result = await pool.query(
      `SELECT ${SUMMARY_COLS} ${JOIN}
       WHERE r.writing_block_id = $1
       ORDER BY r.version_number DESC`,
      [writingBlockId]
    )
    return result.rows
  },

  async getByVersion(
    writingBlockId: string,
    versionNumber: number
  ): Promise<WritingBlockRevision> {
    const result = await pool.query(
      `SELECT ${FULL_COLS} ${JOIN}
       WHERE r.writing_block_id = $1 AND r.version_number = $2`,
      [writingBlockId, versionNumber]
    )
    if (result.rows.length === 0) {
      throw new NotFoundError(`Revision ${versionNumber} not found`)
    }
    return result.rows[0]
  },

  async getLatest(writingBlockId: string): Promise<WritingBlockRevision | null> {
    const result = await pool.query(
      `SELECT ${FULL_COLS} ${JOIN}
       WHERE r.writing_block_id = $1
       ORDER BY r.version_number DESC
       LIMIT 1`,
      [writingBlockId]
    )
    return result.rows[0] || null
  },

  /**
   * Insert a new revision row. Must be called inside a transaction holding
   * a FOR UPDATE lock on the parent writing_blocks row so that
   * version_number assignment is race-free.
   *
   * Returns the inserted row.
   */
  async insertWithinTx(
    client: PoolClient,
    args: {
      writingBlockId: string
      editedBy: string
      snapshot: RevisionSnapshot
      revisionKind: WritingBlockRevisionKind
      restoredFromVersion?: number | null
      note?: string | null
    }
  ): Promise<{ versionNumber: number; id: string }> {
    const nextVersion = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next
       FROM writing_block_revisions
       WHERE writing_block_id = $1`,
      [args.writingBlockId]
    )
    const versionNumber = nextVersion.rows[0].next as number

    const inserted = await client.query(
      `INSERT INTO writing_block_revisions (
         writing_block_id, version_number, edited_by,
         title, body, visibility, cover_image_url, cover_image_position,
         revision_kind, restored_from_version, note
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        args.writingBlockId,
        versionNumber,
        args.editedBy,
        args.snapshot.title,
        args.snapshot.body,
        args.snapshot.visibility,
        args.snapshot.coverImageUrl,
        args.snapshot.coverImagePosition,
        args.revisionKind,
        args.restoredFromVersion ?? null,
        args.note ?? null,
      ]
    )
    return { versionNumber, id: inserted.rows[0].id }
  },
}
