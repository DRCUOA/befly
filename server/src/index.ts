// IMPORTANT: Load environment variables FIRST
// This side-effect import ensures dotenv.config() runs before any other imports
// If this fails, env-loader will handle the error and exit
import './config/env-loader.js'

import app from './app.js'
import { initDb, closeDb } from './config/db.js'
import { getOffendingLocation } from './utils/logger.js'
import type { Server } from 'http'

// Fires on every normal exit (not SIGKILL / OOM kills)
process.on('exit', (code) => {
  console.log(`[exit] code=${code}`)
})

const PORT = Number(process.env.PORT) || 3005
let server: Server | null = null
let shuttingDown = false

function formatErrorForLog(err: Error): string {
  const at = getOffendingLocation(err)
  return at ? `${err.message} at ${at}` : err.message
}

// ── Graceful shutdown ────────────────────────────────────────────────
async function gracefulShutdown(reason: string, exitCode: number) {
  if (shuttingDown) return
  shuttingDown = true

  console.log(`[shutdown] triggered by ${reason} exitCode=${exitCode}`)

  // Hard guard: don't hang forever (e.g. stuck connections)
  setTimeout(() => {
    console.error('[shutdown] forced exit after timeout')
    process.exit(1)
  }, 10_000).unref()

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err?: Error) => (err ? reject(err) : resolve()))
      })
      console.log('[shutdown] server closed')
    }
  } catch (err) {
    console.error('[shutdown] error closing server', err)
    exitCode = 1
  }

  try {
    await closeDb()
    console.log('[shutdown] database closed')
  } catch (error) {
    const at = error instanceof Error ? getOffendingLocation(error) : null
    const msg = error instanceof Error ? `${error.message}${at ? ` at ${at}` : ''}` : String(error)
    console.error('[shutdown] error closing database:', msg)
    exitCode = 1
  }

  process.exit(exitCode)
}

// ── Normal shutdown signals (exit 0) ─────────────────────────────────
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', 0))
process.on('SIGINT', () => void gracefulShutdown('SIGINT', 0))

// ── Fatal errors (exit 1) ────────────────────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('[FATAL] uncaughtException', error instanceof Error ? formatErrorForLog(error) : String(error))
  void gracefulShutdown('uncaughtException', 1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection', reason instanceof Error ? formatErrorForLog(reason) : String(reason))
  void gracefulShutdown('unhandledRejection', 1)
})

async function start() {
  try {
    await initDb()
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`)
    })
  } catch (error) {
    process.stdout.write(`\n[FATAL] Failed to start server:\n`)
    process.stdout.write(`==========================================\n`)
    process.stdout.write(`${error instanceof Error ? formatErrorForLog(error) : String(error)}\n`)
    process.stdout.write(`==========================================\n\n`)
    
    // Clean up on startup failure
    try {
      await closeDb()
    } catch (dbError) {
      const at = dbError instanceof Error ? getOffendingLocation(dbError) : null
      const msg = dbError instanceof Error ? `${dbError.message}${at ? ` at ${at}` : ''}` : String(dbError)
      console.error('Error closing database on startup failure:', msg)
    }
    
    process.exit(1)
  }
}

start()
