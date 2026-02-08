import { Request, Response } from 'express'
import { commentService } from '../services/comment.service.js'
import { UnauthorizedError, ValidationError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'
import { isAdminRequest } from '../middleware/authorize.middleware.js'

/**
 * Comment controller - handles HTTP requests/responses
 */
export const commentController = {
  async getByWritingId(req: Request, res: Response) {
    const { writingId } = req.params
    const comments = await commentService.getByWritingId(writingId)
    res.json({ data: comments })
  },

  async create(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { writingId } = req.params
    const { content } = req.body
    
    if (!content || typeof content !== 'string') {
      throw new ValidationError('Comment content is required')
    }
    
    const comment = await commentService.create(writingId, userId, content)
    
    // Log comment creation activity
    await activityService.logComment(
      'create',
      comment.id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { writingId, contentLength: content.length }
    )
    
    res.status(201).json({ data: comment })
  },

  async update(req: Request, res: Response) {
    const userId = (req as any).userId
    const admin = isAdminRequest(req)
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { commentId } = req.params
    const { content } = req.body
    
    if (!content || typeof content !== 'string') {
      throw new ValidationError('Comment content is required')
    }
    
    const comment = await commentService.update(commentId, userId, content, admin)
    
    // Log comment update activity
    await activityService.logComment(
      'update',
      commentId,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { contentLength: content.length }
    )
    
    res.json({ data: comment })
  },

  async remove(req: Request, res: Response) {
    const userId = (req as any).userId
    const admin = isAdminRequest(req)
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { commentId } = req.params
    
    // Get comment details before deletion for logging
    const comment = await commentService.getById(commentId)
    
    await commentService.remove(commentId, userId, admin)
    
    // Log comment deletion activity
    await activityService.logComment(
      'delete',
      commentId,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { writingId: comment.writingId }
    )
    
    res.status(204).send()
  }
}
