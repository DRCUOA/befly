/**
 * Simple logger utility
 * Fail loud and early - no silent failures
 * Uses fs.appendFileSync so logs are written immediately to disk (no buffering).
 * All levels (info, warn, error) are written to server/logs in every environment.
 * Debug is console-only in development.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Resolved directory for log files — always <project-root>/server/logs */
function getLogDir(): string {
  return path.resolve(__dirname, '..', '..', 'logs')
}

let infoLogPath: string | null = null
let errorLogPath: string | null = null

try {
  const logDir = getLogDir()
  fs.mkdirSync(logDir, { recursive: true })
  infoLogPath = path.join(logDir, 'info.log')
  errorLogPath = path.join(logDir, 'error.log')
} catch (err) {
  process.stderr.write(`[logger] Failed to init: ${err instanceof Error ? err.message : String(err)}\n`)
}

function formatLine(level: string, message: string, args: unknown[]): string {
  const timestamp = new Date().toISOString()
  const extra = args.length > 0 ? ` ${JSON.stringify(args)}` : ''
  return `[${timestamp}] [${level}] ${message}${extra}\n`
}

function appendSync(filePath: string | null, line: string): void {
  if (!filePath) return
  try {
    fs.appendFileSync(filePath, line)
  } catch (err) {
    process.stderr.write(`[logger] write failed: ${err instanceof Error ? err.message : String(err)}\n`)
  }
}

/**
 * Extract offending file and line from an Error's stack (first application frame).
 */
export function getOffendingLocation(err: Error): string | null {
  if (!err.stack) return null
  const lines = err.stack.split('\n')
  const atLine = lines.slice(1).find((l) => l.trim().startsWith('at '))
  if (!atLine) return null
  const match = atLine.match(/\(([^)]+):(\d+):(\d+)\)/) || atLine.match(/\s+at\s+(.+):(\d+):(\d+)/)
  return match ? `${match[1]}:${match[2]}` : atLine.trim()
}

/**
 * Return the full stack trace string (minus the message line) for file logging.
 */
export function getFullStack(err: Error): string | null {
  if (!err.stack) return null
  const lines = err.stack.split('\n')
  return lines.slice(1).map((l) => l.trimEnd()).join('\n')
}

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [INFO] ${message}`, ...args)
    appendSync(infoLogPath, formatLine('INFO', message, args))
  },
  error: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [ERROR] ${message}`, ...args)
    appendSync(errorLogPath, formatLine('ERROR', message, args))
  },
  warn: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [WARN] ${message}`, ...args)
    appendSync(errorLogPath, formatLine('WARN', message, args))
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [DEBUG] ${message}`, ...args)
    }
  }
}
