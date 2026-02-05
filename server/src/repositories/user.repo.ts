import { pool } from '../config/db.js'
import { User, UserWithPassword } from '../models/User.js'
import { NotFoundError } from '../utils/errors.js'

/**
 * User repository - thin DAO layer
 */
export const userRepo = {
  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await pool.query(
      `SELECT id, email, password_hash as "passwordHash", display_name as "displayName", 
              role, status, created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE email = $1`,
      [email]
    )
    return result.rows[0] || null
  },

  async findById(id: string): Promise<User | null> {
    const result = await pool.query(
      `SELECT id, email, display_name as "displayName", role, status, 
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE id = $1 AND status = 'active'`,
      [id]
    )
    return result.rows[0] || null
  },

  async create(user: {
    email: string
    passwordHash: string
    displayName: string
    role?: 'user' | 'admin'
  }): Promise<User> {
    const role = user.role || 'user'
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name as "displayName", role, status, 
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [user.email, user.passwordHash, user.displayName, role]
    )
    return result.rows[0]
  },

  async update(id: string, updates: Partial<{
    displayName: string
    passwordHash: string
    status: string
    role: 'user' | 'admin'
  }>): Promise<User> {
    const fields: string[] = []
    const values: unknown[] = []
    let paramCount = 1

    if (updates.displayName !== undefined) {
      fields.push(`display_name = $${paramCount++}`)
      values.push(updates.displayName)
    }
    if (updates.passwordHash !== undefined) {
      fields.push(`password_hash = $${paramCount++}`)
      values.push(updates.passwordHash)
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount++}`)
      values.push(updates.status)
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${paramCount++}`)
      values.push(updates.role)
    }

    if (fields.length === 0) {
      const user = await this.findById(id)
      if (!user) throw new NotFoundError('User not found')
      return user
    }

    fields.push(`updated_at = NOW()`)
    values.push(id)

    const result = await pool.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, display_name as "displayName", role, status, 
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )
    return result.rows[0]
  }
}
