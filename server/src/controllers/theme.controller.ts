import { Request, Response } from 'express'
import { themeService } from '../services/theme.service.js'
import { UnauthorizedError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'

/**
 * Theme controller - handles HTTP requests/responses
 */
export const themeController = {
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const themes = await themeService.getAll(userId)
    
    // Log view activity
    await activityService.logView(
      'theme',
      null,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { action: 'list' }
    )
    
    res.json({ data: themes })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const theme = await themeService.getById(id, userId)
    
    // Log view activity
    await activityService.logTheme(
      'view',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { name: theme.name }
    )
    
    res.json({ data: theme })
  },

  async create(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const theme = await themeService.create({
      userId,
      name: req.body.name,
      visibility: req.body.visibility || 'private'
    })
    
    // Log create activity
    await activityService.logTheme(
      'create',
      theme.id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { name: theme.name, visibility: theme.visibility }
    )
    
    res.status(201).json({ data: theme })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const theme = await themeService.update(id, userId, {
      name: req.body.name,
      visibility: req.body.visibility
    })
    
    // Log update activity
    await activityService.logTheme(
      'update',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { name: theme.name, visibility: theme.visibility }
    )
    
    res.json({ data: theme })
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    // Get theme details before deletion for logging
    const theme = await themeService.getById(id, userId)
    
    await themeService.delete(id, userId)
    
    // Log delete activity
    await activityService.logTheme(
      'delete',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { name: theme.name }
    )
    
    res.status(204).send()
  }
}
