/**
 * Essay export service.
 *
 * Pulls writing_blocks (and the themes they reference) out of the database,
 * assembles them into the EssayExportEnvelope shape, and hands back a JSON
 * string ready for download.
 *
 * Admin-only at the controller; access checks are not duplicated here.
 */
import { pool } from '../config/db.js'
import {
  EssayExportEnvelope,
  EssayExportEssay,
  EssayExportTheme,
  EssayExportUser,
  ESSAY_EXPORT_VERSION,
} from '../models/EssayExport.js'

export interface ExportScope {
  /** Restrict to this user's essays. Omit to include all users. */
  userId?: string
  /** Restrict to this set of writing block ids. Omit to include all in scope. */
  writingIds?: string[]
}

/**
 * Build the export envelope. Returns a structured object so the caller can
 * either JSON.stringify it for download, or render a count for the UI.
 */
export async function buildEssayExport(scope: ExportScope): Promise<EssayExportEnvelope> {
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (scope.userId) {
    conditions.push(`wb.user_id = $${i++}`)
    params.push(scope.userId)
  }
  if (scope.writingIds && scope.writingIds.length > 0) {
    conditions.push(`wb.id = ANY($${i++}::uuid[])`)
    params.push(scope.writingIds)
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Pull essays + their theme ids in one query so we don't N+1. Themes
  // themselves are fetched in a second query against the union of all theme
  // ids referenced by the essays.
  const essaysResult = await pool.query(
    `SELECT
       wb.id,
       wb.user_id        AS "userId",
       wb.title,
       wb.body,
       COALESCE(wb.visibility, 'private') AS visibility,
       wb.cover_image_url      AS "coverImageUrl",
       wb.cover_image_position AS "coverImagePosition",
       wb.created_at AS "createdAt",
       wb.updated_at AS "updatedAt",
       COALESCE(
         ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL),
         ARRAY[]::UUID[]
       ) AS "themeIds"
     FROM writing_blocks wb
     LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
     ${where}
     GROUP BY wb.id
     ORDER BY wb.created_at ASC`,
    params
  )

  const essays: EssayExportEssay[] = essaysResult.rows.map(r => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    body: r.body,
    themeIds: r.themeIds ?? [],
    visibility: r.visibility,
    coverImageUrl: r.coverImageUrl ?? null,
    coverImagePosition: r.coverImagePosition ?? null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(),
    updatedAt: r.updatedAt
      ? (typeof r.updatedAt === 'string' ? r.updatedAt : new Date(r.updatedAt).toISOString())
      : null,
  }))

  const themeIds = Array.from(new Set(essays.flatMap(e => e.themeIds)))
  let themes: EssayExportTheme[] = []
  if (themeIds.length > 0) {
    const themesResult = await pool.query(
      `SELECT
         id,
         name,
         slug,
         COALESCE(visibility, 'private') AS visibility
       FROM themes
       WHERE id = ANY($1::uuid[])
       ORDER BY name ASC`,
      [themeIds]
    )
    themes = themesResult.rows
  }

  const userIds = Array.from(new Set(essays.map(e => e.userId)))
  let users: EssayExportUser[] = []
  if (userIds.length > 0) {
    const usersResult = await pool.query(
      `SELECT id, email, COALESCE(display_name, '') AS "displayName"
       FROM users
       WHERE id = ANY($1::uuid[])`,
      [userIds]
    )
    users = usersResult.rows
  }

  const scopeLabel = (() => {
    if (scope.userId && scope.writingIds && scope.writingIds.length > 0) {
      return `${scope.writingIds.length} essay(s) for user ${scope.userId}`
    }
    if (scope.userId) return `All essays for user ${scope.userId}`
    if (scope.writingIds && scope.writingIds.length > 0) {
      return `${scope.writingIds.length} essay(s) across users`
    }
    return 'All essays from all users'
  })()

  return {
    version: ESSAY_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    type: 'essays',
    scopeLabel,
    themes,
    essays,
    users,
  }
}

/**
 * Pretty-printed JSON output. Two-space indent so a human can read the file
 * in any text editor without reformatting.
 */
export function envelopeToJson(envelope: EssayExportEnvelope): string {
  return JSON.stringify(envelope, null, 2) + '\n'
}

/**
 * The downloadable template - a tiny well-formed envelope showing all the
 * required and optional fields with realistic example values, plus a
 * `_documentation` block that explains the import semantics. JSON has no
 * comments, so the readme has to live as a key.
 */
export function buildEssayTemplate(): EssayExportEnvelope & { _documentation: Record<string, string> } {
  const now = new Date().toISOString()
  const exampleThemeId = '00000000-0000-0000-0000-000000000001'
  return {
    _documentation: {
      version: 'Must equal "1.0". The importer refuses unknown versions.',
      type: 'Must equal "essays". Reserved for future bundle types.',
      themes:
        'Inline list of themes referenced by the essays. On import, the importer ' +
        'finds an existing theme by name within the target owner\'s themes; if ' +
        'none exists, it creates one.',
      essays:
        'Each essay\'s themeIds reference the themes[] array above. The importer ' +
        'remaps these to the resolved theme ids for the target owner.',
      essayId:
        'The "id" on each essay is advisory - the importer always assigns a ' +
        'fresh UUID. This makes the same file safe to import twice (you get ' +
        'duplicates, not collisions).',
      coverImageUrl:
        'A reference like "/uploads/cover/foo.jpg". The actual image file is ' +
        'NOT embedded in this envelope - move cover image files separately.',
      ownership:
        'On import, you choose whether essays are owned by you (the importing ' +
        'admin) or by another specific user. The userId field on each essay is ' +
        'used only for the export label, never to assign ownership on import.',
    },
    version: ESSAY_EXPORT_VERSION,
    exportedAt: now,
    type: 'essays',
    scopeLabel: 'Template - example data',
    themes: [
      {
        id: exampleThemeId,
        name: 'Grief',
        slug: 'grief',
        visibility: 'private',
      },
    ],
    essays: [
      {
        id: '00000000-0000-0000-0000-000000000010',
        userId: '00000000-0000-0000-0000-000000000099',
        title: 'Arrived Late Yesterday',
        body: '# Arrived Late Yesterday\n\nThe rain had been falling since noon.',
        themeIds: [exampleThemeId],
        visibility: 'private',
        coverImageUrl: null,
        coverImagePosition: null,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: '00000000-0000-0000-0000-000000000011',
        userId: '00000000-0000-0000-0000-000000000099',
        title: 'Tending the Vines',
        body: '# Tending the Vines\n\nThe pruning takes longer every year.',
        themeIds: [],
        visibility: 'private',
        coverImageUrl: null,
        coverImagePosition: null,
        createdAt: now,
        updatedAt: null,
      },
    ],
    users: [
      {
        id: '00000000-0000-0000-0000-000000000099',
        email: 'example@example.com',
        displayName: 'Example Writer',
      },
    ],
  }
}
