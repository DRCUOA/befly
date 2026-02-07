// IMPORTANT: Load environment variables FIRST
// This side-effect import ensures dotenv.config() runs before any other imports
// If this fails, env-loader will handle the error and exit
import './config/env-loader.js'

import app from './app.js'
import { initDb, closeDb } from './config/db.js'
import type { Server } from 'http'

const PORT = Number(process.env.PORT) || 3005
let server: Server | null = null

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  process.stdout.write(`\n[FATAL] Uncaught exception:\n`)
  process.stdout.write(`==========================================\n`)
  process.stdout.write(`${error.message}\n`)
  if (error.stack) {
    process.stdout.write(`\nStack trace:\n${error.stack}\n`)
  }
  process.stdout.write(`==========================================\n\n`)
  gracefulShutdown('uncaughtException')
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  process.stdout.write(`\n[FATAL] Unhandled promise rejection:\n`)
  process.stdout.write(`==========================================\n`)
  if (reason instanceof Error) {
    process.stdout.write(`${reason.message}\n`)
    if (reason.stack) {
      process.stdout.write(`\nStack trace:\n${reason.stack}\n`)
    }
  } else {
    process.stdout.write(`${String(reason)}\n`)
  }
  process.stdout.write(`==========================================\n\n`)
  gracefulShutdown('unhandledRejection')
})

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`)
  
  // Close HTTP server
  if (server) {
    return new Promise<void>((resolve) => {
      server!.close(() => {
        console.log('HTTP server closed')
        resolve()
      })
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.log('Forcing server close after timeout')
        resolve()
      }, 10000)
    }).then(async () => {
      // Close database connections
      try {
        await closeDb()
        console.log('Database connections closed')
      } catch (error) {
        console.error('Error closing database:', error)
      }
      
      process.exit(0)
    })
  } else {
    // No server to close, just close DB and exit
    try {
      await closeDb()
      console.log('Database connections closed')
    } catch (error) {
      console.error('Error closing database:', error)
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
    if (error instanceof Error) {
      process.stdout.write(`${error.message}\n`)
      if (error.stack) {
        process.stdout.write(`\nStack trace:\n${error.stack}\n`)
      }
    } else {
      process.stdout.write(`${String(error)}\n`)
    }
    process.stdout.write(`==========================================\n\n`)
    
    // Clean up on startup failure
    try {
      await closeDb()
    } catch (dbError) {
      console.error('Error closing database on startup failure:', dbError)
    }
    
    process.exit(1)
  }
}

start()
