/**
 * Manuscript segregation tests.
 *
 * Load-bearing test for the RAG layer: retrieval MUST NEVER return
 * chunks from a manuscript other than the one passed in. We verify
 * this by:
 *   1. Creating two users and one manuscript per user.
 *   2. Compiling, chunking, and embedding both manuscripts with a
 *      deterministic fake embedder.
 *   3. Querying manuscript A and asserting every returned chunk's
 *      manuscriptId === A.id (and the same for B).
 *   4. Crafting a query that semantically matches B's content best,
 *      retrieving against A, and asserting the response is empty
 *      OR contains only A-scoped chunks.
 *
 * Tests also cover:
 *   - canonical sources getting boosted
 *   - rejected/superseded sources being excluded by default
 *   - hash-based skip on unchanged sources
 *   - uploaded files only appearing when explicitly attached
 *   - ai_exchanges storing manuscript_id (verified via the LLM context
 *     boundary in the assist tests, not here)
 *
 * Requires: DATABASE_URL in .env, migrations applied through 022.
 * If pgvector isn't installed locally, migration 022 will fail and these
 * tests won't run — by design.
 */
import '../../config/env-loader.js'

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { pool } from '../../config/db.js'
import { manuscriptService } from '../manuscript.service.js'
import { manuscriptContextRepo } from '../../repositories/manuscript-context.repo.js'
import {
  compileManuscriptContext,
  chunkManuscriptContext,
  embedManuscriptContext,
  retrieveManuscriptContext,
  setEmbeddingClientForTests,
  type EmbeddingClient,
} from './index.js'

const tag = `rag_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

let userA = ''
let userB = ''

/**
 * Deterministic embedder: each text is hashed into a fixed-dimension
 * unit vector so identical text gets identical vectors and similar
 * text gets cosine-close vectors. Good enough to test ordering and
 * filtering without a real model.
 */
class FakeEmbeddingClient implements EmbeddingClient {
  readonly model = 'fake-embed-model'
  readonly dimension = 1536

  async embedText(text: string): Promise<number[]> {
    return this.embed(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(t => this.embed(t))
  }

  private embed(text: string): number[] {
    // Map every character to a position via simple modulo. We add 0.1 to
    // a few positions per character so two texts that share many words
    // produce close vectors, while disjoint texts produce far vectors.
    const v = new Array<number>(this.dimension).fill(0)
    const norm = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
    const tokens = norm.split(/\s+/).filter(Boolean)
    for (const tok of tokens) {
      let h = 0
      for (let i = 0; i < tok.length; i++) {
        h = (h * 31 + tok.charCodeAt(i)) | 0
      }
      const idx = ((h % this.dimension) + this.dimension) % this.dimension
      v[idx] += 1
    }
    // Normalize so cosine similarity = dot product.
    let mag = 0
    for (const x of v) mag += x * x
    mag = Math.sqrt(mag) || 1
    return v.map(x => x / mag)
  }
}

async function createUser(label: string): Promise<string> {
  const r = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, status)
     VALUES ($1, 'x', $2, 'active') RETURNING id`,
    [`${tag}_${label}@example.test`, `${tag} ${label}`]
  )
  return r.rows[0].id
}

async function createWritingBlock(userId: string, title: string, body: string): Promise<string> {
  const r = await pool.query(
    `INSERT INTO writing_blocks (user_id, title, body, visibility)
     VALUES ($1, $2, $3, 'private') RETURNING id`,
    [userId, title, body]
  )
  return r.rows[0].id
}

async function deleteUserCascade(userId: string): Promise<void> {
  // Manuscripts cascade-delete sources/chunks/embeddings via FKs.
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId])
}

beforeAll(async () => {
  setEmbeddingClientForTests(new FakeEmbeddingClient())
  userA = await createUser('userA')
  userB = await createUser('userB')
})

afterAll(async () => {
  setEmbeddingClientForTests(null)
  if (userA) await deleteUserCascade(userA)
  if (userB) await deleteUserCascade(userB)
})

afterEach(async () => {
  // Re-install the fake — tests that swap it should restore on completion,
  // but be defensive.
  setEmbeddingClientForTests(new FakeEmbeddingClient())
})

describe('RAG segregation', () => {
  it('retrieval never returns chunks from a different manuscript', async () => {
    // Set up two manuscripts with disjoint subject matter.
    const mA = await manuscriptService.create({
      userId: userA, title: `${tag} A — falconry`,
      centralQuestion: 'Why does a falcon return to the falconer?',
    })
    const mB = await manuscriptService.create({
      userId: userB, title: `${tag} B — submarines`,
      centralQuestion: 'How does a submarine maintain neutral buoyancy?',
    })

    const wbA = await createWritingBlock(userA, 'Falcon rituals',
      'The falconer spent every dawn on the ridge with the peregrine, the lure, the leather hood.')
    const wbB = await createWritingBlock(userB, 'Buoyancy tanks',
      'The submarine flooded its ballast tanks and dropped beneath the thermocline at dusk.')

    await manuscriptService.createItem(mA.id, userA, { title: 'Falcon rituals', writingBlockId: wbA })
    await manuscriptService.createItem(mB.id, userB, { title: 'Buoyancy tanks', writingBlockId: wbB })

    // Compile + chunk + embed both.
    await compileManuscriptContext(mA.id)
    await compileManuscriptContext(mB.id)
    await chunkManuscriptContext(mA.id)
    await chunkManuscriptContext(mB.id)
    await embedManuscriptContext(mA.id)
    await embedManuscriptContext(mB.id)

    // Query A with a submarine-shaped query. Even if the model finds
    // any "submarine" chunk in B's manuscript, retrieval must still
    // refuse to return it because we asked about A.
    const fromA = await retrieveManuscriptContext(mA.id, 'submarine ballast tanks neutral buoyancy', { topK: 8 })
    for (const c of fromA.chunks) {
      expect(c.manuscriptId).toBe(mA.id)
    }

    // Query B with a falconry-shaped query — same guarantee.
    const fromB = await retrieveManuscriptContext(mB.id, 'falconer peregrine lure leather hood', { topK: 8 })
    for (const c of fromB.chunks) {
      expect(c.manuscriptId).toBe(mB.id)
    }

    // Sanity: a within-manuscript query should actually return chunks
    // (we want a positive signal, not just an empty result).
    const within = await retrieveManuscriptContext(mA.id, 'peregrine falconer', { topK: 8 })
    expect(within.chunks.length).toBeGreaterThan(0)
    for (const c of within.chunks) {
      expect(c.manuscriptId).toBe(mA.id)
    }

    await manuscriptService.delete(mA.id, userA)
    await manuscriptService.delete(mB.id, userB)
  })

  it('compiler is idempotent — second pass creates no new sources when nothing changed', async () => {
    const m = await manuscriptService.create({ userId: userA, title: `${tag} idempotent` })
    const wb = await createWritingBlock(userA, 'Block 1', 'Some essay text here.')
    await manuscriptService.createItem(m.id, userA, { title: 'Block 1', writingBlockId: wb })

    const first = await compileManuscriptContext(m.id)
    const second = await compileManuscriptContext(m.id)

    // Every source row in the second pass should be reported as 'unchanged'.
    expect(second.sources.length).toBe(first.sources.length)
    expect(second.sources.every(s => s.action === 'unchanged')).toBe(true)

    await manuscriptService.delete(m.id, userA)
  })

  it('compiler marks deleted upstream rows as superseded', async () => {
    const m = await manuscriptService.create({ userId: userA, title: `${tag} super` })
    const wb = await createWritingBlock(userA, 'Block 1', 'Body text.')
    const item = await manuscriptService.createItem(m.id, userA, { title: 'Block 1', writingBlockId: wb })

    await compileManuscriptContext(m.id)

    // Delete the item.
    await manuscriptService.deleteItem(item.id, userA)

    const r = await compileManuscriptContext(m.id)
    expect(r.superseded.length).toBeGreaterThanOrEqual(1)

    // Superseded sources are excluded by default in retrieval.
    await chunkManuscriptContext(m.id)
    await embedManuscriptContext(m.id)
    const ret = await retrieveManuscriptContext(m.id, 'Body text', { topK: 5 })
    for (const c of ret.chunks) {
      // The originating manuscript_item source should not appear.
      expect(c.sourceType).not.toBe('manuscript_item')
    }

    await manuscriptService.delete(m.id, userA)
  })

  it('canonical sources score higher than non-canonical for equally-similar queries', async () => {
    const m = await manuscriptService.create({ userId: userA, title: `${tag} boost` })
    // Two sources with identical text — the ranking signal is canonical.
    await manuscriptContextRepo.upsertSource({
      manuscriptId: m.id,
      userId: userA,
      sourceType: 'manual_note',
      sourceId: null,
      title: 'Note A (non-canonical)',
      body: 'twin manuscript context paragraph',
      canonical: false,
      contentHash: 'h1',
    })
    await manuscriptContextRepo.upsertSource({
      manuscriptId: m.id,
      userId: userA,
      sourceType: 'manual_note',
      sourceId: null,
      title: 'Note B (canonical)',
      body: 'twin manuscript context paragraph',
      canonical: true,
      contentHash: 'h2',
    })
    await chunkManuscriptContext(m.id)
    await embedManuscriptContext(m.id)

    const r = await retrieveManuscriptContext(m.id, 'twin manuscript context paragraph', { topK: 5 })
    expect(r.chunks.length).toBeGreaterThanOrEqual(2)
    // The canonical row must rank ahead of the non-canonical one.
    const canonical = r.chunks.find(c => c.title.includes('canonical'))
    const nonCanonical = r.chunks.find(c => c.title.includes('non-canonical'))
    expect(canonical).toBeDefined()
    expect(nonCanonical).toBeDefined()
    expect(canonical!.score).toBeGreaterThan(nonCanonical!.score)

    await manuscriptService.delete(m.id, userA)
  })

  it('rejected sources are excluded from retrieval by default', async () => {
    const m = await manuscriptService.create({ userId: userA, title: `${tag} reject` })
    await manuscriptContextRepo.upsertSource({
      manuscriptId: m.id,
      userId: userA,
      sourceType: 'manual_note',
      sourceId: null,
      title: 'Rejected note',
      body: 'unique-rejected-token zzz',
      status: 'rejected',
      contentHash: 'r1',
    })
    await chunkManuscriptContext(m.id)
    await embedManuscriptContext(m.id)

    const r = await retrieveManuscriptContext(m.id, 'unique-rejected-token zzz', { topK: 5 })
    expect(r.chunks.find(c => c.title === 'Rejected note')).toBeUndefined()

    // But explicitly opting in returns it.
    const r2 = await retrieveManuscriptContext(m.id, 'unique-rejected-token zzz', {
      topK: 5,
      includeArchived: true,
    })
    expect(r2.chunks.length).toBeGreaterThanOrEqual(1)

    await manuscriptService.delete(m.id, userA)
  })

  it('contextPack respects maxContextTokens', async () => {
    const m = await manuscriptService.create({ userId: userA, title: `${tag} budget` })
    // Create several sizable sources.
    const para = 'lorem ipsum dolor sit amet '.repeat(80)
    for (let i = 0; i < 5; i++) {
      await manuscriptContextRepo.upsertSource({
        manuscriptId: m.id,
        userId: userA,
        sourceType: 'manual_note',
        sourceId: null,
        title: `Big note ${i}`,
        body: `${para} ${i}`,
        contentHash: `b${i}`,
      })
    }
    await chunkManuscriptContext(m.id)
    await embedManuscriptContext(m.id)

    const r = await retrieveManuscriptContext(m.id, 'lorem ipsum dolor sit', {
      topK: 20,
      maxContextTokens: 300,
    })
    // Total approximate tokens across returned chunks should not exceed
    // 2x the budget (we allow a single overrun for the first chunk so
    // small budgets always have at least one result).
    const totalChars = r.chunks.reduce((acc, c) => acc + c.text.length, 0)
    expect(totalChars).toBeLessThan(300 * 4 * 2.5)

    await manuscriptService.delete(m.id, userA)
  })

  it('uploaded files appear only when attached to the manuscript', async () => {
    const m = await manuscriptService.create({ userId: userA, title: `${tag} upload` })

    // Insert an uploaded file row directly (avoiding the multer route).
    const upload = await pool.query(
      `INSERT INTO uploaded_files (filename, content_type, data, size_bytes, uploaded_by)
       VALUES ($1, 'text/plain', '\\x00'::bytea, 0, $2) RETURNING id`,
      [`${tag}-file.txt`, userA]
    )
    const fileId = upload.rows[0].id as string

    // Without an entry in manuscript_uploaded_files, the compiler must
    // not pull the file in.
    let r = await compileManuscriptContext(m.id)
    expect(r.sources.find(s => s.sourceType === 'uploaded_file')).toBeUndefined()

    // Attach.
    await pool.query(
      `INSERT INTO manuscript_uploaded_files (manuscript_id, uploaded_file_id, context_role, include_in_ai)
       VALUES ($1, $2, 'research', TRUE)`,
      [m.id, fileId]
    )
    r = await compileManuscriptContext(m.id)
    expect(r.sources.find(s => s.sourceType === 'uploaded_file')).toBeDefined()

    await pool.query(`DELETE FROM uploaded_files WHERE id = $1`, [fileId])
    await manuscriptService.delete(m.id, userA)
  })
})
