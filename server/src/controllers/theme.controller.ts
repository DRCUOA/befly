import { Request, Response } from 'express'
import { themeService } from '../services/theme.service.js'

/**
 * Theme controller - handles HTTP requests/responses
 */
export const themeController = {
  async getAll(req: Request, res: Response) {
    const themes = await themeService.getAll()
    res.json({ data: themes })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const theme = await themeService.getById(id)
    res.json({ data: theme })
  },

  async create(req: Request, res: Response) {
    const theme = await themeService.create({
      name: req.body.name
    })
    res.status(201).json({ data: theme })
  }
}
