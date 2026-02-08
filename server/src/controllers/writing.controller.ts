import { Request, Response } from 'express'
import { writingService } from '../services/writing.service.js'
import { UnauthorizedError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent, getUserId } from '../utils/activity-logger.js'
import { isAdminRequest } from '../middleware/authorize.middleware.js'

/**
 * Writing controller - handles HTTP requests/responses
 */
export const writingController = {
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const admin = isAdminRequest(req)
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0
    const writings = await writingService.getAll(userId, limit, offset, admin)
    
    // Log view activity
    await activityService.logView(
      'writing_block',
      null,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { action: 'list', limit, offset }
    )
    
    res.json({ data: writings })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const admin = isAdminRequest(req)
    const writing = await writingService.getById(id, userId, admin)
    
    // Log view activity
    await activityService.logWriting(
      'view',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { title: writing.title }
    )
    
    res.json({ data: writing })
  },

  async create(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const writing = await writingService.create({
      userId,
      title: req.body.title,
      body: req.body.body,
      themeIds: req.body.themeIds || [],
      visibility: req.body.visibility || 'private'
    })
    
    // Log create activity
    await activityService.logWriting(
      'create',
      writing.id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { title: writing.title, visibility: writing.visibility }
    )
    
    res.status(201).json({ data: writing })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    const admin = isAdminRequest(req)
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const writing = await writingService.update(id, userId, {
      title: req.body.title,
      body: req.body.body,
      themeIds: req.body.themeIds,
      visibility: req.body.visibility
    }, admin)
    
    // Log update activity
    await activityService.logWriting(
      'update',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { title: writing.title, visibility: writing.visibility }
    )
    
    res.json({ data: writing })
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    const admin = isAdminRequest(req)
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    // Get writing details before deletion for logging
    const writing = await writingService.getById(id, userId, admin)
    
    await writingService.delete(id, userId, admin)
    
    // Log delete activity
    await activityService.logWriting(
      'delete',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { title: writing.title }
    )
    
    res.status(204).send()
  }
}
