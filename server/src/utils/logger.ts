/**
 * Simple logger utility
 * Fail loud and early - no silent failures
 * Explicit logging for all operations
 */

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
