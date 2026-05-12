import { pool } from '../config/db.js'
import { writingEditorRepo } from '../repositories/writing-editor.repo.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import type { WritingBlockEditorPermission } from '../models/WritingBlockEditor.js'

/**
 * Effective permission a user has on a frag.
 *
 *   'owner'    - the original author. Has all rights including delete.
 *   'admin'    - role=admin. Has all rights including delete.
 *   'manage'   - granted editor with manage permission.
 *   'edit'     - granted editor with edit permission.
 *   'none'     - no rights beyond whatever the frag's visibility grants
 *                (which is read-only at most). The caller decides whether
 *                to return 403 or 404.
 */
export type EffectivePermission = 'owner' | 'admin' | 'manage' | 'edit' | 'none'

export async function getEffectivePermission(
  writingBlockId: string,
  userId: string | null,
  isAdmin: boolean
): Promise<EffectivePermission> {
  if (isAdmin) return 'admin'
  if (!userId) return 'none'

  const ownerRes = await pool.query(
    `SELECT user_id FROM writing_blocks WHERE id = $1`,
    [writingBlockId]
  )
  if (ownerRes.rows.length === 0) {
    throw new NotFoundError('Writing block not found')
  }
  if (ownerRes.rows[0].user_id === userId) return 'owner'

  const grant = await writingEditorRepo.findGrant(writingBlockId, userId)
  if (!grant) return 'none'
  return grant.permission
}

const FULL_ACCESS: EffectivePermission[] = ['owner', 'admin']

export function canEdit(perm: EffectivePermission): boolean {
  return FULL_ACCESS.includes(perm) || perm === 'manage' || perm === 'edit'
}

export function canManageEditors(perm: EffectivePermission): boolean {
  return FULL_ACCESS.includes(perm) || perm === 'manage'
}

export function canDelete(perm: EffectivePermission): boolean {
  return FULL_ACCESS.includes(perm)
}

export function isOwnerOrAdmin(perm: EffectivePermission): boolean {
  return FULL_ACCESS.includes(perm)
}

export async function requireEdit(
  writingBlockId: string,
  userId: string | null,
  isAdmin: boolean
): Promise<EffectivePermission> {
  const perm = await getEffectivePermission(writingBlockId, userId, isAdmin)
  if (!canEdit(perm)) {
    throw new ForbiddenError('Not authorized to edit this writing block')
  }
  return perm
}

export async function requireManage(
  writingBlockId: string,
  userId: string | null,
  isAdmin: boolean
): Promise<EffectivePermission> {
  const perm = await getEffectivePermission(writingBlockId, userId, isAdmin)
  if (!canManageEditors(perm)) {
    throw new ForbiddenError('Not authorized to manage editors on this writing block')
  }
  return perm
}

const RANK: Record<WritingBlockEditorPermission, number> = { edit: 1, manage: 2 }

export function isValidGrantPermission(p: unknown): p is WritingBlockEditorPermission {
  return p === 'edit' || p === 'manage'
}

export function permissionRank(p: WritingBlockEditorPermission): number {
  return RANK[p]
}
