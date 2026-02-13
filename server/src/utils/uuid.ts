import { randomUUID } from 'crypto'

/**
 * Generate a new UUID v4 string.
 * Use this for all application-level UUID generation to keep usage consistent.
 */
export function generateUUID(): string {
  return randomUUID()
}
