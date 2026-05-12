import { Request, Response } from 'express'
import { writingRevisionRepo } from '../repositories/writing-revision.repo.js'
import { writingService } from '../services/writing.service.js'
import {
  getEffectivePermission,
  canEdit,
} from '../services/writing-permissions.service.js'
import { writingRepo } from '../repositories/writing.repo.js'
import { isAdminRequest, hasSharedAccess } from '../middleware/authorize.middleware.js'
import {
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
} from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'

function userIdOrThrow(req: Request): string {
  const userId = (req as any).userId
  if (!userId) throw new UnauthorizedError('Authentication required')
  return userId
}

export const writingRevisionController = {
  async list(req: Request, res: Response) {
    const { id } = req.params
    const userId = userIdOrThrow(req)
    const admin = isAdminRequest(req)
    // Anyone who can read the frag can read its history. We piggyback
    // on the same access policy as GET /writing/:id by calling findById
    // first; this throws 404/403 consistently for unauthorized readers.
    await writingRepo.findById(id, userId, admin, hasSharedAccess(req))
    const summaries = await writingRevisionRepo.listSummaries(id)
    res.json({ data: summaries })
  },

  async getOne(req: Request, res: Response) {
    const { id, versionNumber } = req.params
    const userId = userIdOrThrow(req)
    const admin = isAdminRequest(req)
    await writingRepo.findById(id, userId, admin, hasSharedAccess(req))
    const v = parseInt(versionNumber, 10)
    if (!Number.isInteger(v) || v < 1) {
      throw new ValidationError('Invalid version number')
    }
    const revision = await writingRevisionRepo.getByVersion(id, v)
    res.json({ data: revision })
  },

  async restore(req: Request, res: Response) {
    const { id, versionNumber } = req.params
    const userId = userIdOrThrow(req)
    const admin = isAdminRequest(req)

    const perm = await getEffectivePermission(id, userId, admin)
    if (!canEdit(perm)) {
      throw new ForbiddenError('Not authorized to restore this writing block')
    }

    const v = parseInt(versionNumber, 10)
    if (!Number.isInteger(v) || v < 1) {
      throw new ValidationError('Invalid version number')
    }
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined
    const writing = await writingService.restore(id, v, userId, admin, note)

    await activityService.logWriting(
      'update',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { restoredFromVersion: v }
    )

    res.json({ data: writing })
  }
}
