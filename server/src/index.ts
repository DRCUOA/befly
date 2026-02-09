// IMPORTANT: Load environment variables FIRST
// This side-effect import ensures dotenv.config() runs before any other imports
// If this fails, env-loader will handle the error and exit
import './config/env-loader.js'

import app from './app.js'
import { initDb, closeDb } from './config/db.js'
import { getOffendingLocation } from './utils/logger.js'
import type { Server } from 'http'

const PORT = Number(process.env.PORT) || 3005
let server: Server | null = null

function formatErrorForLog(err: Error): string {
  const at = getOffendingLocation(err)
  return at ? `${err.message} at ${at}` : err.message
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  process.stdout.write(`\n[FATAL] Uncaught exception:\n`)
  process.stdout.write(`==========================================\n`)
  process.stdout.write(`${error instanceof Error ? formatErrorForLog(error) : String(error)}\n`)
  process.stdout.write(`==========================================\n\n`)
  gracefulShutdown('uncaughtException')
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  process.stdout.write(`\n[FATAL] Unhandled promise rejection:\n`)
  process.stdout.write(`==========================================\n`)
  if (reason instanceof Error) {
    process.stdout.write(`${formatErrorForLog(reason)}\n`)
  } else {
    process.stdout.write(`${String(reason)}\n`)
  }
  process.stdout.write(`==========================================\n\n`)
  gracefulShutdown('unhandledRejection')
})

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  if (server) {
    return new Promise<void>((resolve) => {
      server!.close(() => resolve())
      setTimeout(() => resolve(), 10000)
    }).then(async () => {
      try {
        await closeDb()
      } catch (error) {
        const at = error instanceof Error ? getOffendingLocation(error) : null
        const msg = error instanceof Error ? `${error.message}${at ? ` at ${at}` : ''}` : String(error)
        console.error('Error closing database:', msg)
      }
      process.exit(0)
    })
  } else {
    try {
      await closeDb()
    } catch (error) {
      const at = error instanceof Error ? getOffendingLocation(error) : null
      const msg = error instanceof Error ? `${error.message}${at ? ` at ${at}` : ''}` : String(error)
      console.error('Error closing database:', msg)
    }
    process.exit(0)
  }
}

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

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
