/**
 * Pure-logic chunker tests — no DB or LLM access.
 *
 * Run with: npm test --workspace=server
 */
import { describe, it, expect } from 'vitest'
import { chunkText } from './chunker.js'

describe('chunkText', () => {
  it('returns a single chunk for short input', () => {
    const chunks = chunkText('A short paragraph.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('A short paragraph.')
  })

  it('returns no chunks for empty input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('splits long input on paragraph boundaries when possible', () => {
    // Build a body that is well over the default char budget.
    const para = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)
    const body = Array.from({ length: 6 }, (_, i) => `Paragraph ${i + 1}. ${para}`).join('\n\n')
    const chunks = chunkText(body, { targetTokens: 400, overlapTokens: 0 })
    expect(chunks.length).toBeGreaterThan(1)
    // Each chunk should be roughly within budget (allow generous slack).
    for (const c of chunks) {
      expect(c.text.length).toBeLessThan(400 * 4 * 2)
    }
    // Concatenating chunks should preserve all paragraph identifiers.
    const joined = chunks.map(c => c.text).join('\n')
    for (let i = 1; i <= 6; i++) {
      expect(joined).toContain(`Paragraph ${i}.`)
    }
  })

  it('respects target token budget on small inputs', () => {
    const chunks = chunkText('Hello world.\n\nSecond paragraph here.\n\nThird one too.', {
      targetTokens: 1000,
    })
    expect(chunks).toHaveLength(1)
  })

  it('produces at least one chunk for any non-empty input', () => {
    const chunks = chunkText('a'.repeat(1000), { targetTokens: 100, overlapTokens: 0 })
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    const total = chunks.reduce((acc, c) => acc + c.text.length, 0)
    expect(total).toBeGreaterThan(0)
  })

  it('overlap mode prepends some prior tail onto subsequent chunks', () => {
    const para = 'Sentence one. Sentence two. Sentence three. Sentence four. '.repeat(8)
    const body = Array.from({ length: 5 }, () => para).join('\n\n')
    const chunks = chunkText(body, { targetTokens: 200, overlapTokens: 60 })
    if (chunks.length >= 2) {
      // The second chunk should start with content drawn from the tail of
      // the first chunk (overlap), so a substring from the first chunk
      // should appear at or near the start of the second.
      // We don't assert the exact substring (chunk boundaries depend on
      // sentence search); we just assert chunks 1+ are longer than they'd
      // be without overlap by checking total length is higher than the
      // input length.
      const total = chunks.reduce((acc, c) => acc + c.text.length, 0)
      expect(total).toBeGreaterThan(body.length)
    }
  })
})
