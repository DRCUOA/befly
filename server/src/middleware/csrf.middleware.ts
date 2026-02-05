import { Request, Response, NextFunction } from 'express'
import { ValidationError } from '../utils/errors.js'
import { randomBytes } from 'crypto'

/**
 * CSRF protection middleware
 * Validates CSRF token for state-changing operations
 * 
 * For GET/HEAD/OPTIONS requests, we skip CSRF (safe methods)
 * For POST/PUT/DELETE/PATCH, we require CSRF token
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Skip CSRF for auth endpoints (they use their own protection)
  if (req.path.startsWith('/api/auth')) {
    return next()
  }

  // Get CSRF token from header or body
  const token = req.headers['x-csrf-token'] || req.body._csrf

  // Get session CSRF token (stored in cookie or session)
  const sessionToken = req.cookies?.['csrf-token'] || (req as any).session?.csrfToken

  if (!token || !sessionToken) {
    return next(new ValidationError('CSRF token missing'))
  }

  // Compare tokens (constant-time comparison)
  if (!constantTimeCompare(token, sessionToken)) {
    return next(new ValidationError('Invalid CSRF token'))
  }

  next()
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Generate CSRF token (simple random token)
 * In production, use crypto.randomBytes for better security
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Middleware to attach CSRF token to response
 * Sets token in cookie and makes it available for frontend
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  // Generate or reuse CSRF token
  let token = req.cookies?.['csrf-token']
  if (!token) {
    token = generateCsrfToken()
    res.cookie('csrf-token', token, {
      httpOnly: false, // Frontend needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    })
  }

  // Attach to response for frontend
  res.locals.csrfToken = token
  ;(req as any).csrfToken = token

  next()
}
