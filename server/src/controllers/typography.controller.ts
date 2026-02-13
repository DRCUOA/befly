import { Request, Response } from 'express'
import { typographyService } from '../services/typography.service.js'
import { ValidationError } from '../utils/errors.js'

/**
 * Typography rules controller
 * Public: GET returns enabled rules (no auth)
 * Admin: full CRUD via admin routes
 */
export const typographyController = {
  /** Public: get enabled rules for Write page (no auth required) */
  async getEnabled(req: Request, res: Response) {
    const rules = await typographyService.getEnabledRules()
    res.json({ data: rules })
  },

  /** Admin: get all rules */
  async getAll(req: Request, res: Response) {
    const rules = await typographyService.getAllRules()
    res.json({ data: rules })
  },

  /** Admin: get single rule */
  async getById(req: Request, res: Response) {
    const { id } = req.params
    const rule = await typographyService.getById(id)
    res.json({ data: rule })
  },

  /** Admin: create rule */
  async create(req: Request, res: Response) {
    const rule = await typographyService.create(req.body)
    res.status(201).json({ data: rule })
  },

  /** Admin: update rule */
  async update(req: Request, res: Response) {
    const { id } = req.params
    const rule = await typographyService.update(id, req.body)
    res.json({ data: rule })
  },

  /** Admin: delete rule */
  async delete(req: Request, res: Response) {
    const { id } = req.params
    await typographyService.delete(id)
    res.status(204).send()
  },

  /** Admin: reorder rule (up/down) */
  async reorder(req: Request, res: Response) {
    const { id } = req.params
    const direction = req.body.direction as 'up' | 'down'
    if (direction !== 'up' && direction !== 'down') {
      throw new ValidationError('direction must be "up" or "down"')
    }
    const rules = await typographyService.reorder(id, direction)
    res.json({ data: rules })
  },

  /** Admin: bulk import rules */
  async bulkImport(req: Request, res: Response) {
    const rules = req.body.rules
    if (!Array.isArray(rules)) {
      throw new ValidationError('rules array is required')
    }
    const result = await typographyService.bulkImport(rules)
    res.status(201).json({ data: result })
  }
}
