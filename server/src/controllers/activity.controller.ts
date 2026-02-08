import { Request, Response } from 'express'
import { activityService } from '../services/activity.service.js'
import { UnauthorizedError } from '../utils/errors.js'

/**
 * Activity Log controller - handles HTTP requests/responses for activity logs
 */
export const activityController = {
  /**
   * Get current user's activity logs
   */
  async getMyLogs(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0

    const logs = await activityService.getUserLogs(userId, limit, offset)
    res.json({ data: logs })
  },

  /**
   * Get activity logs for a specific resource
   */
  async getResourceLogs(req: Request, res: Response) {
    const { resourceType, resourceId } = req.params
    const limit = parseInt(req.query.limit as string) || 100

    const logs = await activityService.getResourceLogs(resourceType, resourceId, limit)
    res.json({ data: logs })
  },

  /**
   * Get recent activity logs (admin only - can be restricted later)
   */
  async getRecentLogs(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string) || 100

    const logs = await activityService.getRecentLogs(limit)
    res.json({ data: logs })
  }
}
