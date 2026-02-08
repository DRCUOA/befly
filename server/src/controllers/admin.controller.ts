import { Request, Response } from 'express'
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
  }
}
