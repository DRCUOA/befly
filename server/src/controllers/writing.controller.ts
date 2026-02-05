import { Request, Response } from 'express'
import { writingService } from '../services/writing.service.js'
import { UnauthorizedError } from '../utils/errors.js'

/**
 * Writing controller - handles HTTP requests/responses
 */
export const writingController = {
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0
    const writings = await writingService.getAll(userId, limit, offset)
    res.json({ data: writings })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const writing = await writingService.getById(id, userId)
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
    res.status(201).json({ data: writing })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const writing = await writingService.update(id, userId, {
      title: req.body.title,
      body: req.body.body,
      themeIds: req.body.themeIds,
      visibility: req.body.visibility
    })
    res.json({ data: writing })
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    await writingService.delete(id, userId)
    res.status(204).send()
  }
}
