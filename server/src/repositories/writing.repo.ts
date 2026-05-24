import { pool } from '../config/db.js'
import type { PoolClient } from 'pg'
import { createHash } from 'node:crypto'
import { WritingBlock } from '../models/WritingBlock.js'
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js'
import { writingRevisionRepo, RevisionSnapshot } from './writing-revision.repo.js'
import {
  getEffectivePermission,
  canEdit,
  canDelete,
} from '../services/writing-permissions.service.js'

/** Minutes since the latest revision after which an autosave will checkpoint. */
const CHECKPOINT_MINUTES = 30

/**
 * Cached result of "does writing_blocks have a `visibility` column?".
 * The check exists for backward compatibility with pre-migration-004
 * environments, but the column is part of the schema everywhere we run
 * today — caching it turns a per-request probe into a one-time check.
 * Reset to null only on schema-change error paths if we ever need to.
 */
let hasVisibilityColumnCache: boolean | null = null
async function hasVisibilityColumn(): Promise<boolean> {
  if (hasVisibilityColumnCache !== null) return hasVisibilityColumnCache
  try {
    await pool.query('SELECT visibility FROM writing_blocks LIMIT 1')
    hasVisibilityColumnCache = true
  } catch (error: any) {
    if (error.code === '42703') {
      hasVisibilityColumnCache = false
    } else {
      throw error
    }
  }
  return hasVisibilityColumnCache!
}

interface HeadRow {
  id: string
  userId: string
  title: string
  body: string
  visibility: 'private' | 'shared' | 'public'
  coverImageUrl: string | null
  coverImagePosition: string | null
  currentVersion: number
}

function hashSnapshot(s: RevisionSnapshot): string {
  return createHash('sha256')
    .update(s.title)
    .update('\x1f')
    .update(s.body)
    .update('\x1f')
    .update(s.visibility)
    .update('\x1f')
    .update(s.coverImageUrl ?? '')
    .update('\x1f')
    .update(s.coverImagePosition ?? '')
    .digest('hex')
}

async function lockHead(client: PoolClient, id: string): Promise<HeadRow> {
  const result = await client.query(
    `SELECT id, user_id AS "userId", title, body,
            COALESCE(visibility, 'private') AS visibility,
            cover_image_url AS "coverImageUrl",
            COALESCE(cover_image_position, '50% 50%') AS "coverImagePosition",
            COALESCE(current_version, 1) AS "currentVersion"
     FROM writing_blocks
     WHERE id = $1
     FOR UPDATE`,
    [id]
  )
  if (result.rows.length === 0) {
    throw new NotFoundError('Writing block not found')
  }
  return result.rows[0]
}

/**
 * Writing repository - thin DAO layer
 * No ORM magic - explicit SQL queries
 * Enforces ownership and visibility at query level
 */
export const writingRepo = {
  /**
   * Find all writing blocks visible to the user
   * - Admin: sees ALL blocks regardless of visibility
   * - Own private/shared/public blocks
   * - Others' shared/public blocks
   */
  async findAll(
    userId: string | null,
    limit: number = 50,
    offset: number = 0,
    isAdmin: boolean = false,
    userSharedAccess: boolean = false
  ): Promise<WritingBlock[]> {
    let query: string
    let params: unknown[]

    if (await hasVisibilityColumn()) {
      if (isAdmin) {
        // Admin: see ALL writing blocks regardless of visibility
        query = `
          SELECT 
            wb.id, 
            wb.user_id as "userId", 
            wb.title, 
            wb.body,
            COALESCE(wb.visibility, 'private') as visibility,
            wb.cover_image_url as "coverImageUrl",
            COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
            wb.created_at as "createdAt",
            wb.updated_at as "updatedAt",
            COALESCE(wb.current_version, 1) as "currentVersion",
            wb.sort_order as "sortOrder",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
          ORDER BY wb.created_at DESC
          LIMIT $1 OFFSET $2
        `
        params = [limit, offset]
      } else if (userId) {
        // Authenticated, non-admin. Read access is granted when ANY of:
        //   - user is the owner (any visibility, incl. private)
        //   - visibility = 'public' (anyone)
        //   - visibility = 'shared' AND user is admin-approved for shared
        //   - user has a row in writing_block_editors (named editor on a
        //     private/shared/public frag)
        query = `
          SELECT
            wb.id,
            wb.user_id as "userId",
            wb.title,
            wb.body,
            COALESCE(wb.visibility, 'private') as visibility,
            wb.cover_image_url as "coverImageUrl",
            COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
            wb.created_at as "createdAt",
            wb.updated_at as "updatedAt",
            COALESCE(wb.current_version, 1) as "currentVersion",
            wb.sort_order as "sortOrder",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE
            wb.user_id = $1
            OR COALESCE(wb.visibility, 'private') = 'public'
            OR (COALESCE(wb.visibility, 'private') = 'shared' AND $4::boolean)
            OR EXISTS (
              SELECT 1 FROM writing_block_editors wbe
              WHERE wbe.writing_block_id = wb.id AND wbe.user_id = $1
            )
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
          ORDER BY wb.created_at DESC
          LIMIT $2 OFFSET $3
        `
        params = [userId, limit, offset, userSharedAccess]
      } else {
        // Unauthenticated: only public blocks
        query = `
          SELECT 
            wb.id, 
            wb.user_id as "userId", 
            wb.title, 
            wb.body,
            COALESCE(wb.visibility, 'private') as visibility,
            wb.cover_image_url as "coverImageUrl",
            COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
            wb.created_at as "createdAt",
            wb.updated_at as "updatedAt",
            COALESCE(wb.current_version, 1) as "currentVersion",
            wb.sort_order as "sortOrder",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE COALESCE(wb.visibility, 'private') = 'public'
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
          ORDER BY wb.created_at DESC
          LIMIT $1 OFFSET $2
        `
        params = [limit, offset]
      }
    } else {
      // Fallback: no visibility column, show all (for backward compatibility during migration)
      query = `
        SELECT 
          wb.id, 
          wb.user_id as "userId", 
          wb.title, 
          wb.body,
          'private' as visibility,
          wb.cover_image_url as "coverImageUrl",
          COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
          wb.created_at as "createdAt",
          wb.updated_at as "updatedAt",
          wb.sort_order as "sortOrder",
          COALESCE(
            ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
            ARRAY[]::UUID[]
          ) as "themeIds"
        FROM writing_blocks wb
        LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
        GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
        ORDER BY wb.created_at DESC
        LIMIT $1 OFFSET $2
      `
      params = [limit, offset]
    }

    const result = await pool.query(query, params)
    return result.rows.map(row => ({
      ...row,
      themeIds: row.themeIds || []
    }))
  },

  /**
   * Find by ID with visibility check
   * - Admin can access ANY writing regardless of visibility
   * - Owner can access any visibility
   * - Others can only access shared/public
   */
  async findById(
    id: string,
    userId: string | null,
    isAdmin: boolean = false,
    userSharedAccess: boolean = false
  ): Promise<WritingBlock> {
    let query: string
    let params: unknown[]

    if (await hasVisibilityColumn()) {
      if (isAdmin) {
        // Admin: access any writing regardless of visibility
        query = `
          SELECT 
            wb.id, 
            wb.user_id as "userId", 
            wb.title, 
            wb.body,
            COALESCE(wb.visibility, 'private') as visibility,
            wb.cover_image_url as "coverImageUrl",
            COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
            wb.created_at as "createdAt",
            wb.updated_at as "updatedAt",
            COALESCE(wb.current_version, 1) as "currentVersion",
            wb.sort_order as "sortOrder",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE wb.id = $1
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
        `
        params = [id]
      } else if (userId) {
        // Same access rules as findAll's authenticated branch:
        // owner, public, shared+approved, or named-editor grant.
        query = `
          SELECT
            wb.id,
            wb.user_id as "userId",
            wb.title,
            wb.body,
            COALESCE(wb.visibility, 'private') as visibility,
            wb.cover_image_url as "coverImageUrl",
            COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
            wb.created_at as "createdAt",
            wb.updated_at as "updatedAt",
            COALESCE(wb.current_version, 1) as "currentVersion",
            wb.sort_order as "sortOrder",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE wb.id = $1 AND (
            wb.user_id = $2
            OR COALESCE(wb.visibility, 'private') = 'public'
            OR (COALESCE(wb.visibility, 'private') = 'shared' AND $3::boolean)
            OR EXISTS (
              SELECT 1 FROM writing_block_editors wbe
              WHERE wbe.writing_block_id = wb.id AND wbe.user_id = $2
            )
          )
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
        `
        params = [id, userId, userSharedAccess]
      } else {
        query = `
          SELECT 
            wb.id, 
            wb.user_id as "userId", 
            wb.title, 
            wb.body,
            COALESCE(wb.visibility, 'private') as visibility,
            wb.cover_image_url as "coverImageUrl",
            COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
            wb.created_at as "createdAt",
            wb.updated_at as "updatedAt",
            COALESCE(wb.current_version, 1) as "currentVersion",
            wb.sort_order as "sortOrder",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE wb.id = $1 AND COALESCE(wb.visibility, 'private') = 'public'
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
        `
        params = [id]
      }
    } else {
      // Fallback: no visibility column
      query = `
        SELECT 
          wb.id, 
          wb.user_id as "userId", 
          wb.title, 
          wb.body,
          'private' as visibility,
          wb.cover_image_url as "coverImageUrl",
          COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
          wb.created_at as "createdAt",
          wb.updated_at as "updatedAt",
          wb.sort_order as "sortOrder",
          COALESCE(
            ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
            ARRAY[]::UUID[]
          ) as "themeIds"
        FROM writing_blocks wb
        LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
        WHERE wb.id = $1
        GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
      `
      params = [id]
    }

    const result = await pool.query(query, params)
    if (result.rows.length === 0) {
      throw new NotFoundError('Writing block not found')
    }
    return {
      ...result.rows[0],
      themeIds: result.rows[0].themeIds || []
    }
  },

  async create(writing: Omit<WritingBlock, 'id' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'sortOrder'>): Promise<WritingBlock> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Check if visibility column exists
      let hasVisibilityColumn = true
      try {
        await client.query('SELECT visibility FROM writing_blocks LIMIT 1')
      } catch (error: any) {
        if (error.code === '42703') {
          hasVisibilityColumn = false
        } else {
          throw error
        }
      }

      // Check if sort_order column exists (migration 029)
      let hasSortOrderColumn = true
      try {
        await client.query('SELECT sort_order FROM writing_blocks LIMIT 1')
      } catch (error: any) {
        if (error.code === '42703') {
          hasSortOrderColumn = false
        } else {
          throw error
        }
      }

      // Serialize sort_order assignment per user. Two concurrent creates
      // by the same user would otherwise race on MAX(sort_order) and pick
      // duplicates; the advisory lock pins the per-user sequence so the
      // next insert always sees the latest MAX.
      if (hasSortOrderColumn) {
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtext('writing_blocks_sort_order:' || $1::text))`,
          [writing.userId]
        )
      }

      // Insert writing block with visibility (defaults to 'private')
      const visibility = writing.visibility || 'private'
      const coverImageUrl = writing.coverImageUrl ?? null
      const coverImagePosition = writing.coverImagePosition ?? '50% 50%'
      let writingResult
      if (hasVisibilityColumn) {
        if (hasSortOrderColumn) {
          writingResult = await client.query(
            `INSERT INTO writing_blocks (user_id, title, body, visibility, cover_image_url, cover_image_position, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6,
                     (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM writing_blocks WHERE user_id = $1))
             RETURNING id, user_id as "userId", title, body, visibility, cover_image_url as "coverImageUrl", COALESCE(cover_image_position, '50% 50%') as "coverImagePosition", created_at as "createdAt", updated_at as "updatedAt", sort_order as "sortOrder"`,
            [writing.userId, writing.title, writing.body, visibility, coverImageUrl, coverImagePosition]
          )
        } else {
          writingResult = await client.query(
            `INSERT INTO writing_blocks (user_id, title, body, visibility, cover_image_url, cover_image_position)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, user_id as "userId", title, body, visibility, cover_image_url as "coverImageUrl", COALESCE(cover_image_position, '50% 50%') as "coverImagePosition", created_at as "createdAt", updated_at as "updatedAt"`,
            [writing.userId, writing.title, writing.body, visibility, coverImageUrl, coverImagePosition]
          )
        }
      } else {
        // Fallback: pre-visibility schema (no cover_image_url either)
        writingResult = await client.query(
          `INSERT INTO writing_blocks (user_id, title, body)
           VALUES ($1, $2, $3)
           RETURNING id, user_id as "userId", title, body, 'private' as visibility, created_at as "createdAt", updated_at as "updatedAt"`,
          [writing.userId, writing.title, writing.body]
        )
        writingResult.rows[0].coverImageUrl = null
        writingResult.rows[0].coverImagePosition = '50% 50%'
      }
      const writingBlock = writingResult.rows[0]
      
      // Seed the revision log with the initial create-revision so every
      // frag has at least one row in writing_block_revisions and rollbacks
      // can always target the original state. Skipped if the revisions
      // table doesn't exist yet (pre-migration-027 environments).
      try {
        await writingRevisionRepo.insertWithinTx(client, {
          writingBlockId: writingBlock.id,
          editedBy: writing.userId,
          snapshot: {
            title: writing.title,
            body: writing.body,
            visibility: visibility,
            coverImageUrl: coverImageUrl,
            coverImagePosition: coverImagePosition,
          },
          revisionKind: 'create',
          note: null,
        })
      } catch (err: any) {
        if (err?.code !== '42P01') throw err
      }

      // Insert theme associations
      if (writing.themeIds && writing.themeIds.length > 0) {
        for (const themeId of writing.themeIds) {
          await client.query(
            `INSERT INTO writing_themes (writing_id, theme_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [writingBlock.id, themeId]
          )
        }
      }
      
      await client.query('COMMIT')
      
      // Fetch with themeIds
      return this.findById(writingBlock.id, writing.userId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  /**
   * Update writing block.
   *
   * Permission: owner, admin, or granted editor (edit/manage). All other
   * users → 403.
   *
   * Optimistic locking: if `expectedVersion` is provided and does not
   * match the row's `current_version`, throws ConflictError (HTTP 409)
   * with details `{ currentVersion, expectedVersion }`. The client is
   * expected to reload, merge, and retry.
   *
   * Revision history triggers (a new row is appended to
   * writing_block_revisions on save IFF any of):
   *   - `revisionNote` was provided ("Save version" button)
   *   - the editor differs from the previous revision's edited_by (handoff)
   *   - the previous revision is older than CHECKPOINT_MINUTES
   * AND the content hash actually changed (no-op saves are skipped).
   *
   * Otherwise the save is treated as an autosave: HEAD is updated, the
   * revision log is not touched, current_version is still bumped.
   */
  async update(
    id: string,
    userId: string,
    updates: Partial<Pick<WritingBlock, 'title' | 'body' | 'themeIds' | 'visibility' | 'coverImagePosition'>>
      & Partial<{ coverImageUrl: string | null }>
      & Partial<{ expectedVersion: number; revisionNote: string }>,
    isAdmin: boolean = false
  ): Promise<WritingBlock> {
    const perm = await getEffectivePermission(id, userId, isAdmin)
    if (!canEdit(perm)) {
      throw new ForbiddenError('Not authorized to update this writing block')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const head = await lockHead(client, id)

      if (
        typeof updates.expectedVersion === 'number'
        && updates.expectedVersion !== head.currentVersion
      ) {
        throw new ConflictError(
          'Writing block has been updated by another editor',
          { currentVersion: head.currentVersion, expectedVersion: updates.expectedVersion }
        )
      }

      const newSnapshot: RevisionSnapshot = {
        title: updates.title !== undefined ? updates.title : head.title,
        body: updates.body !== undefined ? updates.body : head.body,
        visibility: updates.visibility !== undefined ? updates.visibility : head.visibility,
        coverImageUrl: updates.coverImageUrl !== undefined ? updates.coverImageUrl : head.coverImageUrl,
        coverImagePosition: updates.coverImagePosition !== undefined ? updates.coverImagePosition : head.coverImagePosition,
      }

      const fields: string[] = []
      const values: unknown[] = []
      let p = 1
      if (updates.title !== undefined) { fields.push(`title = $${p++}`); values.push(updates.title) }
      if (updates.body !== undefined) { fields.push(`body = $${p++}`); values.push(updates.body) }
      if (updates.visibility !== undefined) { fields.push(`visibility = $${p++}`); values.push(updates.visibility) }
      if (updates.coverImageUrl !== undefined) { fields.push(`cover_image_url = $${p++}`); values.push(updates.coverImageUrl) }
      if (updates.coverImagePosition !== undefined) { fields.push(`cover_image_position = $${p++}`); values.push(updates.coverImagePosition) }

      const versionedFieldChanged = fields.length > 0
      const themesChanged = updates.themeIds !== undefined
      const headWillChange = versionedFieldChanged || themesChanged

      if (headWillChange) {
        fields.push(`updated_at = NOW()`)
        fields.push(`current_version = COALESCE(current_version, 1) + 1`)
        values.push(id)
        await client.query(
          `UPDATE writing_blocks SET ${fields.join(', ')} WHERE id = $${p}`,
          values
        )
      }

      if (themesChanged) {
        await client.query(`DELETE FROM writing_themes WHERE writing_id = $1`, [id])
        if (updates.themeIds!.length > 0) {
          for (const themeId of updates.themeIds!) {
            await client.query(
              `INSERT INTO writing_themes (writing_id, theme_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [id, themeId]
            )
          }
        }
      }

      // Decide whether this save warrants a revision row.
      if (versionedFieldChanged) {
        const latest = await writingRevisionRepo.getLatest(id)
        const latestSnapshotHash = latest
          ? hashSnapshot({
              title: latest.title,
              body: latest.body,
              visibility: latest.visibility,
              coverImageUrl: latest.coverImageUrl ?? null,
              coverImagePosition: latest.coverImagePosition ?? null,
            })
          : null
        const newHash = hashSnapshot(newSnapshot)
        const contentChanged = latestSnapshotHash !== newHash

        let reason: 'explicit' | 'handoff' | 'time' | null = null
        if (updates.revisionNote && updates.revisionNote.trim()) {
          reason = 'explicit'
        } else if (latest && latest.editedBy !== userId) {
          reason = 'handoff'
        } else if (latest) {
          const ageMs = Date.now() - new Date(latest.editedAt).getTime()
          if (ageMs > CHECKPOINT_MINUTES * 60 * 1000) reason = 'time'
        } else {
          // No prior revision (shouldn't happen post-migration backfill,
          // but defensive). Treat first save as an explicit checkpoint.
          reason = 'explicit'
        }

        if (reason && contentChanged) {
          await writingRevisionRepo.insertWithinTx(client, {
            writingBlockId: id,
            editedBy: userId,
            snapshot: newSnapshot,
            revisionKind: 'edit',
            note: updates.revisionNote?.trim() || null,
          })
        }
      }

      await client.query('COMMIT')
      return this.findById(id, userId, isAdmin)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  /**
   * Restore the frag to a prior revision. Creates two revision rows in
   * one transaction: a pre-restore checkpoint of the live HEAD (so the
   * pre-restore state is never lost), then the restored state with
   * revision_kind='restore' and restored_from_version pointing at the
   * target. HEAD is overwritten with the target's content.
   *
   * Permission: same as update (owner, admin, or editor/manage grant).
   */
  async restore(
    id: string,
    targetVersion: number,
    userId: string,
    isAdmin: boolean = false,
    note?: string
  ): Promise<WritingBlock> {
    const perm = await getEffectivePermission(id, userId, isAdmin)
    if (!canEdit(perm)) {
      throw new ForbiddenError('Not authorized to restore this writing block')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const head = await lockHead(client, id)
      const target = await writingRevisionRepo.getByVersion(id, targetVersion)

      const headSnapshot: RevisionSnapshot = {
        title: head.title,
        body: head.body,
        visibility: head.visibility,
        coverImageUrl: head.coverImageUrl,
        coverImagePosition: head.coverImagePosition,
      }
      const targetSnapshot: RevisionSnapshot = {
        title: target.title,
        body: target.body,
        visibility: target.visibility,
        coverImageUrl: target.coverImageUrl ?? null,
        coverImagePosition: target.coverImagePosition ?? null,
      }

      // Only checkpoint HEAD if it actually differs from the latest
      // revision row (otherwise we'd insert a duplicate).
      const latest = await writingRevisionRepo.getLatest(id)
      const latestHash = latest
        ? hashSnapshot({
            title: latest.title,
            body: latest.body,
            visibility: latest.visibility,
            coverImageUrl: latest.coverImageUrl ?? null,
            coverImagePosition: latest.coverImagePosition ?? null,
          })
        : null
      const headHash = hashSnapshot(headSnapshot)
      if (latestHash !== headHash) {
        await writingRevisionRepo.insertWithinTx(client, {
          writingBlockId: id,
          editedBy: userId,
          snapshot: headSnapshot,
          revisionKind: 'edit',
          note: 'Pre-restore checkpoint',
        })
      }

      await client.query(
        `UPDATE writing_blocks
         SET title = $1,
             body = $2,
             visibility = $3,
             cover_image_url = $4,
             cover_image_position = $5,
             updated_at = NOW(),
             current_version = COALESCE(current_version, 1) + 1
         WHERE id = $6`,
        [
          targetSnapshot.title,
          targetSnapshot.body,
          targetSnapshot.visibility,
          targetSnapshot.coverImageUrl,
          targetSnapshot.coverImagePosition,
          id,
        ]
      )

      await writingRevisionRepo.insertWithinTx(client, {
        writingBlockId: id,
        editedBy: userId,
        snapshot: targetSnapshot,
        revisionKind: 'restore',
        restoredFromVersion: targetVersion,
        note: note?.trim() || `Restored from version ${targetVersion}`,
      })

      await client.query('COMMIT')
      return this.findById(id, userId, isAdmin)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  /**
   * Delete writing block - enforces ownership (admin bypasses)
   */
  async delete(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    // Verify ownership (admin can delete any)
    const existing = await pool.query(
      'SELECT user_id FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing block not found')
    }
    if (!isAdmin && existing.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to delete this writing block')
    }

    const result = await pool.query('DELETE FROM writing_blocks WHERE id = $1', [id])
    if (result.rowCount === 0) {
      throw new NotFoundError('Writing block not found')
    }
  },

  /**
   * Move a frag to a target position (1..n) within its owner's sequence.
   *
   * This is a positional move, not a simple value update: the moved frag
   * is removed from its owner's ordered list, re-inserted at the target
   * index, and every frag belonging to that owner is renumbered 1..n.
   * The whole renumbering happens in a single transaction so partial
   * writes can never leave the sequence with gaps or duplicates.
   *
   * Permission: owner of the moved frag, or admin. Editors (without
   * ownership) cannot reorder — order is treated as owner-curated.
   *
   * Target is clamped to [1..n] and the input is expected to be a finite
   * integer; the service layer validates `targetSortOrder` before this
   * runs.
   *
   * Returns the moved frag's owner's full ordered list (1..n) after the
   * renumber so the UI can refresh without a second round-trip.
   */
  async moveFragToSortOrder(
    fragId: string,
    targetSortOrder: number,
    userId: string,
    isAdmin: boolean = false,
  ): Promise<WritingBlock[]> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Identify the owner whose list we'll renumber. Admin can move
      // anyone's frag; in that case we renumber the owner's list, not
      // the admin's. Non-admin can only move their own frags.
      const ownerRow = await client.query(
        `SELECT user_id FROM writing_blocks WHERE id = $1`,
        [fragId]
      )
      if (ownerRow.rows.length === 0) {
        throw new NotFoundError('Writing block not found')
      }
      const ownerId: string = ownerRow.rows[0].user_id
      if (!isAdmin && ownerId !== userId) {
        throw new ForbiddenError('Not authorized to reorder this writing block')
      }

      // Serialize against concurrent moves/creates for the same owner.
      // Same advisory-lock key as create() so a reorder can't interleave
      // with a new-frag insert and produce duplicate positions.
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext('writing_blocks_sort_order:' || $1::text))`,
        [ownerId]
      )

      // Load all of the owner's frags, ordered by current sort_order with
      // a stable fallback to (created_at, id) so duplicate or NULL
      // positions still sort deterministically — the renumber below will
      // clean them up.
      const allRows = await client.query(
        `SELECT id, sort_order
         FROM writing_blocks
         WHERE user_id = $1
         ORDER BY sort_order ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
         FOR UPDATE`,
        [ownerId]
      )

      const ids: string[] = allRows.rows.map((r: any) => r.id)
      const fromIdx = ids.indexOf(fragId)
      if (fromIdx === -1) {
        // Shouldn't happen — the row exists (ownerRow above) and we
        // selected the owner's full set.
        throw new NotFoundError('Writing block not found')
      }

      const n = ids.length

      // Remove from current position, then insert at the clamped target.
      // Target arrives 1-based; convert to 0-based, clamp to [0..n-1].
      const targetIdx0 = Math.max(0, Math.min(n - 1, targetSortOrder - 1))

      const reordered = ids.slice()
      reordered.splice(fromIdx, 1)
      reordered.splice(targetIdx0, 0, fragId)

      // Two-phase renumber to avoid colliding with the
      // UNIQUE(user_id, sort_order) constraint mid-update: shift every
      // row into a temporary negative-offset range first, then write the
      // final positions. Negative values are not used by the normal flow
      // (positions are >= 1), so they don't collide with rows we haven't
      // touched yet.
      const TEMP_OFFSET = n + 1
      for (let i = 0; i < reordered.length; i++) {
        await client.query(
          `UPDATE writing_blocks SET sort_order = $1 WHERE id = $2`,
          [-(i + 1 + TEMP_OFFSET), reordered[i]]
        )
      }
      for (let i = 0; i < reordered.length; i++) {
        await client.query(
          `UPDATE writing_blocks SET sort_order = $1 WHERE id = $2`,
          [i + 1, reordered[i]]
        )
      }

      await client.query('COMMIT')

      // Return the owner's normalized 1..n list. We deliberately re-query
      // (rather than synthesize the rows from the in-memory `reordered`
      // array) so the caller gets fully-populated WritingBlock records,
      // including theme associations and visibility-derived fields, that
      // match what findAll would have returned.
      return this.findAllForOwner(ownerId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  /**
   * Internal: list every frag owned by `ownerId`, ordered by sort_order.
   * Used by moveFragToSortOrder to return the post-renumber list to the
   * client without going through the visibility-filtered findAll.
   */
  async findAllForOwner(ownerId: string): Promise<WritingBlock[]> {
    const result = await pool.query(
      `SELECT
         wb.id,
         wb.user_id as "userId",
         wb.title,
         wb.body,
         COALESCE(wb.visibility, 'private') as visibility,
         wb.cover_image_url as "coverImageUrl",
         COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
         wb.created_at as "createdAt",
         wb.updated_at as "updatedAt",
         COALESCE(wb.current_version, 1) as "currentVersion",
         wb.sort_order as "sortOrder",
         COALESCE(
           ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
           ARRAY[]::UUID[]
         ) as "themeIds"
       FROM writing_blocks wb
       LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
       WHERE wb.user_id = $1
       GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
       ORDER BY wb.sort_order ASC`,
      [ownerId]
    )
    return result.rows.map((row: any) => ({
      ...row,
      themeIds: row.themeIds || [],
    }))
  },
}
