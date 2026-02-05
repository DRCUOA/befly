import { Request, Response, NextFunction } from 'express'

/**
 * Auth middleware placeholder
 * Future: JWT validation, session checks, etc.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Placeholder - no auth required for now
  // Future: validate JWT token, check session, etc.
  next()
}
