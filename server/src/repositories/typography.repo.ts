import { pool } from '../config/db.js'
import type { TypographyRuleRecord } from '@shared/TypographyRule'
import { NotFoundError } from '../utils/errors.js'

/**
 * Typography rules repository — thin DAO layer
 */
export const typographyRepo = {
  async findAll(enabledOnly: boolean = false): Promise<TypographyRuleRecord[]> {
    const query = enabledOnly
      ? `SELECT id, sort_order as "sortOrder", enabled, rule_id as "ruleId", description, pattern, replacement, created_at as "createdAt", updated_at as "updatedAt"
         FROM typography_rules WHERE enabled = true ORDER BY sort_order ASC, created_at ASC`
      : `SELECT id, sort_order as "sortOrder", enabled, rule_id as "ruleId", description, pattern, replacement, created_at as "createdAt", updated_at as "updatedAt"
         FROM typography_rules ORDER BY sort_order ASC, created_at ASC`
    const result = await pool.query(query)
    return result.rows
  },

  async findById(id: string): Promise<TypographyRuleRecord | null> {
    const result = await pool.query(
      `SELECT id, sort_order as "sortOrder", enabled, rule_id as "ruleId", description, pattern, replacement, created_at as "createdAt", updated_at as "updatedAt"
       FROM typography_rules WHERE id = $1`,
      [id]
    )
    return result.rows[0] ?? null
  },

  async create(data: {
    ruleId: string
    description: string
    pattern: string
    replacement: string
    sortOrder: number
  }): Promise<TypographyRuleRecord> {
    const result = await pool.query(
      `INSERT INTO typography_rules (rule_id, description, pattern, replacement, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sort_order as "sortOrder", enabled, rule_id as "ruleId", description, pattern, replacement, created_at as "createdAt", updated_at as "updatedAt"`,
      [data.ruleId, data.description, data.pattern, data.replacement, data.sortOrder]
    )
    return result.rows[0]
  },

  async update(id: string, updates: Partial<{
    ruleId: string
    description: string
    pattern: string
    replacement: string
    sortOrder: number
    enabled: boolean
  }>): Promise<TypographyRuleRecord> {
    const fields: string[] = []
    const values: unknown[] = []
    let paramCount = 1

    if (updates.ruleId !== undefined) {
      fields.push(`rule_id = $${paramCount++}`)
      values.push(updates.ruleId)
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`)
      values.push(updates.description)
    }
    if (updates.pattern !== undefined) {
      fields.push(`pattern = $${paramCount++}`)
      values.push(updates.pattern)
    }
    if (updates.replacement !== undefined) {
      fields.push(`replacement = $${paramCount++}`)
      values.push(updates.replacement)
    }
    if (updates.sortOrder !== undefined) {
      fields.push(`sort_order = $${paramCount++}`)
      values.push(updates.sortOrder)
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramCount++}`)
      values.push(updates.enabled)
    }

    if (fields.length === 0) {
      const row = await this.findById(id)
      if (!row) throw new NotFoundError('Typography rule not found')
      return row
    }

    fields.push(`updated_at = NOW()`)
    values.push(id)

    const result = await pool.query(
      `UPDATE typography_rules SET ${fields.join(', ')} WHERE id = $${paramCount}
       RETURNING id, sort_order as "sortOrder", enabled, rule_id as "ruleId", description, pattern, replacement, created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('Typography rule not found')
    }
    return result.rows[0]
  },

  async delete(id: string): Promise<void> {
    const result = await pool.query('DELETE FROM typography_rules WHERE id = $1', [id])
    if (result.rowCount === 0) {
      throw new NotFoundError('Typography rule not found')
    }
  }
}
