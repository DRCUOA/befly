import { Request, Response, NextFunction } from 'express'
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js'
import { userRepo } from '../repositories/user.repo.js'

/**
 * Authorization middleware - checks user roles
 */

/**
 * Require user to be authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId
  if (!userId) {
    return next(new UnauthorizedError('Authentication required'))
  }
  next()
}

/**
 * Require user to have admin role
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId
  if (!userId) {
    return next(new UnauthorizedError('Authentication required'))
  }

  try {
    const user = await userRepo.findById(userId)
    if (!user) {
      return next(new UnauthorizedError('User not found'))
    }

    if (user.role !== 'admin') {
      return next(new ForbiddenError('Admin access required'))
    }

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Require user to own resource or be admin
 * Usage: requireOwnershipOrAdmin('userId')
 */
export function requireOwnershipOrAdmin(ownerIdField: string = 'userId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId
    if (!userId) {
      return next(new UnauthorizedError('Authentication required'))
    }

    try {
      const user = await userRepo.findById(userId)
      if (!user) {
        return next(new UnauthorizedError('User not found'))
      }

      // Admin can access anything
      if (user.role === 'admin') {
        return next()
      }

      // Check ownership
      const resourceOwnerId = req.params[ownerIdField] || req.body[ownerIdField]
      if (resourceOwnerId !== userId) {
        return next(new ForbiddenError('Not authorized to access this resource'))
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
