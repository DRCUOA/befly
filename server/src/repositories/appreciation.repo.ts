import { pool } from '../config/db.js'
import { Appreciation } from '../models/Appreciation.js'
import { NotFoundError } from '../utils/errors.js'

/**
 * Appreciation repository - thin DAO layer
 */
export const appreciationRepo = {
  async findByWritingId(writingId: string): Promise<Appreciation[]> {
    const result = await pool.query(
      `SELECT id, writing_id as "writingId", user_id as "userId", created_at as "createdAt"
       FROM appreciations
       WHERE writing_id = $1
       ORDER BY created_at DESC`,
      [writingId]
    )
    return result.rows
  },

  async create(appreciation: Omit<Appreciation, 'id' | 'createdAt'>): Promise<Appreciation> {
    // Check if already exists
    const existing = await pool.query(
      `SELECT id FROM appreciations
       WHERE writing_id = $1 AND user_id = $2`,
      [appreciation.writingId, appreciation.userId]
    )

    if (existing.rows.length > 0) {
      throw new Error('Appreciation already exists')
    }

    const result = await pool.query(
      `INSERT INTO appreciations (writing_id, user_id)
       VALUES ($1, $2)
       RETURNING id, writing_id as "writingId", user_id as "userId", created_at as "createdAt"`,
      [appreciation.writingId, appreciation.userId]
    )
    return result.rows[0]
  },

  async delete(writingId: string, userId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM appreciations
       WHERE writing_id = $1 AND user_id = $2`,
      [writingId, userId]
    )
    if (result.rowCount === 0) {
      throw new NotFoundError('Appreciation not found')
    }
  }
}
