import { pool } from '../config/db.js'
import { WritingBlock } from '../models/WritingBlock.js'
import { NotFoundError } from '../utils/errors.js'

/**
 * Writing repository - thin DAO layer
 * No ORM magic - explicit SQL queries
 */
export const writingRepo = {
  async findAll(limit: number = 50, offset: number = 0): Promise<WritingBlock[]> {
    const result = await pool.query(
      `SELECT id, user_id as "userId", title, body, created_at as "createdAt", updated_at as "updatedAt"
       FROM writing_blocks
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
    return result.rows
  },

  async findById(id: string): Promise<WritingBlock> {
    const result = await pool.query(
      `SELECT id, user_id as "userId", title, body, created_at as "createdAt", updated_at as "updatedAt"
       FROM writing_blocks
       WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('Writing block not found')
    }
    return result.rows[0]
  },

  async create(writing: Omit<WritingBlock, 'id' | 'createdAt' | 'updatedAt'>): Promise<WritingBlock> {
    const result = await pool.query(
      `INSERT INTO writing_blocks (user_id, title, body)
       VALUES ($1, $2, $3)
       RETURNING id, user_id as "userId", title, body, created_at as "createdAt", updated_at as "updatedAt"`,
      [writing.userId, writing.title, writing.body]
    )
    return result.rows[0]
  },

  async update(id: string, updates: Partial<Pick<WritingBlock, 'title' | 'body'>>): Promise<WritingBlock> {
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

    if (fields.length === 0) {
      return this.findById(id)
    }

    fields.push(`updated_at = NOW()`)
    values.push(id)

    const result = await pool.query(
      `UPDATE writing_blocks
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, user_id as "userId", title, body, created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )
    return result.rows[0]
  },

  async delete(id: string): Promise<void> {
    const result = await pool.query('DELETE FROM writing_blocks WHERE id = $1', [id])
    if (result.rowCount === 0) {
      throw new NotFoundError('Writing block not found')
    }
  }
}
