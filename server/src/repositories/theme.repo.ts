import { pool } from '../config/db.js'
import { Theme } from '../models/Theme.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'

/**
 * Theme repository - thin DAO layer
 * Enforces ownership and visibility at query level
 */
export const themeRepo = {
  /**
   * Find all themes visible to the user
   * - Own private/shared/public themes
   * - Others' shared/public themes
   */
  async findAll(userId: string | null): Promise<Theme[]> {
    // Check if visibility and user_id columns exist
    let hasVisibilityColumn = true
    let hasUserIdColumn = true
    try {
      await pool.query('SELECT visibility, user_id FROM themes LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') { // column does not exist
        // Check which column is missing
        try {
          await pool.query('SELECT visibility FROM themes LIMIT 1')
          hasUserIdColumn = false
        } catch {
          try {
            await pool.query('SELECT user_id FROM themes LIMIT 1')
            hasVisibilityColumn = false
          } catch {
            hasVisibilityColumn = false
            hasUserIdColumn = false
          }
        }
      } else {
        throw error
      }
    }

    let query: string
    let params: unknown[]

    if (hasVisibilityColumn && hasUserIdColumn) {
      if (userId) {
        query = `
          SELECT id, user_id as "userId", name, slug, COALESCE(visibility, 'private') as visibility, created_at as "createdAt"
          FROM themes
          WHERE user_id = $1 OR COALESCE(visibility, 'private') IN ('shared', 'public')
          ORDER BY name ASC
        `
        params = [userId]
      } else {
        query = `
          SELECT id, user_id as "userId", name, slug, COALESCE(visibility, 'private') as visibility, created_at as "createdAt"
          FROM themes
          WHERE COALESCE(visibility, 'private') = 'public'
          ORDER BY name ASC
        `
        params = []
      }
    } else if (hasUserIdColumn) {
      // Has user_id but no visibility - show all themes for now
      query = `
        SELECT id, user_id as "userId", name, slug, 'private' as visibility, created_at as "createdAt"
        FROM themes
        ORDER BY name ASC
      `
      params = []
    } else {
      // No user_id or visibility columns - old schema
      query = `
        SELECT id, ''::uuid as "userId", name, slug, 'private' as visibility, created_at as "createdAt"
        FROM themes
        ORDER BY name ASC
      `
      params = []
    }

    const result = await pool.query(query, params)
    return result.rows
  },

  async findById(id: string, userId: string | null): Promise<Theme> {
    // Check if columns exist
    let hasVisibilityColumn = true
    let hasUserIdColumn = true
    try {
      await pool.query('SELECT visibility, user_id FROM themes LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        try {
          await pool.query('SELECT visibility FROM themes LIMIT 1')
          hasUserIdColumn = false
        } catch {
          try {
            await pool.query('SELECT user_id FROM themes LIMIT 1')
            hasVisibilityColumn = false
          } catch {
            hasVisibilityColumn = false
            hasUserIdColumn = false
          }
        }
      } else {
        throw error
      }
    }

    let query: string
    let params: unknown[]

    if (hasVisibilityColumn && hasUserIdColumn) {
      if (userId) {
        query = `
          SELECT id, user_id as "userId", name, slug, COALESCE(visibility, 'private') as visibility, created_at as "createdAt"
          FROM themes
          WHERE id = $1 AND (user_id = $2 OR COALESCE(visibility, 'private') IN ('shared', 'public'))
        `
        params = [id, userId]
      } else {
        query = `
          SELECT id, user_id as "userId", name, slug, COALESCE(visibility, 'private') as visibility, created_at as "createdAt"
          FROM themes
          WHERE id = $1 AND COALESCE(visibility, 'private') = 'public'
        `
        params = [id]
      }
    } else if (hasUserIdColumn) {
      query = `
        SELECT id, user_id as "userId", name, slug, 'private' as visibility, created_at as "createdAt"
        FROM themes
        WHERE id = $1
      `
      params = [id]
    } else {
      query = `
        SELECT id, ''::uuid as "userId", name, slug, 'private' as visibility, created_at as "createdAt"
        FROM themes
        WHERE id = $1
      `
      params = [id]
    }

    const result = await pool.query(query, params)
    if (result.rows.length === 0) {
      throw new NotFoundError('Theme not found')
    }
    return result.rows[0]
  },

  async findBySlug(slug: string, userId: string | null): Promise<Theme> {
    // Check if columns exist (reuse same logic as findById)
    let hasVisibilityColumn = true
    let hasUserIdColumn = true
    try {
      await pool.query('SELECT visibility, user_id FROM themes LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        try {
          await pool.query('SELECT visibility FROM themes LIMIT 1')
          hasUserIdColumn = false
        } catch {
          try {
            await pool.query('SELECT user_id FROM themes LIMIT 1')
            hasVisibilityColumn = false
          } catch {
            hasVisibilityColumn = false
            hasUserIdColumn = false
          }
        }
      } else {
        throw error
      }
    }

    let query: string
    let params: unknown[]

    if (hasVisibilityColumn && hasUserIdColumn) {
      if (userId) {
        query = `
          SELECT id, user_id as "userId", name, slug, COALESCE(visibility, 'private') as visibility, created_at as "createdAt"
          FROM themes
          WHERE slug = $1 AND (user_id = $2 OR COALESCE(visibility, 'private') IN ('shared', 'public'))
        `
        params = [slug, userId]
      } else {
        query = `
          SELECT id, user_id as "userId", name, slug, COALESCE(visibility, 'private') as visibility, created_at as "createdAt"
          FROM themes
          WHERE slug = $1 AND COALESCE(visibility, 'private') = 'public'
        `
        params = [slug]
      }
    } else if (hasUserIdColumn) {
      query = `
        SELECT id, user_id as "userId", name, slug, 'private' as visibility, created_at as "createdAt"
        FROM themes
        WHERE slug = $1
      `
      params = [slug]
    } else {
      query = `
        SELECT id, ''::uuid as "userId", name, slug, 'private' as visibility, created_at as "createdAt"
        FROM themes
        WHERE slug = $1
      `
      params = [slug]
    }

    const result = await pool.query(query, params)
    if (result.rows.length === 0) {
      throw new NotFoundError('Theme not found')
    }
    return result.rows[0]
  },

  async create(theme: Omit<Theme, 'id' | 'createdAt'>): Promise<Theme> {
    const visibility = theme.visibility || 'private'
    
    // Check if columns exist
    let hasVisibilityColumn = true
    let hasUserIdColumn = true
    try {
      await pool.query('SELECT visibility, user_id FROM themes LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        try {
          await pool.query('SELECT visibility FROM themes LIMIT 1')
          hasUserIdColumn = false
        } catch {
          try {
            await pool.query('SELECT user_id FROM themes LIMIT 1')
            hasVisibilityColumn = false
          } catch {
            hasVisibilityColumn = false
            hasUserIdColumn = false
          }
        }
      } else {
        throw error
      }
    }

    let result
    if (hasVisibilityColumn && hasUserIdColumn) {
      result = await pool.query(
        `INSERT INTO themes (user_id, name, slug, visibility)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id as "userId", name, slug, visibility, created_at as "createdAt"`,
        [theme.userId, theme.name, theme.slug, visibility]
      )
    } else if (hasUserIdColumn) {
      result = await pool.query(
        `INSERT INTO themes (user_id, name, slug)
         VALUES ($1, $2, $3)
         RETURNING id, user_id as "userId", name, slug, 'private' as visibility, created_at as "createdAt"`,
        [theme.userId, theme.name, theme.slug]
      )
    } else {
      result = await pool.query(
        `INSERT INTO themes (name, slug)
         VALUES ($1, $2)
         RETURNING id, ''::uuid as "userId", name, slug, 'private' as visibility, created_at as "createdAt"`,
        [theme.name, theme.slug]
      )
    }
    return result.rows[0]
  },

  async update(id: string, userId: string, updates: Partial<Pick<Theme, 'name' | 'visibility'>>): Promise<Theme> {
    // Check if columns exist
    let hasVisibilityColumn = true
    let hasUserIdColumn = true
    try {
      await pool.query('SELECT visibility, user_id FROM themes LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        try {
          await pool.query('SELECT visibility FROM themes LIMIT 1')
          hasUserIdColumn = false
        } catch {
          try {
            await pool.query('SELECT user_id FROM themes LIMIT 1')
            hasVisibilityColumn = false
          } catch {
            hasVisibilityColumn = false
            hasUserIdColumn = false
          }
        }
      } else {
        throw error
      }
    }

    // Verify ownership if user_id column exists
    if (hasUserIdColumn) {
      const existing = await pool.query(
        'SELECT user_id FROM themes WHERE id = $1',
        [id]
      )
      if (existing.rows.length === 0) {
        throw new NotFoundError('Theme not found')
      }
      if (existing.rows[0].user_id !== userId) {
        throw new ForbiddenError('Not authorized to update this theme')
      }
    }

    const fields: string[] = []
    const values: unknown[] = []
    let paramCount = 1

    if (updates.name !== undefined) {
      fields.push(`name = $${paramCount++}`)
      values.push(updates.name)
      // Update slug if name changes
      const slug = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      fields.push(`slug = $${paramCount++}`)
      values.push(slug)
    }
    if (updates.visibility !== undefined && hasVisibilityColumn) {
      fields.push(`visibility = $${paramCount++}`)
      values.push(updates.visibility)
    }

    if (fields.length === 0) {
      return this.findById(id, userId)
    }

    values.push(id)

    let result
    if (hasVisibilityColumn && hasUserIdColumn) {
      result = await pool.query(
        `UPDATE themes
         SET ${fields.join(', ')}
         WHERE id = $${paramCount}
         RETURNING id, user_id as "userId", name, slug, visibility, created_at as "createdAt"`,
        values
      )
    } else if (hasUserIdColumn) {
      result = await pool.query(
        `UPDATE themes
         SET ${fields.join(', ')}
         WHERE id = $${paramCount}
         RETURNING id, user_id as "userId", name, slug, 'private' as visibility, created_at as "createdAt"`,
        values
      )
    } else {
      result = await pool.query(
        `UPDATE themes
         SET ${fields.join(', ')}
         WHERE id = $${paramCount}
         RETURNING id, ''::uuid as "userId", name, slug, 'private' as visibility, created_at as "createdAt"`,
        values
      )
    }
    return result.rows[0]
  },

  async delete(id: string, userId: string): Promise<void> {
    // Check if user_id column exists
    let hasUserIdColumn = true
    try {
      await pool.query('SELECT user_id FROM themes LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        hasUserIdColumn = false
      } else {
        throw error
      }
    }

    // Verify ownership if user_id column exists
    if (hasUserIdColumn) {
      const existing = await pool.query(
        'SELECT user_id FROM themes WHERE id = $1',
        [id]
      )
      if (existing.rows.length === 0) {
        throw new NotFoundError('Theme not found')
      }
      if (existing.rows[0].user_id !== userId) {
        throw new ForbiddenError('Not authorized to delete this theme')
      }
    }

    const result = await pool.query('DELETE FROM themes WHERE id = $1', [id])
    if (result.rowCount === 0) {
      throw new NotFoundError('Theme not found')
    }
  }
}
