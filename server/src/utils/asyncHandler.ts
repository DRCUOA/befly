import { Request, Response, NextFunction } from 'express'

/**
 * Wrapper for async route handlers to catch errors
 * Express doesn't automatically catch errors from async functions
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
