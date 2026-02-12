/**
 * Guardrail tests: prevent regression if .trim() is reintroduced on pattern/replacement.
 *
 * These tests ensure typography rules preserve leading/trailing spaces:
 *   - pattern " {2,}" (space before quantifier) must not become "{2,}"
 *   - replacement " " (single space) must not become ""
 *
 * Run: npm run test (from server/) or npm run test --workspace=server
 * Requires: DATABASE_URL in .env, migrations applied
 */
import './config/env-loader.js'

import { describe, it, expect, afterEach } from 'vitest'
import { typographyService } from './services/typography.service.js'

function uniqueId(): string {
  return `guardrail_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

async function saveRule(overrides: {
  pattern: string
  replacement: string
  ruleId?: string
  description?: string
}) {
  const ruleId = overrides.ruleId ?? uniqueId()
  const description = overrides.description ?? 'Guardrail test rule'
  return typographyService.create({
    ruleId,
    description,
    pattern: overrides.pattern,
    replacement: overrides.replacement,
  })
}

async function getRule(id: string) {
  return typographyService.getById(id)
}

describe('Typography rules: pattern/replacement preservation (no .trim() regression)', () => {
  const createdIds: string[] = []

  afterEach(async () => {
    for (const id of createdIds) {
      try {
        await typographyService.delete(id)
      } catch {
        // ignore
      }
    }
    createdIds.length = 0
  })

  it('preserves leading space in pattern', async () => {
    const rule = await saveRule({
      pattern: ' {2,}',
      replacement: ' ',
    })
    createdIds.push(rule.id)

    expect(rule.pattern).toBe(' {2,}')
    expect(rule.replacement).toBe(' ')
  })

  it('preserves trailing space in pattern', async () => {
    const rule = await saveRule({
      pattern: '  +',
      replacement: ' ',
    })
    createdIds.push(rule.id)

    expect(rule.pattern).toBe('  +')
    expect(rule.replacement).toBe(' ')
  })

  it('preserves single-space replacement', async () => {
    const rule = await saveRule({
      pattern: '\\s{2,}',
      replacement: ' ',
    })
    createdIds.push(rule.id)

    expect(rule.replacement).toBe(' ')
  })

  it('round-trip: pattern and replacement unchanged after save and fetch', async () => {
    const original = {
      pattern: ' {2,}',
      replacement: ' ',
    }
    const saved = await saveRule(original)
    createdIds.push(saved.id)

    expect(saved.pattern).toEqual(original.pattern)
    expect(saved.replacement).toEqual(original.replacement)

    const fetched = await getRule(saved.id)
    expect(fetched.pattern).toEqual(original.pattern)
    expect(fetched.replacement).toEqual(original.replacement)
  })

  it('round-trip: capture-group pattern with spaces preserved', async () => {
    const original = {
      pattern: ' (\\w+) ',
      replacement: ' $1 ',
    }
    const saved = await saveRule(original)
    createdIds.push(saved.id)

    const fetched = await getRule(saved.id)
    expect(fetched.pattern).toEqual(original.pattern)
    expect(fetched.replacement).toEqual(original.replacement)
  })
})
