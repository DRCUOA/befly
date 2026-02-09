/**
 * Simple logger utility
 * Fail loud and early - no silent failures
 * Explicit logging for all operations
 * In production, info and error are also written to server/logs.
 */

import fs from 'node:fs'
import path from 'node:path'

const isProd = process.env.NODE_ENV === 'production'

/** Resolved directory for prod log files (server/logs under cwd). */
function getLogDir(): string {
  return path.join(process.cwd(), 'server', 'logs')
}

let infoStream: fs.WriteStream | null = null
let errorStream: fs.WriteStream | null = null

if (isProd) {
  try {
    const logDir = getLogDir()
    fs.mkdirSync(logDir, { recursive: true })
    infoStream = fs.createWriteStream(path.join(logDir, 'info.log'), { flags: 'a' })
    errorStream = fs.createWriteStream(path.join(logDir, 'error.log'), { flags: 'a' })
  } catch (err) {
    process.stderr.write(`[logger] Failed to create log streams: ${err instanceof Error ? err.message : String(err)}\n`)
  }
}

function formatLine(level: string, message: string, args: unknown[]): string {
  const timestamp = new Date().toISOString()
  const extra = args.length > 0 ? ` ${JSON.stringify(args)}` : ''
  return `[${timestamp}] [${level}] ${message}${extra}\n`
}

function writeToStream(stream: fs.WriteStream | null, line: string): void {
  if (stream?.writable) {
    stream.write(line)
  }
}

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
    if (isProd) writeToStream(infoStream, formatLine('INFO', message, args))
  },
  error: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [ERROR] ${message}`, ...args)
    if (isProd) writeToStream(errorStream, formatLine('ERROR', message, args))
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
