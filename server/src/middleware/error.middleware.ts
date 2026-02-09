import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors.js'
import { getOffendingLocation, logger } from '../utils/logger.js'

export function errorMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const at = getOffendingLocation(err)
  logger.error('Error:', {
    message: err.message,
    ...(at && { at }),
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

  logger.error('Unhandled error:', { message: err.message, ...(at && { at }) })
  res.status(500).json({
    error: 'Internal server error'
  })
}
