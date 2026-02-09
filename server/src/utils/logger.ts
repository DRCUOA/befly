/**
 * Simple logger utility
 * Fail loud and early - no silent failures
 * Explicit logging for all operations
 */

/**
 * Extract offending file and line from an Error's stack (no full stack trace).
 */
export function getOffendingLocation(err: Error): string | null {
  if (!err.stack) return null
  const lines = err.stack.split('\n')
  const atLine = lines.slice(1).find((l) => l.trim().startsWith('at '))
  if (!atLine) return null
  const match = atLine.match(/\(([^)]+):(\d+):(\d+)\)/) || atLine.match(/\s+at\s+(.+):(\d+):(\d+)/)
  return match ? `${match[1]}:${match[2]}` : atLine.trim()
}

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [INFO] ${message}`, ...args)
  },
  error: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [ERROR] ${message}`, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [WARN] ${message}`, ...args)
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [DEBUG] ${message}`, ...args)
    }
  }
}
