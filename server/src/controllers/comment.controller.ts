import { Request, Response } from 'express'
import { commentService } from '../services/comment.service.js'
import { UnauthorizedError, ValidationError } from '../utils/errors.js'

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
    res.status(201).json({ data: comment })
  },

  async update(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { commentId } = req.params
    const { content } = req.body
    
    if (!content || typeof content !== 'string') {
      throw new ValidationError('Comment content is required')
    }
    
    const comment = await commentService.update(commentId, userId, content)
    res.json({ data: comment })
  },

  async remove(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { commentId } = req.params
    await commentService.remove(commentId, userId)
    res.status(204).send()
  }
}
