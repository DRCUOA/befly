import { Request, Response } from 'express'
import { themeService } from '../services/theme.service.js'
import { UnauthorizedError } from '../utils/errors.js'

/**
 * Theme controller - handles HTTP requests/responses
 */
export const themeController = {
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const themes = await themeService.getAll(userId)
    res.json({ data: themes })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const theme = await themeService.getById(id, userId)
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
    res.json({ data: theme })
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    await themeService.delete(id, userId)
    res.status(204).send()
  }
}
