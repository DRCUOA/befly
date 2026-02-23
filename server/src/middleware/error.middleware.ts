import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors.js'
import { getOffendingLocation, getFullStack, logger } from '../utils/logger.js'

const SENSITIVE_FIELDS = new Set(['password', 'passwordHash', 'token', 'secret', 'authorization'])

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    clean[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : value
  }
  return clean
}

export function errorMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const at = getOffendingLocation(err)
  const statusCode = err instanceof AppError ? err.statusCode : 500

  if (err instanceof AppError) {
    logger.error(`[${statusCode}] ${err.name}: ${err.message}`, {
      code: err.code,
      ...(at && { at }),
      path: req.path,
      method: req.method,
    })

    return res.status(statusCode).json({
      error: err.message,
      code: err.code
    })
  }

  const stack = getFullStack(err)
  logger.error(`[500] Unhandled ${err.constructor?.name || 'Error'}: ${err.message}`, {
    ...(at && { at }),
    path: req.path,
    method: req.method,
    body: req.body ? sanitizeBody(req.body) : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ...(stack && { stack }),
  })

  res.status(500).json({
    error: 'Internal server error'
  })
}
