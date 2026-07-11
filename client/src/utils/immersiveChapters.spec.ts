import { describe, it, expect } from 'vitest'
import { buildManuscriptChapters } from './immersiveChapters'
import type { ManuscriptSection, ManuscriptItem, ManuscriptItemType } from '@shared/Manuscript'

const section = (id: string, title: string, orderIndex: number): ManuscriptSection =>
  ({ id, title, orderIndex } as unknown as ManuscriptSection)

const item = (
  id: string,
  itemType: ManuscriptItemType,
  title: string,
  opts: { writingBlockId?: string | null; summary?: string | null } = {},
): ManuscriptItem =>
  ({
    id,
    itemType,
    title,
    writingBlockId: opts.writingBlockId ?? null,
    summary: opts.summary ?? null,
  } as unknown as ManuscriptItem)

describe('buildManuscriptChapters', () => {
  it('walks sections in order and emits a divider before each section with readable items', () => {
    const sections = [section('s1', 'Part One', 0), section('s2', 'Part Two', 1)]
    const itemsBySection = new Map([
      ['s1', [item('i1', 'essay', 'First frag', { writingBlockId: 'w1' })]],
      ['s2', [item('i2', 'essay', 'Second frag', { writingBlockId: 'w2' })]],
    ])
    const bodies = new Map([
      ['w1', 'Body one.'],
      ['w2', 'Body two.'],
    ])

    const chapters = buildManuscriptChapters(sections, itemsBySection, [], bodies)

    expect(chapters.map(c => [c.kind, c.title])).toEqual([
      ['section', 'Part One'],
      ['chapter', 'First frag'],
      ['section', 'Part Two'],
      ['chapter', 'Second frag'],
    ])
    expect(chapters[1].markdown).toBe('Body one.')
  })

  it('skips notes, fragments and placeholders, and omits dividers for sections left empty', () => {
    const sections = [section('s1', 'Scaffolding only', 0), section('s2', 'Real part', 1)]
    const itemsBySection = new Map([
      ['s1', [
        item('i1', 'note', 'A working note'),
        item('i2', 'fragment', 'A fragment'),
        item('i3', 'placeholder', 'Not yet written'),
      ]],
      ['s2', [item('i4', 'essay', 'The frag', { writingBlockId: 'w1' })]],
    ])
    const chapters = buildManuscriptChapters(sections, itemsBySection, [], new Map([['w1', 'Text.']]))

    expect(chapters.map(c => c.title)).toEqual(['Real part', 'The frag'])
  })

  it('renders bridges from their summary, falling back to the title', () => {
    const itemsBySection = new Map([
      ['s1', [
        item('i1', 'bridge', 'Bridge label', { summary: 'Connective tissue.' }),
        item('i2', 'bridge', 'Bare bridge'),
      ]],
    ])
    const chapters = buildManuscriptChapters([section('s1', 'Part', 0)], itemsBySection, [], new Map())

    expect(chapters.filter(c => c.kind === 'bridge').map(c => c.markdown)).toEqual([
      'Connective tissue.',
      'Bare bridge',
    ])
  })

  it('appends unassigned readable items after all sections, without a divider', () => {
    const chapters = buildManuscriptChapters(
      [],
      new Map(),
      [item('i1', 'essay', 'Loose frag', { writingBlockId: 'w1' }), item('i2', 'note', 'Skip me')],
      new Map([['w1', 'Loose body.']]),
    )
    expect(chapters).toEqual([
      { id: 'item-i1', kind: 'chapter', title: 'Loose frag', markdown: 'Loose body.' },
    ])
  })

  it('stubs interactive (standalone HTML) frags and missing bodies instead of dumping raw HTML', () => {
    const itemsBySection = new Map([
      ['s1', [
        item('i1', 'essay', 'Interactive piece', { writingBlockId: 'w1' }),
        item('i2', 'essay', 'Unloaded piece', { writingBlockId: 'w2' }),
      ]],
    ])
    const bodies = new Map([['w1', '<!DOCTYPE html><html><body>app</body></html>']])
    const chapters = buildManuscriptChapters([section('s1', 'Part', 0)], itemsBySection, [], bodies)

    expect(chapters[1].markdown).toMatch(/interactive frag/i)
    expect(chapters[1].markdown).not.toContain('<!DOCTYPE')
    expect(chapters[2].markdown).toMatch(/unavailable/i)
  })
})
