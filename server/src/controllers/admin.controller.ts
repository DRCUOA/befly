import { Request, Response } from 'express'
import { pool } from '../config/db.js'
import { userRepo } from '../repositories/user.repo.js'
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'

/**
 * Admin controller - handles admin-only operations
 * All routes using this controller must be protected by authMiddleware + requireAdmin
 */
export const adminController = {
  /**
   * List all users with pagination
   */
  async listUsers(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0

    const [users, total] = await Promise.all([
      userRepo.findAll(limit, offset),
      userRepo.count()
    ])

    res.json({
      data: users,
      meta: { total, limit, offset }
    })
  },

  /**
   * Get a single user by ID
   */
  async getUser(req: Request, res: Response) {
    const { id } = req.params
    const user = await userRepo.findById(id)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    res.json({ data: user })
  },

  /**
   * Get all content for a specific user (writings, comments, appreciations)
   * Admin-only endpoint for full visibility into user's data
   */
  async getUserContent(req: Request, res: Response) {
    const { id } = req.params

    // Fetch all three in parallel
    const [writings, comments, appreciations] = await Promise.all([
      pool.query(
        `SELECT 
          wb.id, 
          wb.user_id as "userId", 
          wb.title, 
          SUBSTRING(wb.body, 1, 200) as "bodyPreview",
          COALESCE(wb.visibility, 'private') as visibility,
          wb.created_at as "createdAt", 
          wb.updated_at as "updatedAt"
        FROM writing_blocks wb
        WHERE wb.user_id = $1
        ORDER BY wb.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT 
          c.id,
          c.writing_id as "writingId",
          c.user_id as "userId",
          SUBSTRING(c.content, 1, 200) as "contentPreview",
          c.content,
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          wb.title as "writingTitle"
        FROM comments c
        LEFT JOIN writing_blocks wb ON c.writing_id = wb.id
        WHERE c.user_id = $1
        ORDER BY c.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT 
          a.id,
          a.writing_id as "writingId",
          a.user_id as "userId",
          COALESCE(a.reaction_type, 'like') as "reactionType",
          a.created_at as "createdAt",
          wb.title as "writingTitle"
        FROM appreciations a
        LEFT JOIN writing_blocks wb ON a.writing_id = wb.id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC`,
        [id]
      )
    ])

    res.json({
      data: {
        writings: writings.rows,
        comments: comments.rows,
        appreciations: appreciations.rows
      }
    })
  },

  /**
   * Update a user's role or status (admin-only)
   */
  async updateUser(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId
    const { role, status, displayName } = req.body

    // Prevent admin from demoting themselves
    if (id === adminUserId && role && role !== 'admin') {
      throw new ForbiddenError('Cannot change your own admin role')
    }

    // Prevent admin from deactivating themselves
    if (id === adminUserId && status && status !== 'active') {
      throw new ForbiddenError('Cannot deactivate your own account')
    }

    // Validate role if provided
    if (role && !['user', 'admin'].includes(role)) {
      throw new ValidationError('Role must be "user" or "admin"')
    }

    // Validate status if provided
    if (status && !['active', 'inactive', 'suspended'].includes(status)) {
      throw new ValidationError('Status must be "active", "inactive", or "suspended"')
    }

    const updates: Record<string, any> = {}
    if (role !== undefined) updates.role = role
    if (status !== undefined) updates.status = status
    if (displayName !== undefined) updates.displayName = displayName

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No updates provided')
    }

    const updatedUser = await userRepo.update(id, updates)

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'user',
      resourceId: id,
      action: 'update_user',
      details: { updates, targetUserId: id },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.json({ data: updatedUser })
  },

  /**
   * Delete a user (admin-only)
   * Cannot delete yourself
   */
  async deleteUser(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId

    // Prevent admin from deleting themselves
    if (id === adminUserId) {
      throw new ForbiddenError('Cannot delete your own account')
    }

    // Get user details before deletion for logging
    const user = await userRepo.findById(id)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    await userRepo.delete(id)

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'user',
      resourceId: id,
      action: 'delete_user',
      details: { email: user.email, displayName: user.displayName },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(204).send()
  },

  // ─── Content management (admin CRUD on any content) ──────────────

  /**
   * Update a writing's visibility (admin-only)
   */
  async updateWritingVisibility(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId
    const { visibility } = req.body

    if (!visibility || !['private', 'shared', 'public'].includes(visibility)) {
      throw new ValidationError('Visibility must be "private", "shared", or "public"')
    }

    // Verify writing exists
    const existing = await pool.query(
      'SELECT id, title, user_id, visibility FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing not found')
    }

    await pool.query(
      'UPDATE writing_blocks SET visibility = $1, updated_at = NOW() WHERE id = $2',
      [visibility, id]
    )

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'writing_block',
      resourceId: id,
      action: 'update_visibility',
      details: {
        title: existing.rows[0].title,
        oldVisibility: existing.rows[0].visibility,
        newVisibility: visibility,
        ownerId: existing.rows[0].user_id
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.json({ data: { id, visibility } })
  },

  /**
   * Delete a writing (admin-only, any user's writing)
   */
  async deleteWriting(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId

    // Get details before deletion
    const existing = await pool.query(
      'SELECT id, title, user_id FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing not found')
    }

    await pool.query('DELETE FROM writing_blocks WHERE id = $1', [id])

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'writing_block',
      resourceId: id,
      action: 'delete_writing',
      details: {
        title: existing.rows[0].title,
        ownerId: existing.rows[0].user_id
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(204).send()
  },

  /**
   * Delete a comment (admin-only, any user's comment)
   */
  async deleteComment(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId

    // Get details before deletion
    const existing = await pool.query(
      `SELECT c.id, c.content, c.user_id, c.writing_id, wb.title as writing_title
       FROM comments c
       LEFT JOIN writing_blocks wb ON c.writing_id = wb.id
       WHERE c.id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Comment not found')
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [id])

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'comment',
      resourceId: id,
      action: 'delete_comment',
      details: {
        ownerId: existing.rows[0].user_id,
        writingId: existing.rows[0].writing_id,
        writingTitle: existing.rows[0].writing_title
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(204).send()
  },

  /**
   * Delete an appreciation (admin-only, any user's appreciation)
   */
  async deleteAppreciation(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId

    // Get details before deletion
    const existing = await pool.query(
      `SELECT a.id, a.user_id, a.writing_id, COALESCE(a.reaction_type, 'like') as reaction_type, wb.title as writing_title
       FROM appreciations a
       LEFT JOIN writing_blocks wb ON a.writing_id = wb.id
       WHERE a.id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Appreciation not found')
    }

    await pool.query('DELETE FROM appreciations WHERE id = $1', [id])

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'appreciation',
      resourceId: id,
      action: 'delete_appreciation',
      details: {
        ownerId: existing.rows[0].user_id,
        writingId: existing.rows[0].writing_id,
        writingTitle: existing.rows[0].writing_title,
        reactionType: existing.rows[0].reaction_type
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(204).send()
  }
}
