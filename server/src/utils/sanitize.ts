/**
 * Input sanitization and output escaping utilities
 */
import { ValidationError } from './errors.js'

/**
 * Sanitize string input - remove dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input)
  }
  // Remove null bytes and trim
  return input.replace(/\0/g, '').trim()
}

/**
 * Sanitize markdown input
 */
export function sanitizeMarkdown(input: string): string {
  if (typeof input !== 'string') {
    return String(input)
  }
  // Remove null bytes and trim
  return input.replace(/\0/g, '').trim()
}

/**
 * Escape HTML entities for output
 * Prevents XSS attacks when rendering user content
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return String(text)
  }
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Escape for use in JSON (already handled by JSON.stringify, but explicit)
 */
export function escapeJson(text: string): string {
  if (typeof text !== 'string') {
    return String(text)
  }
  // JSON.stringify properly escapes, but we ensure it's a string
  return JSON.stringify(text).slice(1, -1) // Remove quotes added by JSON.stringify
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    throw new ValidationError('Email must be a string')
  }
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const cleaned = email.toLowerCase().trim()
  if (!emailRegex.test(cleaned)) {
    throw new ValidationError('Invalid email format')
  }
  return cleaned
}
