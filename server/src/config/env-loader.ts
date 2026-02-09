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

function getOffendingLocationFromStack(stack: string | undefined): string | null {
  if (!stack) return null
  const lines = stack.split('\n')
  const atLine = lines.slice(1).find((l) => l.trim().startsWith('at '))
  if (!atLine) return null
  const match = atLine.match(/\(([^)]+):(\d+):(\d+)\)/) || atLine.match(/\s+at\s+(.+):(\d+):(\d+)/)
  return match ? `${match[1]}:${match[2]}` : atLine.trim()
}

try {
  loadEnv()
} catch (error) {
  const envError = error instanceof Error
    ? error
    : new Error(`Unknown error loading environment: ${String(error)}`)

  const cause = envError.cause instanceof Error ? envError.cause : null
  const at = getOffendingLocationFromStack(cause?.stack ?? envError.stack)

  process.stdout.write(`\n[FATAL] Environment configuration failed\n`)
  process.stdout.write(`------------------------------------------\n`)
  process.stdout.write(`${envError.message}${at ? ` at ${at}` : ''}\n`)
  process.stdout.write(`\n----------------------------------------\n\n`)
  process.exit(1)
}
