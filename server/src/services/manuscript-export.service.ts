/**
 * Manuscript export - pure markdown formatter.
 *
 * This module is intentionally a pure function over already-fetched data:
 *   - no DB access
 *   - no auth
 *   - no I/O
 * That makes it trivially unit-testable without a Postgres connection, and
 * keeps the rendering logic in one place that doesn't change shape when we
 * later add DOCX or PDF formats.
 */
import {
  ManuscriptProject,
  ManuscriptSection,
  ManuscriptItem,
  ManuscriptForm,
  ManuscriptStatus,
  ManuscriptSectionPurpose,
  ManuscriptItemType,
} from '../models/Manuscript.js'

export type ExportItem = ManuscriptItem & { body: string | null }

export interface MarkdownExportOptions {
  /** Include title block + literary direction (subtitle, central question, through-line). Default: true. */
  includeFrontMatter?: boolean
  /** Include a generated table of contents after the front matter. Default: false. */
  includeToc?: boolean
  /** Include the per-item ai_notes field. The spec says author notes are excluded by default. */
  includeAiNotes?: boolean
  /** Include 'note' type items (working notes for the writer). Default: false. */
  includeNotes?: boolean
  /** Include 'fragment' type items. Default: false. */
  includeFragments?: boolean
  /** Render 'placeholder' type items as italic stubs so the structure is visible even where the essay is unwritten. Default: true. */
  includePlaceholders?: boolean
  /** Prefix essay headings with "1.", "2.", ... in document order. Default: false. */
  numberItems?: boolean
}

const DEFAULTS: Required<MarkdownExportOptions> = {
  includeFrontMatter: true,
  includeToc: false,
  includeAiNotes: false,
  includeNotes: false,
  includeFragments: false,
  includePlaceholders: true,
  numberItems: false,
}

const FORM_LABELS: Record<ManuscriptForm, string> = {
  memoir: 'Memoir',
  essay_collection: 'Essay collection',
  long_form_essay: 'Long-form essay',
  creative_nonfiction: 'Creative nonfiction',
  hybrid: 'Hybrid',
  fictionalised_memoir: 'Fictionalised memoir',
}

const STATUS_LABELS: Record<ManuscriptStatus, string> = {
  gathering: 'Gathering',
  structuring: 'Structuring',
  drafting: 'Drafting',
  bridging: 'Bridging',
  revising: 'Revising',
  finalising: 'Finalising',
}

const PURPOSE_LABELS: Record<ManuscriptSectionPurpose, string> = {
  opening: 'Opening',
  setup: 'Setup',
  deepening: 'Deepening',
  turning_point: 'Turning point',
  contrast: 'Contrast',
  resolution: 'Resolution',
  ending: 'Ending',
  appendix: 'Appendix',
  unassigned: 'Section',
}

const TYPE_LABELS: Record<ManuscriptItemType, string> = {
  essay: 'Essay',
  bridge: 'Bridge',
  placeholder: 'Placeholder',
  note: 'Note',
  fragment: 'Fragment',
}

/**
 * Anchor-style id derived from a heading. Mirrors GitHub's slugifier loosely
 * enough for the table-of-contents links to land on the right spot in any
 * common markdown renderer. Returns '' for input that has nothing to slug -
 * callers pick their own fallback (anchors want 'section', filenames want
 * 'manuscript').
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function slugForAnchor(s: string): string {
  return slugify(s) || 'section'
}

/** Best-effort filename for the Content-Disposition header. */
export function suggestFilename(manuscript: ManuscriptProject, ext: string = 'md'): string {
  const slug = slugify(manuscript.title) || 'manuscript'
  return `${slug}.${ext}`
}

/**
 * Decide which items survive the user's filter options. Order is preserved.
 */
function filterItems(items: ExportItem[], opts: Required<MarkdownExportOptions>): ExportItem[] {
  return items.filter(item => {
    switch (item.itemType) {
      case 'essay':
      case 'bridge':
        return true
      case 'placeholder':
        return opts.includePlaceholders
      case 'note':
        return opts.includeNotes
      case 'fragment':
        return opts.includeFragments
      default:
        return true
    }
  })
}

/**
 * Group items in render order: walk sections in section order_index, then
 * append a final "Unassigned" group for items whose section_id is null or
 * points at a section that's been removed.
 */
interface RenderGroup {
  section: ManuscriptSection | null
  items: ExportItem[]
}

function groupItems(sections: ManuscriptSection[], items: ExportItem[]): RenderGroup[] {
  const orderedSections = [...sections].sort((a, b) =>
    a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt)
  )
  const sectionIds = new Set(orderedSections.map(s => s.id))

  const groups: RenderGroup[] = []
  for (const section of orderedSections) {
    const sectionItems = items
      .filter(i => i.sectionId === section.id)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
    groups.push({ section, items: sectionItems })
  }
  const unassigned = items
    .filter(i => !i.sectionId || !sectionIds.has(i.sectionId))
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
  if (unassigned.length > 0) {
    groups.push({ section: null, items: unassigned })
  }
  return groups
}

function renderFrontMatter(m: ManuscriptProject): string {
  const lines: string[] = []
  lines.push(`# ${m.title}`)
  if (m.workingSubtitle) {
    lines.push('')
    lines.push(`*${m.workingSubtitle}*`)
  }
  lines.push('')
  lines.push(`*${FORM_LABELS[m.form] ?? m.form} &middot; ${STATUS_LABELS[m.status] ?? m.status}*`)

  const direction: { label: string; value: string }[] = []
  if (m.centralQuestion) direction.push({ label: 'Central question', value: m.centralQuestion })
  if (m.throughLine)     direction.push({ label: 'Through-line',     value: m.throughLine })
  if (m.emotionalArc)    direction.push({ label: 'Emotional arc',    value: m.emotionalArc })
  if (m.narrativePromise) direction.push({ label: 'Narrative promise', value: m.narrativePromise })
  if (m.intendedReader)  direction.push({ label: 'Intended reader',  value: m.intendedReader })

  if (direction.length > 0) {
    lines.push('')
    lines.push('---')
    for (const { label, value } of direction) {
      lines.push('')
      lines.push(`**${label}**`)
      lines.push('')
      lines.push(value)
    }
    lines.push('')
    lines.push('---')
  }
  return lines.join('\n')
}

function renderToc(groups: RenderGroup[]): string {
  const lines: string[] = ['', '## Contents', '']
  for (const group of groups) {
    if (group.section) {
      const sLabel = group.section.title
      lines.push(`- [${sLabel}](#${slugForAnchor(sLabel)})`)
    } else {
      lines.push('- [Unassigned](#unassigned)')
    }
    for (const item of group.items) {
      lines.push(`  - [${item.title}](#${slugForAnchor(item.title)})`)
    }
  }
  return lines.join('\n')
}

function renderSectionHeading(section: ManuscriptSection | null): string {
  if (!section) {
    return [
      '',
      '## Unassigned',
      '',
      '*Items not yet placed in a section.*',
    ].join('\n')
  }
  const purposeNote = section.purpose && section.purpose !== 'unassigned'
    ? ` — *${PURPOSE_LABELS[section.purpose] ?? section.purpose}*`
    : ''
  const lines = ['', `## ${section.title}${purposeNote}`]
  if (section.notes) {
    lines.push('', `> ${section.notes.replace(/\n/g, '\n> ')}`)
  }
  return lines.join('\n')
}

function renderItem(item: ExportItem, opts: Required<MarkdownExportOptions>, ordinal: number | null): string {
  const numberPrefix = ordinal !== null ? `${ordinal}. ` : ''
  const lines: string[] = []
  lines.push('')
  lines.push(`### ${numberPrefix}${item.title}`)

  // Per-item metadata line - kept terse so it doesn't dominate the page.
  const meta: string[] = [TYPE_LABELS[item.itemType] ?? item.itemType]
  if (item.structuralRole) meta.push(item.structuralRole.replace(/_/g, ' '))
  lines.push('')
  lines.push(`*${meta.join(' &middot; ')}*`)

  if (item.summary) {
    lines.push('')
    lines.push(`> ${item.summary.replace(/\n/g, '\n> ')}`)
  }

  if (item.itemType === 'essay') {
    if (item.body && item.body.trim()) {
      lines.push('')
      lines.push(item.body.trim())
    } else {
      lines.push('')
      lines.push('*[Essay body unavailable - the linked writing block has no content or was removed.]*')
    }
  } else if (item.itemType === 'bridge') {
    if (item.body && item.body.trim()) {
      // A bridge backed by a real writing_block - rare, but treat the body as the bridge text.
      lines.push('')
      lines.push(item.body.trim())
    } else if (!item.summary) {
      lines.push('')
      lines.push('*[Bridge text not yet written.]*')
    }
  } else if (item.itemType === 'placeholder') {
    if (!item.summary) {
      lines.push('')
      lines.push('*[Placeholder - essay not yet written.]*')
    }
  }

  if (opts.includeAiNotes && item.aiNotes && item.aiNotes.trim()) {
    lines.push('')
    lines.push('<details><summary>Notes</summary>')
    lines.push('')
    lines.push(item.aiNotes.trim())
    lines.push('')
    lines.push('</details>')
  }

  return lines.join('\n')
}

/**
 * The whole export: front matter + optional TOC + grouped items in order.
 */
export function manuscriptToMarkdown(
  manuscript: ManuscriptProject,
  sections: ManuscriptSection[],
  items: ExportItem[],
  options: MarkdownExportOptions = {}
): string {
  const opts: Required<MarkdownExportOptions> = { ...DEFAULTS, ...options }

  const filtered = filterItems(items, opts)
  const groups = groupItems(sections, filtered)

  const parts: string[] = []
  if (opts.includeFrontMatter) {
    parts.push(renderFrontMatter(manuscript))
  } else {
    parts.push(`# ${manuscript.title}`)
  }
  if (opts.includeToc && groups.length > 0) {
    parts.push(renderToc(groups))
  }

  let ordinal = 0
  for (const group of groups) {
    parts.push(renderSectionHeading(group.section))
    for (const item of group.items) {
      const counted = opts.numberItems && item.itemType === 'essay'
      if (counted) ordinal += 1
      parts.push(renderItem(item, opts, counted ? ordinal : null))
    }
  }

  // Single trailing newline is friendlier for downstream tooling than none.
  return parts.join('\n') + '\n'
}
