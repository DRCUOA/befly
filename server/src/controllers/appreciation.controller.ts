import { Request, Response } from 'express'
import { appreciationService } from '../services/appreciation.service.js'
import { UnauthorizedError } from '../utils/errors.js'

/**
 * Appreciation controller - handles HTTP requests/responses
 */
export const appreciationController = {
  async getByWritingId(req: Request, res: Response) {
    const { writingId } = req.params
    const appreciations = await appreciationService.getByWritingId(writingId)
    res.json({ data: appreciations })
  },

  async create(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { writingId } = req.params
    let reactionType = req.body.reactionType || 'like'
    
    // Validate reaction type
    const validReactionTypes = ['like', 'love', 'laugh', 'wow', 'sad', 'angry']
    if (!validReactionTypes.includes(reactionType)) {
      reactionType = 'like' // Default to 'like' if invalid
    }
    
    const appreciation = await appreciationService.create(writingId, userId, reactionType as any)
    res.status(201).json({ data: appreciation })
  },

  async remove(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { writingId } = req.params
    const reactionType = req.query.reactionType as string | undefined
    // Validate reaction type if provided
    const validReactionTypes = ['like', 'love', 'laugh', 'wow', 'sad', 'angry']
    const validReactionType = reactionType && validReactionTypes.includes(reactionType) 
      ? reactionType as 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry'
      : undefined
    await appreciationService.remove(writingId, userId, validReactionType)
    res.status(204).send()
  }
}
