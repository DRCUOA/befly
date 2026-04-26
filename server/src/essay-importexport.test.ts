/**
 * Essay export/import tests.
 *
 * The pure pieces (template generation, envelope serialisation) run without
 * any setup. The end-to-end import test creates real users and themes via
 * the existing services and then runs the importer against them, so the
 * test verifies the same code path the controller uses.
 *
 * Run: npm run test --workspace=server
 * Requires: DATABASE_URL in .env, migrations applied.
 */
import './config/env-loader.js'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { pool } from './config/db.js'
import {
  buildEssayExport,
  buildEssayTemplate,
  envelopeToJson,
} from './services/essay-export.service.js'
import { runEssayImport } from './services/essay-import.service.js'
import { writingService } from './services/writing.service.js'
import { themeService } from './services/theme.service.js'
import { ESSAY_EXPORT_VERSION } from './models/EssayExport.js'

const tag = `eximp_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

let sourceUserId = ''
let targetUserId = ''
let sourceThemeAId = ''
let sourceThemeBId = ''
let sourceEssay1Id = ''
let sourceEssay2Id = ''

async function createTestUser(label: string): Promise<string> {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, status)
     VALUES ($1, 'x', $2, 'active')
     RETURNING id`,
    [`${tag}_${label}@example.test`, `${tag} ${label}`]
  )
  return result.rows[0].id
}

beforeAll(async () => {
  sourceUserId = await createTestUser('source')
  targetUserId = await createTestUser('target')
  const themeA = await themeService.create({ userId: sourceUserId, name: `${tag} Grief` })
  const themeB = await themeService.create({ userId: sourceUserId, name: `${tag} Memory` })
  sourceThemeAId = themeA.id
  sourceThemeBId = themeB.id
  const e1 = await writingService.create({
    userId: sourceUserId,
    title: `${tag} Arrived Late Yesterday`,
    body: 'The rain had been falling since noon.',
    themeIds: [sourceThemeAId, sourceThemeBId],
    visibility: 'private',
  })
  const e2 = await writingService.create({
    userId: sourceUserId,
    title: `${tag} Tending the Vines`,
    body: 'The pruning takes longer every year.',
    themeIds: [sourceThemeAId],
    visibility: 'shared',
  })
  sourceEssay1Id = e1.id
  sourceEssay2Id = e2.id
})

afterAll(async () => {
  if (sourceUserId) await pool.query('DELETE FROM users WHERE id = $1', [sourceUserId])
  if (targetUserId) await pool.query('DELETE FROM users WHERE id = $1', [targetUserId])
})

describe('buildEssayTemplate (pure)', () => {
  it('produces a well-formed envelope with example data and inline documentation', () => {
    const t = buildEssayTemplate()
    expect(t.version).toBe(ESSAY_EXPORT_VERSION)
    expect(t.type).toBe('essays')
    expect(t.themes.length).toBeGreaterThan(0)
    expect(t.essays.length).toBeGreaterThan(0)
    // Documentation block is on the template only - the exporter does not emit it.
    expect(t._documentation).toBeTypeOf('object')
    expect(Object.keys(t._documentation).length).toBeGreaterThan(0)
    // Should round-trip cleanly through JSON.
    const json = JSON.stringify(t)
    expect(JSON.parse(json).version).toBe(ESSAY_EXPORT_VERSION)
  })

  it('envelopeToJson is pretty-printed and ends with a newline', () => {
    const t = buildEssayTemplate()
    const out = envelopeToJson(t)
    expect(out.endsWith('\n')).toBe(true)
    expect(out).toContain('\n  ') // indented
  })
})

describe('buildEssayExport (DB)', () => {
  it('exports all essays for the source user with their themes inline', async () => {
    const env = await buildEssayExport({ userId: sourceUserId })
    expect(env.version).toBe(ESSAY_EXPORT_VERSION)
    expect(env.essays.length).toBe(2)
    expect(env.themes.length).toBe(2)
    const titles = env.essays.map(e => e.title).sort()
    expect(titles).toEqual([
      `${tag} Arrived Late Yesterday`,
      `${tag} Tending the Vines`,
    ].sort())

    // Themes should match what the essays reference.
    const themeIdsInEssays = new Set(env.essays.flatMap(e => e.themeIds))
    const themeIdsInThemes = new Set(env.themes.map(t => t.id))
    for (const tid of themeIdsInEssays) {
      expect(themeIdsInThemes.has(tid)).toBe(true)
    }

    // Every essay carries its body and visibility.
    const e1 = env.essays.find(e => e.title.endsWith('Arrived Late Yesterday'))!
    expect(e1.body).toContain('The rain had been falling')
    expect(e1.visibility).toBe('private')

    // Source-side users summary is included.
    expect(env.users?.length).toBeGreaterThan(0)
  })

  it('exports a specific subset by writing id', async () => {
    const env = await buildEssayExport({ userId: sourceUserId, writingIds: [sourceEssay2Id] })
    expect(env.essays).toHaveLength(1)
    expect(env.essays[0].id).toBe(sourceEssay2Id)
    // Only theme A is referenced by essay 2; theme B should not appear.
    expect(env.themes.map(t => t.id)).toEqual([sourceThemeAId])
  })
})

describe('runEssayImport (DB)', () => {
  it('imports into the target user, dedupes themes by name, and remaps theme ids', async () => {
    const env = await buildEssayExport({ userId: sourceUserId })

    // Pre-create one of the theme names on the target user. Import should
    // reuse it (find-by-name) rather than make a duplicate.
    const preexisting = await themeService.create({
      userId: targetUserId,
      name: `${tag} Grief`,
    })

    const result = await runEssayImport(env, /* importer */ targetUserId, {
      ownership: 'self',
    })

    expect(result.total).toBe(2)
    expect(result.created.length).toBe(2)
    expect(result.errors).toEqual([])

    // The pre-existing theme should have been reused (not created).
    const griefRow = result.themes.find(t => t.name === `${tag} Grief`)
    expect(griefRow).toBeTruthy()
    expect(griefRow!.created).toBe(false)
    expect(griefRow!.resolvedId).toBe(preexisting.id)

    // The other theme should have been freshly created.
    const memoryRow = result.themes.find(t => t.name === `${tag} Memory`)
    expect(memoryRow).toBeTruthy()
    expect(memoryRow!.created).toBe(true)

    // The imported essays should appear under the target user with the
    // remapped theme ids.
    const writings = await pool.query(
      `SELECT wb.id, wb.title,
        COALESCE(ARRAY_AGG(wt.theme_id) FILTER (WHERE wt.theme_id IS NOT NULL), ARRAY[]::UUID[]) AS theme_ids
       FROM writing_blocks wb
       LEFT JOIN writing_themes wt ON wb.id = wt.writing_id
       WHERE wb.user_id = $1
       GROUP BY wb.id`,
      [targetUserId]
    )
    expect(writings.rows.length).toBe(2)
    const arrived = writings.rows.find((r: any) => r.title.endsWith('Arrived Late Yesterday'))
    expect(arrived).toBeTruthy()
    expect(arrived.theme_ids.length).toBe(2)
    expect(arrived.theme_ids).toContain(preexisting.id) // remapped, not the source id
    expect(arrived.theme_ids).not.toContain(sourceThemeAId)
  })

  it('rejects an envelope with the wrong version', async () => {
    const bad = { version: '99.0', type: 'essays', themes: [], essays: [] }
    await expect(runEssayImport(bad, targetUserId, { ownership: 'self' })).rejects.toThrow(/version/i)
  })

  it('rejects an envelope with the wrong type', async () => {
    const bad = { version: ESSAY_EXPORT_VERSION, type: 'whatever', themes: [], essays: [] }
    await expect(runEssayImport(bad, targetUserId, { ownership: 'self' })).rejects.toThrow(/type/i)
  })

  it('honors onlyEssayIds to import a subset of the envelope', async () => {
    const env = await buildEssayExport({ userId: sourceUserId })
    const lonelyTarget = await createTestUser('lonely')
    try {
      const result = await runEssayImport(env, lonelyTarget, {
        ownership: 'self',
        onlyEssayIds: [sourceEssay2Id],
      })
      expect(result.created.length).toBe(1)
      expect(result.created[0].sourceId).toBe(sourceEssay2Id)
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [lonelyTarget])
    }
  })

  it('records per-essay errors without stopping the import', async () => {
    const halfBroken = {
      version: ESSAY_EXPORT_VERSION,
      type: 'essays',
      exportedAt: new Date().toISOString(),
      themes: [],
      essays: [
        { id: 'src-good', userId: sourceUserId, title: 'Good', body: 'has body', themeIds: [], visibility: 'private', coverImageUrl: null, coverImagePosition: null, createdAt: new Date().toISOString(), updatedAt: null },
        { id: 'src-empty', userId: sourceUserId, title: '', body: '', themeIds: [], visibility: 'private', coverImageUrl: null, coverImagePosition: null, createdAt: new Date().toISOString(), updatedAt: null },
      ],
    }
    const t2 = await createTestUser('half')
    try {
      const result = await runEssayImport(halfBroken, t2, { ownership: 'self' })
      expect(result.created.length).toBe(1)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].sourceId).toBe('src-empty')
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [t2])
    }
  })

  it('refuses ownership=target when targetUserId is not provided', async () => {
    const env = await buildEssayExport({ userId: sourceUserId })
    await expect(runEssayImport(env, targetUserId, { ownership: 'target' })).rejects.toThrow(/targetUserId/)
  })
})
