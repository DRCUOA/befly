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
    let query: string
    let params: unknown[]

    if (userId) {
      query = `
        SELECT id, user_id as "userId", name, slug, visibility, created_at as "createdAt"
        FROM themes
        WHERE user_id = $1 OR visibility IN ('shared', 'public')
        ORDER BY name ASC
      `
      params = [userId]
    } else {
      query = `
        SELECT id, user_id as "userId", name, slug, visibility, created_at as "createdAt"
        FROM themes
        WHERE visibility = 'public'
        ORDER BY name ASC
      `
      params = []
    }

    const result = await pool.query(query, params)
    return result.rows
  },

  async findById(id: string, userId: string | null): Promise<Theme> {
    let query: string
    let params: unknown[]

    if (userId) {
      query = `
        SELECT id, user_id as "userId", name, slug, visibility, created_at as "createdAt"
        FROM themes
        WHERE id = $1 AND (user_id = $2 OR visibility IN ('shared', 'public'))
      `
      params = [id, userId]
    } else {
      query = `
        SELECT id, user_id as "userId", name, slug, visibility, created_at as "createdAt"
        FROM themes
        WHERE id = $1 AND visibility = 'public'
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
    let query: string
    let params: unknown[]

    if (userId) {
      query = `
        SELECT id, user_id as "userId", name, slug, visibility, created_at as "createdAt"
        FROM themes
        WHERE slug = $1 AND (user_id = $2 OR visibility IN ('shared', 'public'))
      `
      params = [slug, userId]
    } else {
      query = `
        SELECT id, user_id as "userId", name, slug, visibility, created_at as "createdAt"
        FROM themes
        WHERE slug = $1 AND visibility = 'public'
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
    const result = await pool.query(
      `INSERT INTO themes (user_id, name, slug, visibility)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id as "userId", name, slug, visibility, created_at as "createdAt"`,
      [theme.userId, theme.name, theme.slug, visibility]
    )
    return result.rows[0]
  },

  async update(id: string, userId: string, updates: Partial<Pick<Theme, 'name' | 'visibility'>>): Promise<Theme> {
    // Verify ownership
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
    if (updates.visibility !== undefined) {
      fields.push(`visibility = $${paramCount++}`)
      values.push(updates.visibility)
    }

    if (fields.length === 0) {
      return this.findById(id, userId)
    }

    values.push(id)

    const result = await pool.query(
      `UPDATE themes
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, user_id as "userId", name, slug, visibility, created_at as "createdAt"`,
      values
    )
    return result.rows[0]
  },

  async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
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

    const result = await pool.query('DELETE FROM themes WHERE id = $1', [id])
    if (result.rowCount === 0) {
      throw new NotFoundError('Theme not found')
    }
  }
}
