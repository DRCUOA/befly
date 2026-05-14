/**
 * Markdown export formatter tests.
 *
 * Pure-function tests: no DB, no env, no network. They run anywhere vitest runs.
 */
import { describe, it, expect } from 'vitest'
import {
  manuscriptToMarkdown,
  suggestFilename,
  ExportItem,
} from './services/manuscript-export.service.js'
import {
  ManuscriptProject,
  ManuscriptSection,
} from './models/Manuscript.js'

function makeManuscript(over: Partial<ManuscriptProject> = {}): ManuscriptProject {
  return {
    id: 'm1',
    userId: 'u1',
    title: 'The Shape of Absence',
    workingSubtitle: 'Essays on continuing',
    sourceThemeIds: [],
    form: 'essay_collection',
    status: 'structuring',
    intendedReader: null,
    centralQuestion: 'How does a person keep living when absence becomes part of the furniture of life?',
    throughLine: 'Reflections on grief and the discipline of continuing.',
    emotionalArc: null,
    narrativePromise: null,
    visibility: 'private',
    spineDepth: 1,
    spineLayerLabels: ['Section'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function makeSection(over: Partial<ManuscriptSection> & { id: string; title: string; orderIndex: number }): ManuscriptSection {
  return {
    manuscriptId: 'm1',
    purpose: 'unassigned',
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  } as ManuscriptSection
}

function makeItem(over: Partial<ExportItem> & { id: string; title: string; orderIndex: number }): ExportItem {
  return {
    manuscriptId: 'm1',
    sectionId: null,
    writingBlockId: null,
    itemType: 'essay',
    structuralRole: null,
    summary: null,
    aiNotes: null,
    body: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  } as ExportItem
}

describe('manuscriptToMarkdown - front matter', () => {
  it('renders title, subtitle, form/status, and the literary direction block by default', () => {
    const md = manuscriptToMarkdown(makeManuscript(), [], [])
    expect(md).toContain('# The Shape of Absence')
    expect(md).toContain('*Essays on continuing*')
    expect(md).toContain('Essay collection')
    expect(md).toContain('Structuring')
    expect(md).toContain('**Central question**')
    expect(md).toContain('How does a person keep living')
    expect(md).toContain('**Through-line**')
  })

  it('omits the literary direction block when includeFrontMatter is false', () => {
    const md = manuscriptToMarkdown(makeManuscript(), [], [], { includeFrontMatter: false })
    expect(md).toContain('# The Shape of Absence')
    expect(md).not.toContain('**Central question**')
    expect(md).not.toContain('**Through-line**')
  })

  it('omits direction lines that are null or empty', () => {
    const m = makeManuscript({ centralQuestion: null, throughLine: null, workingSubtitle: null })
    const md = manuscriptToMarkdown(m, [], [])
    expect(md).not.toContain('Central question')
    expect(md).not.toContain('Through-line')
  })
})

describe('manuscriptToMarkdown - structure & ordering', () => {
  it('walks sections in order_index order and items in order_index order within them', () => {
    const sections = [
      makeSection({ id: 's2', title: 'Setup', orderIndex: 1, purpose: 'setup' }),
      makeSection({ id: 's1', title: 'Opening', orderIndex: 0, purpose: 'opening' }),
    ]
    const items: ExportItem[] = [
      makeItem({ id: 'i2', title: 'Second essay',  sectionId: 's1', orderIndex: 1, body: 'second body' }),
      makeItem({ id: 'i1', title: 'First essay',   sectionId: 's1', orderIndex: 0, body: 'first body' }),
      makeItem({ id: 'i3', title: 'Third essay',   sectionId: 's2', orderIndex: 0, body: 'third body' }),
    ]
    const md = manuscriptToMarkdown(makeManuscript(), sections, items)
    const openingPos = md.indexOf('## Opening')
    const setupPos = md.indexOf('## Setup')
    const firstPos = md.indexOf('First essay')
    const secondPos = md.indexOf('Second essay')
    const thirdPos = md.indexOf('Third essay')
    expect(openingPos).toBeGreaterThan(0)
    expect(openingPos).toBeLessThan(setupPos)
    expect(firstPos).toBeLessThan(secondPos)
    expect(secondPos).toBeLessThan(thirdPos)
  })

  it('renders an Unassigned group for items whose section_id is null', () => {
    const items = [
      makeItem({ id: 'i1', title: 'Orphan', sectionId: null, orderIndex: 0 }),
    ]
    const md = manuscriptToMarkdown(makeManuscript(), [], items)
    expect(md).toContain('## Unassigned')
    expect(md).toContain('Orphan')
  })

  it('renders an Unassigned group for items whose section_id no longer exists', () => {
    const items = [
      makeItem({ id: 'i1', title: 'Lost child', sectionId: 'gone', orderIndex: 0 }),
    ]
    const md = manuscriptToMarkdown(makeManuscript(), [], items)
    expect(md).toContain('## Unassigned')
    expect(md).toContain('Lost child')
  })

  it('inlines the essay body for essay items', () => {
    const items = [
      makeItem({ id: 'i1', title: 'Arrived Late Yesterday', orderIndex: 0, body: 'The rain had been falling since noon.' }),
    ]
    const md = manuscriptToMarkdown(makeManuscript(), [], items)
    expect(md).toContain('### Arrived Late Yesterday')
    expect(md).toContain('The rain had been falling since noon.')
  })

  it('marks essay body unavailable when body is null', () => {
    const items = [
      makeItem({ id: 'i1', title: 'Missing Essay', orderIndex: 0, body: null }),
    ]
    const md = manuscriptToMarkdown(makeManuscript(), [], items)
    expect(md).toMatch(/Essay body unavailable/)
  })
})

describe('manuscriptToMarkdown - filtering', () => {
  function spineWithAllTypes(): { sections: ManuscriptSection[]; items: ExportItem[] } {
    return {
      sections: [],
      items: [
        makeItem({ id: 'e', title: 'Essay piece',       orderIndex: 0, itemType: 'essay',       body: 'essay body' }),
        makeItem({ id: 'b', title: 'Bridge piece',      orderIndex: 1, itemType: 'bridge',      summary: 'bridge text' }),
        makeItem({ id: 'p', title: 'Placeholder piece', orderIndex: 2, itemType: 'placeholder' }),
        makeItem({ id: 'n', title: 'Note piece',        orderIndex: 3, itemType: 'note',        summary: 'a note' }),
        makeItem({ id: 'f', title: 'Fragment piece',    orderIndex: 4, itemType: 'fragment',    summary: 'a fragment' }),
      ],
    }
  }

  it('default options: keeps essays, bridges, placeholders; drops notes and fragments', () => {
    const { sections, items } = spineWithAllTypes()
    const md = manuscriptToMarkdown(makeManuscript(), sections, items)
    expect(md).toContain('Essay piece')
    expect(md).toContain('Bridge piece')
    expect(md).toContain('Placeholder piece')
    expect(md).not.toContain('Note piece')
    expect(md).not.toContain('Fragment piece')
  })

  it('respects per-type opt-ins', () => {
    const { sections, items } = spineWithAllTypes()
    const md = manuscriptToMarkdown(makeManuscript(), sections, items, {
      includeNotes: true,
      includeFragments: true,
      includePlaceholders: false,
    })
    expect(md).toContain('Essay piece')
    expect(md).toContain('Bridge piece')
    expect(md).not.toContain('Placeholder piece')
    expect(md).toContain('Note piece')
    expect(md).toContain('Fragment piece')
  })

  it('hides ai_notes by default and reveals them with includeAiNotes', () => {
    const items = [
      makeItem({ id: 'e', title: 'Essay piece', orderIndex: 0, body: 'body', aiNotes: 'private structural note' }),
    ]
    const off = manuscriptToMarkdown(makeManuscript(), [], items)
    expect(off).not.toContain('private structural note')
    const on = manuscriptToMarkdown(makeManuscript(), [], items, { includeAiNotes: true })
    expect(on).toContain('private structural note')
  })
})

describe('manuscriptToMarkdown - numbering and TOC', () => {
  it('numbers only essay items when numberItems is on', () => {
    const items = [
      makeItem({ id: 'e1', title: 'First essay',  orderIndex: 0, itemType: 'essay',       body: 'a' }),
      makeItem({ id: 'b1', title: 'Bridge',       orderIndex: 1, itemType: 'bridge',      summary: 'between' }),
      makeItem({ id: 'e2', title: 'Second essay', orderIndex: 2, itemType: 'essay',       body: 'b' }),
    ]
    const md = manuscriptToMarkdown(makeManuscript(), [], items, { numberItems: true })
    expect(md).toContain('### 1. First essay')
    expect(md).toContain('### 2. Second essay')
    // Bridge stays unnumbered.
    expect(md).toContain('### Bridge')
    expect(md).not.toMatch(/###\s+\d+\.\s+Bridge/)
  })

  it('emits a Contents block when includeToc is on', () => {
    const sections = [makeSection({ id: 's1', title: 'Opening', orderIndex: 0, purpose: 'opening' })]
    const items = [
      makeItem({ id: 'i1', title: 'Arrived Late Yesterday', sectionId: 's1', orderIndex: 0, body: 'text' }),
    ]
    const md = manuscriptToMarkdown(makeManuscript(), sections, items, { includeToc: true })
    expect(md).toContain('## Contents')
    expect(md).toContain('[Opening](#opening)')
    expect(md).toContain('[Arrived Late Yesterday](#arrived-late-yesterday)')
  })
})

/**
 * Phase 6 of the Configurable Spine Depth Refactor adds depth-aware
 * rendering: a section's `level` drives the markdown heading depth
 * (`##` for level 1, `###` for level 2, …). Items hang off the
 * deepest level. The tests below pin the new behaviour at depth=2
 * and depth=3 so any future drift surfaces in CI.
 */
describe('manuscriptToMarkdown — depth>1 heading hierarchy', () => {
  it('depth=2: level-1 sections get ## and level-2 sections get ###; items at #### sit under their level-2 leaf', () => {
    const sections = [
      makeSection({ id: 'p1', title: 'Before', orderIndex: 0, purpose: 'setup', level: 1 }),
      makeSection({ id: 'c1', title: 'The day before', orderIndex: 0, purpose: 'unassigned', level: 2, parentSectionId: 'p1' }),
      makeSection({ id: 'p2', title: 'After',  orderIndex: 1, purpose: 'resolution', level: 1 }),
      makeSection({ id: 'c2', title: 'Counting', orderIndex: 0, purpose: 'unassigned', level: 2, parentSectionId: 'p2' }),
    ]
    const items = [
      makeItem({ id: 'i1', title: 'Arrived Late Yesterday', sectionId: 'c1', orderIndex: 0, body: 'rain' }),
      makeItem({ id: 'i2', title: 'After Counting',         sectionId: 'c2', orderIndex: 0, body: 'tally' }),
    ]
    const md = manuscriptToMarkdown(
      makeManuscript({ spineDepth: 2, spineLayerLabels: ['Part', 'Chapter'] }),
      sections,
      items,
    )

    // Part headings at ##; chapter headings at ###; items at ####.
    expect(md).toMatch(/^## Before/m)
    expect(md).toMatch(/^## After/m)
    expect(md).toMatch(/^### The day before/m)
    expect(md).toMatch(/^### Counting/m)
    expect(md).toMatch(/^#### Arrived Late Yesterday/m)
    expect(md).toMatch(/^#### After Counting/m)

    // Reading order: parent before its descendants; siblings in order.
    const beforePos = md.indexOf('## Before')
    const chapterPos = md.indexOf('### The day before')
    const itemPos = md.indexOf('#### Arrived Late Yesterday')
    const afterPos = md.indexOf('## After')
    expect(beforePos).toBeLessThan(chapterPos)
    expect(chapterPos).toBeLessThan(itemPos)
    expect(itemPos).toBeLessThan(afterPos)
  })

  it('depth=3: each level adds one #, items emit two levels deeper than their leaf section', () => {
    const sections = [
      makeSection({ id: 'v1', title: 'Volume I', orderIndex: 0, level: 1 }),
      makeSection({ id: 'p1', title: 'Part 1',   orderIndex: 0, level: 2, parentSectionId: 'v1' }),
      makeSection({ id: 'c1', title: 'Chapter 1', orderIndex: 0, level: 3, parentSectionId: 'p1' }),
    ]
    const items = [
      makeItem({ id: 'i1', title: 'The first piece', sectionId: 'c1', orderIndex: 0, body: 'a' }),
    ]
    const md = manuscriptToMarkdown(
      makeManuscript({ spineDepth: 3, spineLayerLabels: ['Volume', 'Part', 'Chapter'] }),
      sections,
      items,
    )
    expect(md).toMatch(/^## Volume I/m)
    expect(md).toMatch(/^### Part 1/m)
    expect(md).toMatch(/^#### Chapter 1/m)
    expect(md).toMatch(/^##### The first piece/m)
  })

  it('depth=2 TOC nests items under their deepest-level section', () => {
    const sections = [
      makeSection({ id: 'p1', title: 'Before', orderIndex: 0, level: 1 }),
      makeSection({ id: 'c1', title: 'The day before', orderIndex: 0, level: 2, parentSectionId: 'p1' }),
    ]
    const items = [
      makeItem({ id: 'i1', title: 'Arrived Late', sectionId: 'c1', orderIndex: 0, body: 'r' }),
    ]
    const md = manuscriptToMarkdown(
      makeManuscript({ spineDepth: 2, spineLayerLabels: ['Part', 'Chapter'] }),
      sections,
      items,
      { includeToc: true },
    )
    expect(md).toContain('## Contents')
    // TOC bullets: parent at 0 indent, child section at 2-space indent,
    // item at 4-space indent.
    expect(md).toMatch(/^- \[Before\]\(#before\)/m)
    expect(md).toMatch(/^ {2}- \[The day before\]\(#the-day-before\)/m)
    expect(md).toMatch(/^ {4}- \[Arrived Late\]\(#arrived-late\)/m)
  })
})

describe('suggestFilename', () => {
  it('slugifies title and appends extension', () => {
    expect(suggestFilename(makeManuscript({ title: 'The Shape of Absence' }), 'md')).toBe('the-shape-of-absence.md')
  })
  it('falls back to "manuscript" when title slugifies to empty', () => {
    expect(suggestFilename(makeManuscript({ title: '!!!' }), 'md')).toBe('manuscript.md')
  })
})
