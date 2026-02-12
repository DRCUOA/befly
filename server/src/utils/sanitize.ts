/**
 * Input sanitization and output escaping utilities
 *
 * IMPORTANT: Do NOT use sanitizeString (or .trim()) for typography rule pattern or
 * replacement fields. Leading/trailing spaces are meaningful:
 *   - pattern " {2,}" = 2+ spaces; pattern "{2,}" alone is invalid
 *   - replacement " " = single space for collapse rules
 * Use sanitizePattern and sanitizeReplacement instead.
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
 * Sanitize regex pattern string - remove null bytes only.
 * Do NOT trim: leading/trailing spaces are meaningful in patterns (e.g. " {2,}").
 */
export function sanitizePattern(input: string): string {
  if (typeof input !== 'string') {
    return String(input)
  }
  return input.replace(/\0/g, '')
}

/**
 * Sanitize typography replacement string - remove null bytes only.
 * Do NOT trim: replacement " " (single space) is valid for collapse rules.
 * Caller may add additional validation (e.g. reject <script>).
 */
export function sanitizeReplacementInput(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  return input.replace(/\0/g, '')
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
