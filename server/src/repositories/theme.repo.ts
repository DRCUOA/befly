import { pool } from '../config/db.js'
import { Theme } from '../models/Theme.js'
import { NotFoundError } from '../utils/errors.js'

/**
 * Theme repository - thin DAO layer
 */
export const themeRepo = {
  async findAll(): Promise<Theme[]> {
    const result = await pool.query(
      `SELECT id, name, slug, created_at as "createdAt"
       FROM themes
       ORDER BY name ASC`
    )
    return result.rows
  },

  async findById(id: string): Promise<Theme> {
    const result = await pool.query(
      `SELECT id, name, slug, created_at as "createdAt"
       FROM themes
       WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('Theme not found')
    }
    return result.rows[0]
  },

  async findBySlug(slug: string): Promise<Theme> {
    const result = await pool.query(
      `SELECT id, name, slug, created_at as "createdAt"
       FROM themes
       WHERE slug = $1`,
      [slug]
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('Theme not found')
    }
    return result.rows[0]
  },

  async create(theme: Omit<Theme, 'id' | 'createdAt'>): Promise<Theme> {
    const result = await pool.query(
      `INSERT INTO themes (name, slug)
       VALUES ($1, $2)
       RETURNING id, name, slug, created_at as "createdAt"`,
      [theme.name, theme.slug]
    )
    return result.rows[0]
  }
}
