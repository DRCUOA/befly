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
    const reactionType = req.body.reactionType || 'like'
    const appreciation = await appreciationService.create(writingId, userId, reactionType)
    res.status(201).json({ data: appreciation })
  },

  async remove(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { writingId } = req.params
    const reactionType = req.query.reactionType as string | undefined
    await appreciationService.remove(writingId, userId, reactionType)
    res.status(204).send()
  }
}
