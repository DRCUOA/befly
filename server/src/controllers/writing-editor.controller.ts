import { Request, Response } from 'express'
import { writingEditorRepo } from '../repositories/writing-editor.repo.js'
import { userRepo } from '../repositories/user.repo.js'
import {
  requireManage,
  getEffectivePermission,
  isOwnerOrAdmin,
  isValidGrantPermission,
} from '../services/writing-permissions.service.js'
import { isAdminRequest } from '../middleware/authorize.middleware.js'
import {
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'

function getUserIdOrThrow(req: Request): string {
  const userId = (req as any).userId
  if (!userId) throw new UnauthorizedError('Authentication required')
  return userId
}

export const writingEditorController = {
  /**
   * GET /api/writing/my-grants
   *
   * Returns the editor grants held by the current user — one row per frag
   * they've been invited to edit. The client uses this on app load to
   * decide whether to surface the edit affordance on each card / row.
   * Cheap: a single indexed lookup, returns just (writingBlockId,
   * permission) pairs.
   */
  async myGrants(req: Request, res: Response) {
    const userId = getUserIdOrThrow(req)
    // We don't bypass for admins here: admins already see the edit
    // affordance via the role check on the client. This endpoint is
    // strictly "what was I personally invited to."
    const grants = await writingEditorRepo.listFragsForUser(userId, 'edit')
    res.json({ data: grants })
  },

  async list(req: Request, res: Response) {
    const { id } = req.params
    const userId = getUserIdOrThrow(req)
    const admin = isAdminRequest(req)
    // Anyone with manage-or-higher can see the editor list. (Editors
    // without manage rights deliberately don't see who else has access.)
    await requireManage(id, userId, admin)
    const editors = await writingEditorRepo.listForBlock(id)
    res.json({ data: editors })
  },

  async upsert(req: Request, res: Response) {
    const { id } = req.params
    const userId = getUserIdOrThrow(req)
    const admin = isAdminRequest(req)
    await requireManage(id, userId, admin)

    const targetUserId: unknown = req.body?.userId
    const permission: unknown = req.body?.permission
    if (typeof targetUserId !== 'string' || !targetUserId) {
      throw new ValidationError('userId is required')
    }
    if (!isValidGrantPermission(permission)) {
      throw new ValidationError("permission must be 'edit' or 'manage'")
    }

    const target = await userRepo.findById(targetUserId)
    if (!target) throw new NotFoundError('Target user not found')

    // The owner cannot be added as an editor of their own frag (they
    // already have full rights), and admins don't need a grant either.
    // We reject the request rather than silently no-op so the caller
    // surfaces a clear UI message.
    const targetPerm = await getEffectivePermission(id, targetUserId, target.role === 'admin')
    if (isOwnerOrAdmin(targetPerm)) {
      throw new ValidationError('That user already has full access to this writing block')
    }

    const grant = await writingEditorRepo.upsert(id, targetUserId, permission, userId)

    await activityService.logWriting(
      'update',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { editorChange: 'upsert', grantedUserId: targetUserId, permission }
    )

    res.status(200).json({ data: grant })
  },

  async patch(req: Request, res: Response) {
    const { id, targetUserId } = req.params
    const userId = getUserIdOrThrow(req)
    const admin = isAdminRequest(req)
    await requireManage(id, userId, admin)

    const permission: unknown = req.body?.permission
    if (!isValidGrantPermission(permission)) {
      throw new ValidationError("permission must be 'edit' or 'manage'")
    }
    const grant = await writingEditorRepo.upsert(id, targetUserId, permission, userId)

    await activityService.logWriting(
      'update',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { editorChange: 'patch', grantedUserId: targetUserId, permission }
    )

    res.json({ data: grant })
  },

  async remove(req: Request, res: Response) {
    const { id, targetUserId } = req.params
    const userId = getUserIdOrThrow(req)
    const admin = isAdminRequest(req)
    const perm = await getEffectivePermission(id, userId, admin)

    // Allow either the owner/admin/manager to revoke any grant,
    // OR the editor themselves to walk away (revoke their own).
    if (
      perm !== 'owner' && perm !== 'admin' && perm !== 'manage'
      && userId !== targetUserId
    ) {
      throw new ForbiddenError('Not authorized to revoke this grant')
    }

    await writingEditorRepo.remove(id, targetUserId)

    await activityService.logWriting(
      'update',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { editorChange: 'remove', grantedUserId: targetUserId }
    )

    res.status(204).send()
  }
}
