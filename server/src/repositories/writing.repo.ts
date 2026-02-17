import { pool } from '../config/db.js'
import { WritingBlock } from '../models/WritingBlock.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'

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
  async findAll(userId: string | null, limit: number = 50, offset: number = 0, isAdmin: boolean = false): Promise<WritingBlock[]> {
    let query: string
    let params: unknown[]

    // Check if visibility column exists by trying a simple query first
    // If it doesn't exist, use a fallback query without visibility filtering
    let hasVisibilityColumn = true
    try {
      await pool.query('SELECT visibility FROM writing_blocks LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') { // column does not exist
        hasVisibilityColumn = false
      } else {
        throw error
      }
    }

    if (hasVisibilityColumn) {
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
        // Authenticated: own blocks + shared/public from others
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
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE wb.user_id = $1 OR COALESCE(wb.visibility, 'private') IN ('shared', 'public')
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
          ORDER BY wb.created_at DESC
          LIMIT $2 OFFSET $3
        `
        params = [userId, limit, offset]
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
  async findById(id: string, userId: string | null, isAdmin: boolean = false): Promise<WritingBlock> {
    // Check if visibility column exists
    let hasVisibilityColumn = true
    try {
      await pool.query('SELECT visibility FROM writing_blocks LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        hasVisibilityColumn = false
      } else {
        throw error
      }
    }

    let query: string
    let params: unknown[]

    if (hasVisibilityColumn) {
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
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE wb.id = $1 AND (wb.user_id = $2 OR COALESCE(wb.visibility, 'private') IN ('shared', 'public'))
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.cover_image_url, wb.cover_image_position, wb.created_at, wb.updated_at
        `
        params = [id, userId]
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

  async create(writing: Omit<WritingBlock, 'id' | 'createdAt' | 'updatedAt'>): Promise<WritingBlock> {
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
      
      // Insert writing block with visibility (defaults to 'private')
      const visibility = writing.visibility || 'private'
      const coverImageUrl = writing.coverImageUrl ?? null
      const coverImagePosition = writing.coverImagePosition ?? '50% 50%'
      let writingResult
      if (hasVisibilityColumn) {
        writingResult = await client.query(
          `INSERT INTO writing_blocks (user_id, title, body, visibility, cover_image_url, cover_image_position)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, user_id as "userId", title, body, visibility, cover_image_url as "coverImageUrl", COALESCE(cover_image_position, '50% 50%') as "coverImagePosition", created_at as "createdAt", updated_at as "updatedAt"`,
          [writing.userId, writing.title, writing.body, visibility, coverImageUrl, coverImagePosition]
        )
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
   * Update writing block - enforces ownership (admin bypasses)
   */
  async update(id: string, userId: string, updates: Partial<Pick<WritingBlock, 'title' | 'body' | 'themeIds' | 'visibility' | 'coverImagePosition'>> & Partial<{ coverImageUrl: string | null }>, isAdmin: boolean = false): Promise<WritingBlock> {
    // First verify ownership (admin can update any)
    const existing = await pool.query(
      'SELECT user_id FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing block not found')
    }
    if (!isAdmin && existing.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to update this writing block')
    }

    // Check if visibility column exists
    let hasVisibilityColumn = true
    try {
      await pool.query('SELECT visibility FROM writing_blocks LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        hasVisibilityColumn = false
      } else {
        throw error
      }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      const fields: string[] = []
      const values: unknown[] = []
      let paramCount = 1

      if (updates.title !== undefined) {
        fields.push(`title = $${paramCount++}`)
        values.push(updates.title)
      }
      if (updates.body !== undefined) {
        fields.push(`body = $${paramCount++}`)
        values.push(updates.body)
      }
      if (updates.visibility !== undefined && hasVisibilityColumn) {
        fields.push(`visibility = $${paramCount++}`)
        values.push(updates.visibility)
      }
      if (updates.coverImageUrl !== undefined) {
        fields.push(`cover_image_url = $${paramCount++}`)
        values.push(updates.coverImageUrl)
      }
      if (updates.coverImagePosition !== undefined) {
        fields.push(`cover_image_position = $${paramCount++}`)
        values.push(updates.coverImagePosition)
      }

      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`)
        values.push(id)

        await client.query(
          `UPDATE writing_blocks
           SET ${fields.join(', ')}
           WHERE id = $${paramCount}`,
          values
        )
      } else if (!hasVisibilityColumn && updates.themeIds !== undefined) {
        // If no fields to update but themeIds need updating, still update updated_at
        await client.query(
          `UPDATE writing_blocks SET updated_at = NOW() WHERE id = $1`,
          [id]
        )
      }

      // Update theme associations if provided
      if (updates.themeIds !== undefined) {
        // Delete existing associations
        await client.query(
          `DELETE FROM writing_themes WHERE writing_id = $1`,
          [id]
        )
        
        // Insert new associations
        if (updates.themeIds.length > 0) {
          for (const themeId of updates.themeIds) {
            await client.query(
              `INSERT INTO writing_themes (writing_id, theme_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [id, themeId]
            )
          }
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
  }
}
