// IMPORTANT: Load environment variables FIRST
// This side-effect import ensures dotenv.config() runs before any other imports
// If this fails, env-loader will handle the error and exit
import './config/env-loader.js'

import app from './app.js'
import { initDb } from './config/db.js'

const PORT = process.env.PORT || 3005

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  process.stdout.write(`\n[FATAL] Uncaught exception:\n`)
  process.stdout.write(`==========================================\n`)
  process.stdout.write(`${error.message}\n`)
  if (error.stack) {
    process.stdout.write(`\nStack trace:\n${error.stack}\n`)
  }
  process.stdout.write(`==========================================\n\n`)
  process.exit(1)
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
  process.exit(1)
})

async function start() {
  try {
    await initDb()
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
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
    process.exit(1)
  }
}

start()
