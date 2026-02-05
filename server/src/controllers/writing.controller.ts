import { Request, Response } from 'express'
import { writingService } from '../services/writing.service.js'

/**
 * Writing controller - handles HTTP requests/responses
 */
export const writingController = {
  async getAll(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0
    const writings = await writingService.getAll(limit, offset)
    res.json({ data: writings })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const writing = await writingService.getById(id)
    res.json({ data: writing })
  },

  async create(req: Request, res: Response) {
    // TODO: Get userId from auth middleware
    const userId = 'temp-user-id'
    const writing = await writingService.create({
      userId,
      title: req.body.title,
      body: req.body.body
    })
    res.status(201).json({ data: writing })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const writing = await writingService.update(id, {
      title: req.body.title,
      body: req.body.body
    })
    res.json({ data: writing })
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params
    await writingService.delete(id)
    res.status(204).send()
  }
}
