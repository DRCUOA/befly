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
              COALESCE(role, 'user') as role, status, created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE email = $1`,
      [email]
    )
    return result.rows[0] || null
  },

  async findById(id: string): Promise<User | null> {
    // Check if role column exists, if not use COALESCE to default to 'user'
    const result = await pool.query(
      `SELECT id, email, display_name as "displayName", 
              COALESCE(role, 'user') as role, 
              status, 
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

    // Compatibility insert order:
    // 1) Newer schema with role + legacy username still present/not-null
    // 2) Legacy schema without role but with username
    // 3) Schema where username has been dropped but role exists
    // 4) Minimal schema without role and without username
    const attempts: Array<{ query: string; values: unknown[] }> = [
      {
        query: `INSERT INTO users (email, password_hash, display_name, role, username)
                VALUES ($1, $2, $3, $4, $1)
                RETURNING id, email, display_name as "displayName", COALESCE(role, 'user') as role, status, 
                          created_at as "createdAt", updated_at as "updatedAt"`,
        values: [user.email, user.passwordHash, user.displayName, role]
      },
      {
        query: `INSERT INTO users (email, password_hash, display_name, username)
                VALUES ($1, $2, $3, $1)
                RETURNING id, email, display_name as "displayName", 'user' as role, status, 
                          created_at as "createdAt", updated_at as "updatedAt"`,
        values: [user.email, user.passwordHash, user.displayName]
      },
      {
        query: `INSERT INTO users (email, password_hash, display_name, role)
                VALUES ($1, $2, $3, $4)
                RETURNING id, email, display_name as "displayName", COALESCE(role, 'user') as role, status, 
                          created_at as "createdAt", updated_at as "updatedAt"`,
        values: [user.email, user.passwordHash, user.displayName, role]
      },
      {
        query: `INSERT INTO users (email, password_hash, display_name)
                VALUES ($1, $2, $3)
                RETURNING id, email, display_name as "displayName", 'user' as role, status, 
                          created_at as "createdAt", updated_at as "updatedAt"`,
        values: [user.email, user.passwordHash, user.displayName]
      }
    ]

    let lastError: unknown

    for (const attempt of attempts) {
      try {
        const result = await pool.query(attempt.query, attempt.values)
        return result.rows[0]
      } catch (error: any) {
        // Fallback only for schema-shape mismatch.
        if (error.code === '42703') {
          lastError = error
          continue
        }
        throw error
      }
    }

    throw lastError
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
       RETURNING id, email, display_name as "displayName", COALESCE(role, 'user') as role, status, 
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )
    return result.rows[0]
  }
}
