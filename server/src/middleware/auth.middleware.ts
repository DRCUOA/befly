import { Request, Response, NextFunction } from 'express'
import { authService } from '../services/auth.service.js'
import { userRepo } from '../repositories/user.repo.js'
import { UnauthorizedError } from '../utils/errors.js'

/**
 * Auth middleware - validates JWT token and injects user context
 * Attaches userId and userRole to the request object
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Get token from cookie or Authorization header
  const token = req.cookies?.token || 
                req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return next(new UnauthorizedError('Authentication required'))
  }

  try {
    // Verify token and get userId
    const userId = await authService.verifyToken(token)
    
    // Fetch user to get role
    const user = await userRepo.findById(userId)
    if (!user) {
      return next(new UnauthorizedError('User not found'))
    }
    
    // Attach userId and userRole to request for use in controllers
    ;(req as any).userId = userId
    ;(req as any).userRole = user.role || 'user'
    
    next()
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token'))
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that work both authenticated and unauthenticated
 * Also attaches userRole when authenticated
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.token || 
                req.headers.authorization?.replace('Bearer ', '')

  if (token) {
    try {
      const userId = await authService.verifyToken(token)
      const user = await userRepo.findById(userId)
      if (user) {
        ;(req as any).userId = userId
        ;(req as any).userRole = user.role || 'user'
      }
    } catch (error) {
      // Silently fail for optional auth
    }
  }

  next()
}
