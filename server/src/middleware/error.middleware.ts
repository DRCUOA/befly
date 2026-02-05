import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export function errorMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Fail loud and early - log all errors with context
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode: err instanceof AppError ? err.statusCode : 500
  })

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    })
  }

  // Unknown error - don't expose internal details
  logger.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error'
  })
}
