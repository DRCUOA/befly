/**
 * Manuscript service & repo tests.
 *
 * Covers Phase 1: project CRUD, source-theme junction, section/item CRUD,
 * ownership enforcement, and bulk reorder.
 *
 * Run: npm run test --workspace=server
 * Requires: DATABASE_URL in .env, migrations applied through 016.
 */
import './config/env-loader.js'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { pool } from './config/db.js'
import { manuscriptService } from './services/manuscript.service.js'
import { themeService } from './services/theme.service.js'
import { ForbiddenError, NotFoundError, ValidationError } from './utils/errors.js'

const tag = `manuscript_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

let ownerId = ''
let strangerId = ''
let themeAId = ''
let themeBId = ''

async function createTestUser(label: string): Promise<string> {
  // Insert directly to avoid bcrypt cost in tests; we never sign in as these users.
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, status)
     VALUES ($1, 'x', $2, 'active')
     RETURNING id`,
    [`${tag}_${label}@example.test`, `${tag} ${label}`]
  )
  return result.rows[0].id
}

beforeAll(async () => {
  ownerId = await createTestUser('owner')
  strangerId = await createTestUser('stranger')
  const themeA = await themeService.create({ userId: ownerId, name: `${tag}_grief`, visibility: 'private' })
  const themeB = await themeService.create({ userId: ownerId, name: `${tag}_memory`, visibility: 'private' })
  themeAId = themeA.id
  themeBId = themeB.id
})

afterAll(async () => {
  // FK cascades clean up manuscripts, themes, junctions when users go away.
  if (ownerId) await pool.query('DELETE FROM users WHERE id = $1', [ownerId])
  if (strangerId) await pool.query('DELETE FROM users WHERE id = $1', [strangerId])
})

describe('manuscriptService.create', () => {
  it('rejects an empty title', async () => {
    await expect(
      manuscriptService.create({ userId: ownerId, title: '   ' })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects an unknown form value', async () => {
    await expect(
      manuscriptService.create({ userId: ownerId, title: 'X', form: 'novella' })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects non-UUID source theme ids', async () => {
    await expect(
      manuscriptService.create({ userId: ownerId, title: 'X', sourceThemeIds: ['not-a-uuid'] })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('creates a manuscript with defaults and links source themes', async () => {
    const m = await manuscriptService.create({
      userId: ownerId,
      title: `${tag} The Shape of Absence`,
      centralQuestion: 'How does a person keep living when absence becomes part of the furniture of life?',
      sourceThemeIds: [themeAId, themeBId],
    })
    expect(m.id).toBeTruthy()
    expect(m.form).toBe('essay_collection')
    expect(m.status).toBe('gathering')
    expect(m.visibility).toBe('private')
    expect(new Set(m.sourceThemeIds)).toEqual(new Set([themeAId, themeBId]))

    // Cleanup so we don't leak between tests
    await manuscriptService.delete(m.id, ownerId)
  })
})

describe('manuscriptService.update', () => {
  it('rewrites the source theme set on update', async () => {
    const m = await manuscriptService.create({
      userId: ownerId,
      title: `${tag} junction`,
      sourceThemeIds: [themeAId],
    })
    expect(m.sourceThemeIds).toEqual([themeAId])

    const updated = await manuscriptService.update(m.id, ownerId, { sourceThemeIds: [themeBId] })
    expect(updated.sourceThemeIds).toEqual([themeBId])

    const cleared = await manuscriptService.update(m.id, ownerId, { sourceThemeIds: [] })
    expect(cleared.sourceThemeIds).toEqual([])

    await manuscriptService.delete(m.id, ownerId)
  })

  it('forbids a non-owner from updating', async () => {
    const m = await manuscriptService.create({ userId: ownerId, title: `${tag} private` })
    await expect(
      manuscriptService.update(m.id, strangerId, { title: 'hijack' })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await manuscriptService.delete(m.id, ownerId)
  })
})

describe('manuscriptService visibility', () => {
  it('hides a private manuscript from a stranger as not-found', async () => {
    const m = await manuscriptService.create({ userId: ownerId, title: `${tag} hidden` })
    await expect(
      manuscriptService.get(m.id, strangerId)
    ).rejects.toBeInstanceOf(NotFoundError)
    await manuscriptService.delete(m.id, ownerId)
  })

  it('lets a stranger read a shared manuscript', async () => {
    const m = await manuscriptService.create({
      userId: ownerId,
      title: `${tag} shared`,
      visibility: 'shared',
    })
    const got = await manuscriptService.get(m.id, strangerId)
    expect(got.id).toBe(m.id)
    await manuscriptService.delete(m.id, ownerId)
  })

  it('still forbids the stranger from writing to a shared manuscript', async () => {
    const m = await manuscriptService.create({
      userId: ownerId,
      title: `${tag} shared-rw`,
      visibility: 'shared',
    })
    await expect(
      manuscriptService.update(m.id, strangerId, { title: 'rewrite' })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await manuscriptService.delete(m.id, ownerId)
  })
})

describe('sections & items', () => {
  it('creates sections and items, then reorders items in one call', async () => {
    const m = await manuscriptService.create({
      userId: ownerId,
      title: `${tag} spine`,
    })

    const opening = await manuscriptService.createSection(m.id, ownerId, { title: 'Opening', purpose: 'opening' })
    const ending = await manuscriptService.createSection(m.id, ownerId, { title: 'Ending', purpose: 'ending' })

    const a = await manuscriptService.createItem(m.id, ownerId, {
      title: 'Arrived Late Yesterday',
      sectionId: opening.id,
    })
    const b = await manuscriptService.createItem(m.id, ownerId, {
      title: 'Tending the Vines',
      sectionId: opening.id,
    })
    const c = await manuscriptService.createItem(m.id, ownerId, {
      title: 'The Fairground Ride',
      itemType: 'placeholder',
      structuralRole: 'turning_point',
    })

    // Initial order should match insertion order.
    const beforeReorder = await manuscriptService.listItems(m.id, ownerId)
    expect(beforeReorder.map(i => i.id)).toEqual([a.id, b.id, c.id])

    // Move c to the front, push b into the ending section, leave a in opening.
    const reordered = await manuscriptService.reorderItems(m.id, ownerId, [
      { id: c.id, orderIndex: 0 },
      { id: a.id, orderIndex: 1 },
      { id: b.id, orderIndex: 2, sectionId: ending.id },
    ])
    expect(reordered.map(i => i.id)).toEqual([c.id, a.id, b.id])
    const movedB = reordered.find(i => i.id === b.id)!
    expect(movedB.sectionId).toBe(ending.id)

    // getWithSpine returns everything in one shot.
    const spine = await manuscriptService.getWithSpine(m.id, ownerId)
    expect(spine.manuscript.id).toBe(m.id)
    expect(spine.sections).toHaveLength(2)
    expect(spine.items).toHaveLength(3)

    // Deleting a section should leave its items in place with section_id = null.
    await manuscriptService.deleteSection(opening.id, ownerId)
    const itemsAfter = await manuscriptService.listItems(m.id, ownerId)
    const aAfter = itemsAfter.find(i => i.id === a.id)!
    expect(aAfter.sectionId).toBeNull()
    expect(itemsAfter).toHaveLength(3)

    await manuscriptService.delete(m.id, ownerId)
  })

  it('rejects reorder of an item that does not belong to the manuscript', async () => {
    const m1 = await manuscriptService.create({ userId: ownerId, title: `${tag} m1` })
    const m2 = await manuscriptService.create({ userId: ownerId, title: `${tag} m2` })
    const foreignItem = await manuscriptService.createItem(m2.id, ownerId, { title: 'foreign' })

    await expect(
      manuscriptService.reorderItems(m1.id, ownerId, [{ id: foreignItem.id, orderIndex: 0 }])
    ).rejects.toBeInstanceOf(ForbiddenError)

    await manuscriptService.delete(m1.id, ownerId)
    await manuscriptService.delete(m2.id, ownerId)
  })
})
