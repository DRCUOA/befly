/**
 * Pure tests for the gap-analysis prompt builder.
 *
 * No DB, no env, no network. Verifies the retrieval-before-generation rule
 * (essay bodies appear in the prompt) and that the JSON contract sent to the
 * model is well-formed.
 */
import { describe, it, expect } from 'vitest'
import {
  ASSIST_SYSTEM_PROMPT,
  buildGapAnalysisPrompt,
  trimBodyForPrompt,
  GapPromptItem,
} from './services/llm/prompts.js'
import { ManuscriptProject } from './models/Manuscript.js'

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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function makeItem(over: Partial<GapPromptItem> & { id: string; title: string; orderIndex: number; body: string | null }): GapPromptItem {
  return {
    manuscriptId: 'm1',
    sectionId: null,
    writingBlockId: null,
    itemType: 'essay',
    structuralRole: null,
    summary: null,
    aiNotes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  } as GapPromptItem
}

describe('ASSIST_SYSTEM_PROMPT', () => {
  it('forbids invented facts and demands grounded suggestions', () => {
    expect(ASSIST_SYSTEM_PROMPT).toMatch(/inventing facts|invent/i)
    expect(ASSIST_SYSTEM_PROMPT).toMatch(/grounded/i)
  })
  it('demands JSON-only output with no code fences', () => {
    expect(ASSIST_SYSTEM_PROMPT).toMatch(/JSON object/i)
    expect(ASSIST_SYSTEM_PROMPT).toMatch(/code fences|outside the JSON/i)
  })
})

describe('trimBodyForPrompt', () => {
  it('returns empty string for null body', () => {
    expect(trimBodyForPrompt(null)).toBe('')
  })
  it('returns short bodies untouched', () => {
    expect(trimBodyForPrompt('hello world')).toBe('hello world')
  })
  it('keeps head and tail when trimming a long body', () => {
    const long = 'A'.repeat(5000) + 'MIDDLE_THAT_SHOULD_BE_DROPPED' + 'B'.repeat(5000)
    const out = trimBodyForPrompt(long, 1000)
    expect(out.length).toBeLessThan(long.length)
    expect(out).toContain('AAAA')
    expect(out).toContain('BBBB')
    expect(out).toContain('trimmed')
    expect(out).not.toContain('MIDDLE_THAT_SHOULD_BE_DROPPED')
  })
})

describe('buildGapAnalysisPrompt - retrieval before generation', () => {
  const from = makeItem({
    id: 'item-A',
    title: 'Arrived Late Yesterday',
    orderIndex: 0,
    body: 'The rain had been falling since noon. By the time we pulled up to the house there was nothing to say.',
  })
  const to = makeItem({
    id: 'item-B',
    title: 'The House Sale',
    orderIndex: 1,
    body: 'The estate agent arrived on Tuesday with a clipboard. We did not invite her into the kitchen.',
  })

  it('includes the manuscript title and form in the prompt', () => {
    const p = buildGapAnalysisPrompt({ manuscript: makeManuscript(), from, to })
    expect(p).toContain('The Shape of Absence')
    expect(p).toContain('essay_collection')
  })

  it('includes the literary direction (central question, through-line) when present', () => {
    const p = buildGapAnalysisPrompt({ manuscript: makeManuscript(), from, to })
    expect(p).toContain('Central question')
    expect(p).toContain('absence becomes part of the furniture')
    expect(p).toContain('Through-line')
    expect(p).toContain('discipline of continuing')
  })

  it('falls back gracefully when literary direction is empty', () => {
    const p = buildGapAnalysisPrompt({
      manuscript: makeManuscript({ centralQuestion: null, throughLine: null, workingSubtitle: null, emotionalArc: null, narrativePromise: null }),
      from, to,
    })
    expect(p).toContain('(none provided)')
  })

  it('inlines both essay bodies (the retrieval-before-generation rule)', () => {
    const p = buildGapAnalysisPrompt({ manuscript: makeManuscript(), from, to })
    expect(p).toContain('The rain had been falling since noon')
    expect(p).toContain('The estate agent arrived on Tuesday')
  })

  it('marks the no-body case clearly so the model does not hallucinate from a placeholder', () => {
    const placeholder = makeItem({
      id: 'p1', title: 'Placeholder', orderIndex: 5, itemType: 'placeholder', body: null,
    })
    const p = buildGapAnalysisPrompt({ manuscript: makeManuscript(), from, to: placeholder })
    expect(p).toMatch(/No body text/)
  })

  it('embeds prior accepted notes when supplied', () => {
    const p = buildGapAnalysisPrompt({
      manuscript: makeManuscript(),
      from, to,
      priorAcceptedNotes: ['Tone shift between grief and administration was previously flagged'],
    })
    expect(p).toContain('Tone shift between grief and administration was previously flagged')
  })

  it('hands the model the exact item ids it must echo back as provenance', () => {
    const p = buildGapAnalysisPrompt({ manuscript: makeManuscript(), from, to })
    // The schema interpolates item ids so the model returns matching provenance.
    expect(p).toContain(`"itemId": "${from.id}"`)
    expect(p).toContain(`"itemId": "${to.id}"`)
  })

  it('lists every gapType allowed by the GapAnalysisContent schema', () => {
    const p = buildGapAnalysisPrompt({ manuscript: makeManuscript(), from, to })
    for (const t of ['context','emotional','logical','time','character','motif','repetition','other']) {
      expect(p).toContain(t)
    }
  })

  it('lists every actionType allowed by the AssistSuggestion schema', () => {
    const p = buildGapAnalysisPrompt({ manuscript: makeManuscript(), from, to })
    for (const a of ['add_bridge','revise','reorder','cut','expand','question','note']) {
      expect(p).toContain(a)
    }
  })
})
