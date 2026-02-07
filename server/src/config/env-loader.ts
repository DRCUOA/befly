/**
 * Environment loader - must be imported first before any other modules
 * that read process.env
 *
 * In production (Heroku/container), config vars may be injected directly
 * by the runtime and no .env file is expected.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

function loadEnv() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  // .env is in project root, which is 3 levels up from server/src/config/
  const envPath = path.resolve(__dirname, '../../../.env')

  if (!fs.existsSync(envPath)) {
    process.stdout.write(`[env-loader] No .env file found at ${envPath}. Using runtime environment variables only.\n`)
    return
  }

  const result = dotenv.config({ path: envPath })

  if (result.error) {
    const error = new Error(
      `Failed to load .env file from ${envPath}: ${result.error.message}`
    )
    error.cause = result.error
    throw error
  }
}

try {
  loadEnv()
} catch (error) {
  const envError = error instanceof Error
    ? error
    : new Error(`Unknown error loading environment: ${String(error)}`)

  process.stdout.write(`\n[FATAL] Environment configuration failed\n`)
  process.stdout.write(`------------------------------------------\n`)
  if (envError.cause instanceof Error && envError.cause.stack) {
    process.stdout.write(`\nCaused by:\n\n${envError.cause.stack}\n`)
  } else if (envError.stack) {
    process.stdout.write(`${envError.stack}\n`)
  }
  process.stdout.write(`\n----------------------------------------\n\n`)
  process.exit(1)
}
