/**
 * Manuscript assist service tests with a mocked LLM client.
 *
 * No real network calls happen here - the test injects a FakeLlmClient via
 * setLlmClientForTests() so the service runs end-to-end against the database
 * without burning OpenAI tokens or needing OPENAI_API_KEY.
 *
 * Run: npm run test --workspace=server
 * Requires: DATABASE_URL in .env, migrations applied through 017.
 */
import './config/env-loader.js'

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { pool } from './config/db.js'
import { manuscriptService } from './services/manuscript.service.js'
import {
  manuscriptAssistService,
  setLlmClientForTests,
} from './services/manuscript-assist.service.js'
import { manuscriptArtifactRepo } from './repositories/manuscript-artifact.repo.js'
import { LlmClient, LlmJsonRequest, LlmJsonResponse } from './services/llm/llm-client.js'
import { GapAnalysisContent } from './models/Manuscript.js'

const tag = `assist_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

let ownerId = ''

async function createTestUser(label: string): Promise<string> {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, status)
     VALUES ($1, 'x', $2, 'active')
     RETURNING id`,
    [`${tag}_${label}@example.test`, `${tag} ${label}`]
  )
  return result.rows[0].id
}

async function createWritingBlock(userId: string, title: string, body: string): Promise<string> {
  const result = await pool.query(
    `INSERT INTO writing_blocks (user_id, title, body, visibility)
     VALUES ($1, $2, $3, 'private')
     RETURNING id`,
    [userId, title, body]
  )
  return result.rows[0].id
}

/**
 * A fake LlmClient that records every request and returns canned JSON.
 * The test asserts on what the service sent (so we know retrieval-before-
 * generation actually fired) and on what the service did with the response.
 */
class FakeLlmClient implements LlmClient {
  public requests: LlmJsonRequest[] = []
  public response: unknown = {
    summary: 'A short fake summary.',
    suggestions: [
      {
        title: 'A small emotional gap',
        gapType: 'emotional',
        body: 'The transition is abrupt. Consider a brief bridge.',
        confidence: 'medium',
        actionType: 'add_bridge',
        groundedIn: [
          { itemId: 'will-be-replaced', title: 'A', excerpt: 'rain' },
          { itemId: 'will-be-replaced', title: 'B', excerpt: 'estate agent' },
        ],
      },
    ],
  }

  async chatJson(req: LlmJsonRequest): Promise<LlmJsonResponse> {
    this.requests.push(req)
    return { json: this.response, model: 'fake-model' }
  }
}

beforeAll(async () => {
  ownerId = await createTestUser('owner')
})

afterAll(async () => {
  if (ownerId) await pool.query('DELETE FROM users WHERE id = $1', [ownerId])
})

afterEach(() => {
  setLlmClientForTests(null)
})

describe('manuscriptAssistService.run - gaps mode', () => {
  it('walks adjacent item pairs in spine order, calls the LLM with grounded prompts, persists artifacts', async () => {
    const fake = new FakeLlmClient()
    setLlmClientForTests(fake)

    const m = await manuscriptService.create({
      userId: ownerId,
      title: `${tag} spine`,
      centralQuestion: 'How does grief become administration?',
    })
    const opening = await manuscriptService.createSection(m.id, ownerId, { title: 'Opening', purpose: 'opening' })

    const wb1 = await createWritingBlock(ownerId, 'Arrived Late Yesterday', 'The rain had been falling since noon. There was nothing to say.')
    const wb2 = await createWritingBlock(ownerId, 'The House Sale', 'The estate agent arrived on Tuesday with a clipboard.')

    const a = await manuscriptService.createItem(m.id, ownerId, { title: 'Arrived Late Yesterday', sectionId: opening.id, writingBlockId: wb1 })
    const b = await manuscriptService.createItem(m.id, ownerId, { title: 'The House Sale', sectionId: opening.id, writingBlockId: wb2 })

    const result = await manuscriptAssistService.run(
      { manuscriptId: m.id, mode: 'gaps' },
      ownerId
    )

    // Two items -> one adjacent pair -> one LLM call -> one artifact.
    expect(fake.requests).toHaveLength(1)
    expect(result.artifacts).toHaveLength(1)
    expect(result.analyzedJunctions).toEqual([{ fromItemId: a.id, toItemId: b.id }])

    // Retrieval-before-generation: the prompt must include the actual essay text.
    const promptUser = fake.requests[0].user
    expect(promptUser).toContain('The rain had been falling since noon')
    expect(promptUser).toContain('The estate agent arrived on Tuesday')
    // ...and the literary direction.
    expect(promptUser).toContain('How does grief become administration?')

    // Artifact persisted with the right shape.
    const artifact = result.artifacts[0]
    expect(artifact.type).toBe('gap_analysis')
    expect(artifact.fromItemId).toBe(a.id)
    expect(artifact.toItemId).toBe(b.id)
    // Provenance preserved on the artifact row regardless of what the model echoed.
    expect(artifact.relatedWritingBlockIds.sort()).toEqual([wb1, wb2].sort())
    expect(artifact.sourceModel).toBe('fake-model')

    const content = artifact.content as GapAnalysisContent
    expect(content.summary).toBe('A short fake summary.')
    expect(content.suggestions).toHaveLength(1)
    expect(content.suggestions[0].gapType).toBe('emotional')
    expect(content.suggestions[0].actionType).toBe('add_bridge')

    // And the artifact is listable via the repo.
    const listed = await manuscriptArtifactRepo.list(m.id, ownerId)
    expect(listed.map(x => x.id)).toContain(artifact.id)

    await manuscriptService.delete(m.id, ownerId)
  })

  it('targets a single junction when one is supplied', async () => {
    const fake = new FakeLlmClient()
    setLlmClientForTests(fake)

    const m = await manuscriptService.create({ userId: ownerId, title: `${tag} junction` })
    const wb1 = await createWritingBlock(ownerId, 'A', 'a body')
    const wb2 = await createWritingBlock(ownerId, 'B', 'b body')
    const wb3 = await createWritingBlock(ownerId, 'C', 'c body')
    const i1 = await manuscriptService.createItem(m.id, ownerId, { title: 'A', writingBlockId: wb1 })
    const i2 = await manuscriptService.createItem(m.id, ownerId, { title: 'B', writingBlockId: wb2 })
    const i3 = await manuscriptService.createItem(m.id, ownerId, { title: 'C', writingBlockId: wb3 })

    const result = await manuscriptAssistService.run(
      { manuscriptId: m.id, mode: 'gaps', junction: { fromItemId: i2.id, toItemId: i3.id } },
      ownerId
    )

    expect(fake.requests).toHaveLength(1)
    expect(result.analyzedJunctions).toEqual([{ fromItemId: i2.id, toItemId: i3.id }])
    // Item A's body must NOT have been put into this single-junction prompt.
    expect(fake.requests[0].user).not.toContain('a body')

    await manuscriptService.delete(m.id, ownerId)
  })

  it('skips junctions where both items are empty placeholders', async () => {
    const fake = new FakeLlmClient()
    setLlmClientForTests(fake)

    const m = await manuscriptService.create({ userId: ownerId, title: `${tag} skip` })
    await manuscriptService.createItem(m.id, ownerId, { title: 'PH 1', itemType: 'placeholder' })
    await manuscriptService.createItem(m.id, ownerId, { title: 'PH 2', itemType: 'placeholder' })

    const result = await manuscriptAssistService.run(
      { manuscriptId: m.id, mode: 'gaps' },
      ownerId
    )

    expect(fake.requests).toHaveLength(0)
    expect(result.skipped).toBe(1)
    expect(result.artifacts).toHaveLength(0)

    await manuscriptService.delete(m.id, ownerId)
  })

  it('dryRun does not persist artifacts but still returns them in-memory', async () => {
    const fake = new FakeLlmClient()
    setLlmClientForTests(fake)

    const m = await manuscriptService.create({ userId: ownerId, title: `${tag} dryrun` })
    const wb1 = await createWritingBlock(ownerId, 'A', 'a body')
    const wb2 = await createWritingBlock(ownerId, 'B', 'b body')
    await manuscriptService.createItem(m.id, ownerId, { title: 'A', writingBlockId: wb1 })
    await manuscriptService.createItem(m.id, ownerId, { title: 'B', writingBlockId: wb2 })

    const result = await manuscriptAssistService.run(
      { manuscriptId: m.id, mode: 'gaps', dryRun: true },
      ownerId
    )

    expect(result.artifacts).toHaveLength(1)
    const persisted = await manuscriptArtifactRepo.list(m.id, ownerId)
    expect(persisted).toHaveLength(0)

    await manuscriptService.delete(m.id, ownerId)
  })

  it('coerces malformed model responses into safe defaults rather than throwing', async () => {
    const fake = new FakeLlmClient()
    fake.response = { suggestions: 'not-an-array', summary: 42 } // garbage
    setLlmClientForTests(fake)

    const m = await manuscriptService.create({ userId: ownerId, title: `${tag} coerce` })
    const wb1 = await createWritingBlock(ownerId, 'A', 'a body')
    const wb2 = await createWritingBlock(ownerId, 'B', 'b body')
    await manuscriptService.createItem(m.id, ownerId, { title: 'A', writingBlockId: wb1 })
    await manuscriptService.createItem(m.id, ownerId, { title: 'B', writingBlockId: wb2 })

    const result = await manuscriptAssistService.run({ manuscriptId: m.id, mode: 'gaps' }, ownerId)
    expect(result.artifacts).toHaveLength(1)
    const content = result.artifacts[0].content as GapAnalysisContent
    expect(content.summary).toBe('No summary returned.')
    expect(content.suggestions).toEqual([])

    await manuscriptService.delete(m.id, ownerId)
  })

  it('drops malformed individual suggestions but keeps the well-formed ones', async () => {
    const fake = new FakeLlmClient()
    fake.response = {
      summary: 'mixed bag',
      suggestions: [
        { title: 'good one', body: 'some body', gapType: 'context', actionType: 'note', confidence: 'low', groundedIn: [] },
        { title: 'no body so dropped', body: '   ' },
        'not even an object',
        { title: 'bad enums clamped', body: 'b', gapType: 'wat', actionType: 'invent', confidence: 'huge', groundedIn: [] },
      ],
    }
    setLlmClientForTests(fake)

    const m = await manuscriptService.create({ userId: ownerId, title: `${tag} mixed` })
    const wb1 = await createWritingBlock(ownerId, 'A', 'a body')
    const wb2 = await createWritingBlock(ownerId, 'B', 'b body')
    await manuscriptService.createItem(m.id, ownerId, { title: 'A', writingBlockId: wb1 })
    await manuscriptService.createItem(m.id, ownerId, { title: 'B', writingBlockId: wb2 })

    const result = await manuscriptAssistService.run({ manuscriptId: m.id, mode: 'gaps' }, ownerId)
    const content = result.artifacts[0].content as GapAnalysisContent
    expect(content.suggestions).toHaveLength(2)
    expect(content.suggestions[0].title).toBe('good one')
    expect(content.suggestions[1].gapType).toBe('other')   // clamped from 'wat'
    expect(content.suggestions[1].actionType).toBe('note') // clamped from 'invent'
    expect(content.suggestions[1].confidence).toBe('medium') // clamped from 'huge'

    await manuscriptService.delete(m.id, ownerId)
  })
})
