import { Request, Response, NextFunction } from 'express'
import { authService } from '../services/auth.service.js'
import { UnauthorizedError } from '../utils/errors.js'

/**
 * Auth middleware - validates JWT token and injects user context
 */
export function authMiddleware(
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
    
    // Attach userId to request for use in controllers
    ;(req as any).userId = userId
    
    next()
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token'))
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that work both authenticated and unauthenticated
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.token || 
                req.headers.authorization?.replace('Bearer ', '')

  if (token) {
    try {
      const userId = await authService.verifyToken(token)
      ;(req as any).userId = userId
    } catch (error) {
      // Silently fail for optional auth
    }
  }

  next()
}
