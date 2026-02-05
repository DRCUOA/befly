import { Request, Response, NextFunction } from 'express'
import { ValidationError } from '../utils/errors.js'

/**
 * Basic validation middleware
 * Extend with schema validation (e.g., zod) as needed
 */
export function validateBody(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = requiredFields.filter(field => !req.body[field])
    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`)
    }
    next()
  }
}
