/**
 * Book printing controller.
 *
 * Routes (see manuscript.routes.ts for wiring):
 *   GET    /api/manuscripts/:manuscriptId/printings
 *   POST   /api/manuscripts/:manuscriptId/printings
 *   GET    /api/manuscripts/:manuscriptId/printings/:printingId
 *   PUT    /api/manuscripts/:manuscriptId/printings/:printingId
 *   DELETE /api/manuscripts/:manuscriptId/printings/:printingId
 *
 * All routes require authMiddleware. Authorisation against the parent
 * manuscript is enforced inside the service.
 */
import { Request, Response } from 'express'
import { bookPrintingService } from '../services/book-printing.service.js'
import { ValidationError } from '../utils/errors.js'

function requireUserId(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId
  if (!userId) throw new ValidationError('User not authenticated')
  return userId
}

function isAdminReq(req: Request): boolean {
  return (req as Request & { userRole?: string }).userRole === 'admin'
}

export const bookPrintingController = {
  async list(req: Request, res: Response) {
    const userId = requireUserId(req)
    const printings = await bookPrintingService.list(
      req.params.manuscriptId,
      userId,
      isAdminReq(req)
    )
    res.json({ data: printings })
  },

  async get(req: Request, res: Response) {
    const userId = requireUserId(req)
    const printing = await bookPrintingService.get(
      req.params.manuscriptId,
      req.params.printingId,
      userId,
      isAdminReq(req)
    )
    res.json({ data: printing })
  },

  async create(req: Request, res: Response) {
    const userId = requireUserId(req)
    const printing = await bookPrintingService.create({
      manuscriptId: req.params.manuscriptId,
      userId,
      body: req.body,
      isAdmin: isAdminReq(req),
    })
    res.status(201).json({ data: printing })
  },

  async update(req: Request, res: Response) {
    const userId = requireUserId(req)
    const printing = await bookPrintingService.update({
      manuscriptId: req.params.manuscriptId,
      printingId: req.params.printingId,
      userId,
      body: req.body,
      isAdmin: isAdminReq(req),
    })
    res.json({ data: printing })
  },

  async delete(req: Request, res: Response) {
    const userId = requireUserId(req)
    await bookPrintingService.delete({
      manuscriptId: req.params.manuscriptId,
      printingId: req.params.printingId,
      userId,
      isAdmin: isAdminReq(req),
    })
    res.json({ data: { deleted: req.params.printingId } })
  },
}
