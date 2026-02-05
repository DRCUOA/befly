import { pool } from '../config/db.js'
import { Appreciation } from '../models/Appreciation.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/**
 * Appreciation repository - thin DAO layer
 */
export const appreciationRepo = {
  async findByWritingId(writingId: string): Promise<Appreciation[]> {
    // Check if reaction_type column exists
    let hasReactionType = true
    try {
      await pool.query('SELECT reaction_type FROM appreciations LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        hasReactionType = false
      } else {
        throw error
      }
    }

    let query: string
    if (hasReactionType) {
      query = `
        SELECT 
          a.id, 
          a.writing_id as "writingId", 
          a.user_id as "userId",
          COALESCE(u.display_name, u.email) as "userDisplayName",
          COALESCE(a.reaction_type, 'like') as "reactionType",
          a.created_at as "createdAt"
        FROM appreciations a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.writing_id = $1
        ORDER BY a.created_at DESC
      `
    } else {
      query = `
        SELECT 
          a.id, 
          a.writing_id as "writingId", 
          a.user_id as "userId",
          COALESCE(u.display_name, u.email) as "userDisplayName",
          'like' as "reactionType",
          a.created_at as "createdAt"
        FROM appreciations a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.writing_id = $1
        ORDER BY a.created_at DESC
      `
    }
    
    const result = await pool.query(query, [writingId])
    return result.rows
  },

  async create(appreciation: Omit<Appreciation, 'id' | 'createdAt'>): Promise<Appreciation> {
    const reactionType = appreciation.reactionType || 'like'
    
    // Check if reaction_type column exists
    let hasReactionType = true
    try {
      await pool.query('SELECT reaction_type FROM appreciations LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        hasReactionType = false
      } else {
        throw error
      }
    }

    // Check if user already has this reaction type for this writing
    let existingQuery: string
    if (hasReactionType) {
      existingQuery = `
        SELECT id FROM appreciations
        WHERE writing_id = $1 AND user_id = $2 AND reaction_type = $3
      `
    } else {
      existingQuery = `
        SELECT id FROM appreciations
        WHERE writing_id = $1 AND user_id = $2
      `
    }

    const existingParams = hasReactionType 
      ? [appreciation.writingId, appreciation.userId, reactionType]
      : [appreciation.writingId, appreciation.userId]
    
    const existing = await pool.query(existingQuery, existingParams)

    if (existing.rows.length > 0) {
      logger.warn('Appreciation creation failed: already exists')
      throw new ValidationError('Appreciation already exists')
    }

    // If user has a different reaction, update it instead
    if (hasReactionType) {
      const otherReaction = await pool.query(
        `SELECT id, reaction_type FROM appreciations
         WHERE writing_id = $1 AND user_id = $2 AND reaction_type != $3`,
        [appreciation.writingId, appreciation.userId, reactionType]
      )

      if (otherReaction.rows.length > 0) {
        // Update existing reaction to new type
        const updateResult = await pool.query(
          `UPDATE appreciations
           SET reaction_type = $1, created_at = NOW()
           WHERE writing_id = $2 AND user_id = $3 AND id = $4
           RETURNING id, writing_id as "writingId", user_id as "userId", reaction_type as "reactionType", created_at as "createdAt"`,
          [reactionType, appreciation.writingId, appreciation.userId, otherReaction.rows[0].id]
        )

        // Fetch user display name
        const userResult = await pool.query(
          `SELECT COALESCE(display_name, email) as "userDisplayName"
           FROM users
           WHERE id = $1`,
          [appreciation.userId]
        )

        return {
          ...updateResult.rows[0],
          userDisplayName: userResult.rows[0]?.userDisplayName || null
        }
      }
    }

    // Insert new reaction
    let insertQuery: string
    let insertParams: unknown[]
    if (hasReactionType) {
      insertQuery = `
        INSERT INTO appreciations (writing_id, user_id, reaction_type)
        VALUES ($1, $2, $3)
        RETURNING id, writing_id as "writingId", user_id as "userId", reaction_type as "reactionType", created_at as "createdAt"
      `
      insertParams = [appreciation.writingId, appreciation.userId, reactionType]
    } else {
      insertQuery = `
        INSERT INTO appreciations (writing_id, user_id)
        VALUES ($1, $2)
        RETURNING id, writing_id as "writingId", user_id as "userId", created_at as "createdAt"
      `
      insertParams = [appreciation.writingId, appreciation.userId]
    }

    const result = await pool.query(insertQuery, insertParams)
    
    // Fetch user display name for the response
    const userResult = await pool.query(
      `SELECT COALESCE(display_name, email) as "userDisplayName"
       FROM users
       WHERE id = $1`,
      [appreciation.userId]
    )
    
    return {
      ...result.rows[0],
      reactionType: hasReactionType ? (result.rows[0].reactionType || 'like') : 'like',
      userDisplayName: userResult.rows[0]?.userDisplayName || null
    }
  },

  async delete(writingId: string, userId: string, reactionType?: string): Promise<void> {
    // Check if reaction_type column exists
    let hasReactionType = true
    try {
      await pool.query('SELECT reaction_type FROM appreciations LIMIT 1')
    } catch (error: any) {
      if (error.code === '42703') {
        hasReactionType = false
      } else {
        throw error
      }
    }

    let query: string
    let params: unknown[]
    
    if (hasReactionType && reactionType) {
      // Delete specific reaction type
      query = `DELETE FROM appreciations
               WHERE writing_id = $1 AND user_id = $2 AND reaction_type = $3`
      params = [writingId, userId, reactionType]
    } else {
      // Delete all reactions from this user for this writing (backward compatibility)
      query = `DELETE FROM appreciations
               WHERE writing_id = $1 AND user_id = $2`
      params = [writingId, userId]
    }

    const result = await pool.query(query, params)
    if (result.rowCount === 0) {
      throw new NotFoundError('Appreciation not found')
    }
  }
}
