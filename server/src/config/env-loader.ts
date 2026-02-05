/**
 * Environment loader - must be imported first before any other modules
 * that read process.env
 * 
 * Fail loud and early - no silent failures
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

function loadEnv() {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    // .env is in project root, which is 3 levels up from server/src/config/
    // server/src/config/ -> server/src/ -> server/ -> project root
    const envPath = path.resolve(__dirname, '../../../.env')

    const result = dotenv.config({ path: envPath })

    if (result.error) {
      const error = new Error(
        `Failed to load .env file from ${envPath}: ${result.error.message}`
      )
      error.cause = result.error
      
      // Push trace to stdoutç
      process.stdout.write(`============================\n`)
      process.stdout.write(`ERROR LOADING .ENV FILE\n`)
      process.stdout.write(`============================\n`)
      
      // Fail loud and early
      throw error
    }
  } catch (error) {
    // Handle uncaught exception from env loading
    const envError = error instanceof Error 
      ? error 
      : new Error(`Unknown error loading environment: ${String(error)}`)
    
    process.stdout.write(`\n[FATAL] Environment configuration failed\n`)
    process.stdout.write(`------------------------------------------\n`)
    if (envError.cause instanceof Error && envError.cause.stack) {
      process.stdout.write(`\nCaused by:\n\n${envError.cause.stack}\n`)
    }
    process.stdout.write(`\n----------------------------------------\n\n`)
    
    // Exit with error code
    process.exit(1)
  }
}

// Execute immediately
loadEnv()
