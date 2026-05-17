import { pool } from '../config/db.js'
import type { LibraryScanEventInput } from '@shared/LibraryBook'

/** Truncate a string before insertion so we don't blow past column limits. */
function clip(value: string | undefined, max: number): string {
  if (!value) return ''
  return value.length > max ? value.slice(0, max) : value
}

export const libraryTelemetryRepo = {
  async record(
    userId: string,
    event: LibraryScanEventInput,
    userAgent: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO library_scan_events
        (user_id, phase, isbn, succeeded, provider, error_code,
         error_message, duration_ms, scanner, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        event.phase,
        clip(event.isbn, 20),
        event.succeeded,
        clip(event.provider, 32),
        clip(event.errorCode, 64),
        clip(event.errorMessage, 2000),
        typeof event.durationMs === 'number' ? Math.round(event.durationMs) : null,
        clip(event.scanner, 32),
        clip(userAgent, 500),
      ]
    )
  },
}
