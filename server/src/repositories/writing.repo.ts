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
   * - Own private/shared/public blocks
   * - Others' shared/public blocks
   */
  async findAll(userId: string | null, limit: number = 50, offset: number = 0): Promise<WritingBlock[]> {
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
      if (userId) {
        // Authenticated: own blocks + shared/public from others
        query = `
          SELECT 
            wb.id, 
            wb.user_id as "userId", 
            wb.title, 
            wb.body,
            COALESCE(wb.visibility, 'private') as visibility,
            wb.created_at as "createdAt", 
            wb.updated_at as "updatedAt",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE wb.user_id = $1 OR COALESCE(wb.visibility, 'private') IN ('shared', 'public')
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.created_at, wb.updated_at
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
            wb.created_at as "createdAt", 
            wb.updated_at as "updatedAt",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE COALESCE(wb.visibility, 'private') = 'public'
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.created_at, wb.updated_at
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
          wb.created_at as "createdAt", 
          wb.updated_at as "updatedAt",
          COALESCE(
            ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
            ARRAY[]::UUID[]
          ) as "themeIds"
        FROM writing_blocks wb
        LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
        GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.created_at, wb.updated_at
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
   * - Owner can access any visibility
   * - Others can only access shared/public
   */
  async findById(id: string, userId: string | null): Promise<WritingBlock> {
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
      if (userId) {
        query = `
          SELECT 
            wb.id, 
            wb.user_id as "userId", 
            wb.title, 
            wb.body,
            COALESCE(wb.visibility, 'private') as visibility,
            wb.created_at as "createdAt", 
            wb.updated_at as "updatedAt",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE wb.id = $1 AND (wb.user_id = $2 OR COALESCE(wb.visibility, 'private') IN ('shared', 'public'))
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.created_at, wb.updated_at
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
            wb.created_at as "createdAt", 
            wb.updated_at as "updatedAt",
            COALESCE(
              ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
              ARRAY[]::UUID[]
            ) as "themeIds"
          FROM writing_blocks wb
          LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
          WHERE wb.id = $1 AND COALESCE(wb.visibility, 'private') = 'public'
          GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.visibility, wb.created_at, wb.updated_at
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
          wb.created_at as "createdAt", 
          wb.updated_at as "updatedAt",
          COALESCE(
            ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
            ARRAY[]::UUID[]
          ) as "themeIds"
        FROM writing_blocks wb
        LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
        WHERE wb.id = $1
        GROUP BY wb.id, wb.user_id, wb.title, wb.body, wb.created_at, wb.updated_at
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
      let writingResult
      if (hasVisibilityColumn) {
        writingResult = await client.query(
          `INSERT INTO writing_blocks (user_id, title, body, visibility)
           VALUES ($1, $2, $3, $4)
           RETURNING id, user_id as "userId", title, body, visibility, created_at as "createdAt", updated_at as "updatedAt"`,
          [writing.userId, writing.title, writing.body, visibility]
        )
      } else {
        writingResult = await client.query(
          `INSERT INTO writing_blocks (user_id, title, body)
           VALUES ($1, $2, $3)
           RETURNING id, user_id as "userId", title, body, 'private' as visibility, created_at as "createdAt", updated_at as "updatedAt"`,
          [writing.userId, writing.title, writing.body]
        )
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
   * Update writing block - enforces ownership
   */
  async update(id: string, userId: string, updates: Partial<Pick<WritingBlock, 'title' | 'body' | 'themeIds' | 'visibility'>>): Promise<WritingBlock> {
    // First verify ownership
    const existing = await pool.query(
      'SELECT user_id FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing block not found')
    }
    if (existing.rows[0].user_id !== userId) {
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
      
      return this.findById(id, userId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  /**
   * Delete writing block - enforces ownership
   */
  async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await pool.query(
      'SELECT user_id FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing block not found')
    }
    if (existing.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to delete this writing block')
    }

    const result = await pool.query('DELETE FROM writing_blocks WHERE id = $1', [id])
    if (result.rowCount === 0) {
      throw new NotFoundError('Writing block not found')
    }
  }
}
