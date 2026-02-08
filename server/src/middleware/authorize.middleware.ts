import { Request, Response, NextFunction } from 'express'
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js'

/**
 * Authorization middleware - checks user roles
 * 
 * Relies on authMiddleware having already attached userId and userRole
 * to the request object. This avoids redundant DB lookups.
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
 * Require user to have admin role.
 * Must be used AFTER authMiddleware which attaches userRole.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId
  if (!userId) {
    return next(new UnauthorizedError('Authentication required'))
  }

  const userRole = (req as any).userRole
  if (userRole !== 'admin') {
    return next(new ForbiddenError('Admin access required'))
  }

  next()
}

/**
 * Helper to check if the current request is from an admin user.
 * Can be used in controllers to pass isAdmin flag to services/repos.
 */
export function isAdminRequest(req: Request): boolean {
  return (req as any).userRole === 'admin'
}
