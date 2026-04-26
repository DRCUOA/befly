/**
 * Essay import service.
 *
 * Validates an EssayExportEnvelope, resolves referenced themes against the
 * target owner's existing themes (creating any that are missing), then
 * creates each essay via the existing writingService.create (so all the
 * normal validation, sanitization, and theme-junction handling apply).
 *
 * Per-essay errors don't stop the import: the result lists what was created
 * and what failed, so the admin can see partial success at a glance.
 *
 * Ownership: every imported essay is assigned to the chosen owner, never to
 * the original userId in the envelope. That keeps cross-deployment imports
 * from creating dangling FK references and makes "import this onto my own
 * account" the expected default.
 */
import { pool } from '../config/db.js'
import { writingService } from './writing.service.js'
import { themeService } from './theme.service.js'
import {
  EssayExportEnvelope,
  EssayImportOptions,
  EssayImportResult,
  ESSAY_EXPORT_VERSION,
} from '../models/EssayExport.js'
import { ValidationError } from '../utils/errors.js'

const VALID_VISIBILITY = new Set(['private', 'shared', 'public'])

/**
 * Strict shape check on the envelope. Refuses anything that isn't roughly the
 * right shape; downstream code can then assume the standard structure.
 */
function validateEnvelope(raw: unknown): EssayExportEnvelope {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Import payload must be a JSON object')
  }
  const obj = raw as Record<string, unknown>
  if (obj.version !== ESSAY_EXPORT_VERSION) {
    throw new ValidationError(`Unsupported envelope version: ${obj.version}. Expected ${ESSAY_EXPORT_VERSION}.`)
  }
  if (obj.type !== 'essays') {
    throw new ValidationError(`Unsupported envelope type: ${obj.type}. Expected "essays".`)
  }
  if (!Array.isArray(obj.themes)) {
    throw new ValidationError('themes must be an array')
  }
  if (!Array.isArray(obj.essays)) {
    throw new ValidationError('essays must be an array')
  }
  return obj as unknown as EssayExportEnvelope
}

function ensureUuid(value: string, label: string): string {
  if (typeof value !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
    throw new ValidationError(`${label} must be a valid UUID`)
  }
  return value
}

/**
 * Find or create a theme by name within the target owner's theme list.
 * Used by import to remap envelope themes onto themes that exist for the
 * destination user.
 */
async function resolveThemeForOwner(
  name: string,
  ownerId: string,
  visibility: 'private' | 'shared' | 'public'
): Promise<{ id: string; created: boolean }> {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('Theme name cannot be empty')
  // Find existing by exact name within this user's themes (case-insensitive
  // so "Grief" and "grief" don't create duplicates).
  const existing = await pool.query(
    `SELECT id FROM themes WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
    [ownerId, trimmed]
  )
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, created: false }
  }
  // Create through the service so slug/sanitization are handled the same
  // way as everywhere else.
  const created = await themeService.create({
    userId: ownerId,
    name: trimmed,
    visibility,
  })
  return { id: created.id, created: true }
}

export async function runEssayImport(
  raw: unknown,
  importerUserId: string,
  options: EssayImportOptions
): Promise<EssayImportResult> {
  const envelope = validateEnvelope(raw)

  if (options.ownership !== 'self' && options.ownership !== 'target') {
    throw new ValidationError('ownership must be "self" or "target"')
  }
  let ownerId: string
  if (options.ownership === 'self') {
    ownerId = importerUserId
  } else {
    if (!options.targetUserId) {
      throw new ValidationError('targetUserId is required when ownership is "target"')
    }
    ownerId = ensureUuid(options.targetUserId, 'targetUserId')
    // Make sure target user exists and is active.
    const userCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND status = 'active' LIMIT 1`,
      [ownerId]
    )
    if (userCheck.rows.length === 0) {
      throw new ValidationError('targetUserId does not match an active user')
    }
  }

  const onlySet = options.onlyEssayIds && options.onlyEssayIds.length > 0
    ? new Set(options.onlyEssayIds)
    : null

  // Map source theme id -> resolved local theme id. We resolve themes lazily,
  // only those actually referenced by an essay we're importing.
  const themeMap = new Map<string, string>()
  const themesUsedRaw = new Map<string, { name: string; visibility: 'private' | 'shared' | 'public' }>()
  for (const t of envelope.themes ?? []) {
    if (typeof t.id === 'string' && typeof t.name === 'string') {
      const v = VALID_VISIBILITY.has(t.visibility) ? t.visibility : 'private'
      themesUsedRaw.set(t.id, { name: t.name, visibility: v })
    }
  }

  const result: EssayImportResult = {
    created: [],
    themes: [],
    errors: [],
    total: envelope.essays.length,
  }

  for (const essay of envelope.essays) {
    if (!essay || typeof essay !== 'object') {
      result.errors.push({ sourceId: 'unknown', title: 'unknown', error: 'Essay entry is not an object' })
      continue
    }
    const sourceId = typeof essay.id === 'string' ? essay.id : 'unknown'
    const title = typeof essay.title === 'string' ? essay.title : ''

    if (onlySet && !onlySet.has(sourceId)) {
      // Out of scope for this import - silently skip, don't pollute errors.
      continue
    }

    try {
      if (!title.trim() || typeof essay.body !== 'string' || !essay.body.trim()) {
        throw new ValidationError('Essay must have title and body')
      }
      const visibility = VALID_VISIBILITY.has(essay.visibility) ? essay.visibility : 'private'

      // Resolve themes for this essay. Each unique source theme id resolves
      // exactly once across the import (cached in themeMap).
      const targetThemeIds: string[] = []
      const sourceThemeIds = Array.isArray(essay.themeIds) ? essay.themeIds : []
      for (const sid of sourceThemeIds) {
        if (typeof sid !== 'string') continue
        if (themeMap.has(sid)) {
          targetThemeIds.push(themeMap.get(sid)!)
          continue
        }
        const themeMeta = themesUsedRaw.get(sid)
        if (!themeMeta) {
          // Source essay refers to a theme not present in the envelope -
          // skip it rather than fail; the essay still imports, just without
          // that theme.
          continue
        }
        const resolved = await resolveThemeForOwner(themeMeta.name, ownerId, themeMeta.visibility)
        themeMap.set(sid, resolved.id)
        targetThemeIds.push(resolved.id)
        result.themes.push({ name: themeMeta.name, resolvedId: resolved.id, created: resolved.created })
      }

      // The cover image URL is preserved as-is. If the file doesn't exist
      // on the destination filesystem the front-end will show a broken
      // image - that's the expected behaviour, the admin moves the actual
      // image files separately.
      const cover = typeof essay.coverImageUrl === 'string' && essay.coverImageUrl.trim()
        ? essay.coverImageUrl.trim()
        : undefined
      const coverPos = typeof essay.coverImagePosition === 'string' && essay.coverImagePosition.trim()
        ? essay.coverImagePosition.trim()
        : undefined

      const created = await writingService.create({
        userId: ownerId,
        title,
        body: essay.body,
        themeIds: targetThemeIds,
        visibility,
        coverImageUrl: cover,
        coverImagePosition: coverPos,
      })
      result.created.push({ newId: created.id, sourceId, title })
    } catch (err) {
      result.errors.push({
        sourceId,
        title,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}
