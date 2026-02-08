import { pool } from '../config/db.js'
import { Comment } from '../models/Comment.js'
import { NotFoundError } from '../utils/errors.js'

/**
 * Comment repository - thin DAO layer
 */
export const commentRepo = {
  async findByWritingId(writingId: string): Promise<Comment[]> {
    const query = `
      SELECT 
        c.id,
        c.writing_id as "writingId",
        c.user_id as "userId",
        COALESCE(u.display_name, u.email) as "userDisplayName",
        c.content,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt"
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.writing_id = $1
      ORDER BY c.created_at ASC
    `
    
    const result = await pool.query(query, [writingId])
    return result.rows
  },

  async findById(commentId: string): Promise<Comment | null> {
    const query = `
      SELECT 
        c.id,
        c.writing_id as "writingId",
        c.user_id as "userId",
        COALESCE(u.display_name, u.email) as "userDisplayName",
        c.content,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt"
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `
    
    const result = await pool.query(query, [commentId])
    return result.rows[0] || null
  },

  async create(comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'userDisplayName'>): Promise<Comment> {
    const query = `
      INSERT INTO comments (writing_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, writing_id as "writingId", user_id as "userId", content, created_at as "createdAt", updated_at as "updatedAt"
    `
    
    const result = await pool.query(query, [comment.writingId, comment.userId, comment.content])
    
    // Fetch user display name
    const userResult = await pool.query(
      `SELECT COALESCE(display_name, email) as "userDisplayName"
       FROM users
       WHERE id = $1`,
      [comment.userId]
    )
    
    return {
      ...result.rows[0],
      userDisplayName: userResult.rows[0]?.userDisplayName || null
    }
  },

  async update(commentId: string, userId: string, content: string, isAdmin: boolean = false): Promise<Comment> {
    // First verify the comment exists and belongs to the user (admin bypasses ownership)
    const existing = await this.findById(commentId)
    if (!existing) {
      throw new NotFoundError('Comment not found')
    }
    if (!isAdmin && existing.userId !== userId) {
      throw new NotFoundError('Comment not found') // Don't reveal ownership
    }

    // Admin updating someone else's comment: use the comment owner's userId for the query
    const ownerId = existing.userId
    
    const query = `
      UPDATE comments
      SET content = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, writing_id as "writingId", user_id as "userId", content, created_at as "createdAt", updated_at as "updatedAt"
    `
    
    const result = await pool.query(query, [content, commentId])
    
    // Fetch user display name
    const userResult = await pool.query(
      `SELECT COALESCE(display_name, email) as "userDisplayName"
       FROM users
       WHERE id = $1`,
      [ownerId]
    )
    
    return {
      ...result.rows[0],
      userDisplayName: userResult.rows[0]?.userDisplayName || null
    }
  },

  async delete(commentId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    // First verify the comment exists and belongs to the user (admin bypasses ownership)
    const existing = await this.findById(commentId)
    if (!existing) {
      throw new NotFoundError('Comment not found')
    }
    if (!isAdmin && existing.userId !== userId) {
      throw new NotFoundError('Comment not found') // Don't reveal ownership
    }
    
    const query = `DELETE FROM comments WHERE id = $1`
    const result = await pool.query(query, [commentId])
    
    if (result.rowCount === 0) {
      throw new NotFoundError('Comment not found')
    }
  }
}
