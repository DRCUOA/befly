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
 * One section in render order, with its directly-attached items and
 * an explicit depth (1-based) that drives the heading level. Items
 * only ever hang off deepest-level sections (the Configurable Spine
 * Depth invariant from Phase 3), so non-leaf nodes typically have
 * `items: []` and serve only as container headings.
 */
interface RenderNode {
  section: ManuscriptSection
  items: ExportItem[]
  children: RenderNode[]
}

/**
 * Build a depth-aware render tree from the flat section list plus an
 * Unassigned bucket at the end.
 *
 * Returns:
 *   - `roots`: top-level sections in order_index order, each with
 *     children (themselves RenderNodes) walked from their
 *     parent_section_id descendants. Items on each leaf are sorted.
 *   - `unassigned`: items whose section_id is null OR points at a
 *     section that's been removed. Rendered as one flat group AFTER
 *     the tree.
 *
 * At depth=1 (every legacy manuscript) every section is a level-1
 * leaf with no children → DFS over `roots` visits exactly the
 * sections in the same order the old `groupItems` walker did, and
 * each visit emits the same `## Section` + `### Item` markdown. The
 * existing snapshot-style assertions in manuscript-export.test.ts
 * stay green.
 */
function buildRenderTree(sections: ManuscriptSection[], items: ExportItem[]): {
  roots: RenderNode[]
  unassigned: ExportItem[]
} {
  const orderedSections = [...sections].sort((a, b) =>
    a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt)
  )
  const sectionIds = new Set(orderedSections.map(s => s.id))

  // Index items by their section id once, sorted within each bucket.
  const itemsBySection = new Map<string, ExportItem[]>()
  for (const s of orderedSections) itemsBySection.set(s.id, [])
  for (const item of items) {
    if (item.sectionId && itemsBySection.has(item.sectionId)) {
      itemsBySection.get(item.sectionId)!.push(item)
    }
  }
  for (const list of itemsBySection.values()) {
    list.sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
  }

  // Build the tree. We iterate orderedSections in reading order so
  // children land in the right sibling order under each parent. Any
  // section whose parentSectionId points at a missing row gets
  // treated as a root — defensive against partial cascades, mirrors
  // the server's `buildSectionTree` repo helper.
  const nodeById = new Map<string, RenderNode>()
  for (const s of orderedSections) {
    nodeById.set(s.id, { section: s, items: itemsBySection.get(s.id) ?? [], children: [] })
  }
  const roots: RenderNode[] = []
  for (const s of orderedSections) {
    const node = nodeById.get(s.id)!
    const parent = s.parentSectionId ? nodeById.get(s.parentSectionId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const unassigned = items
    .filter(i => !i.sectionId || !sectionIds.has(i.sectionId))
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))

  return { roots, unassigned }
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

/**
 * Coerce a section's level to a usable 1-based integer. Legacy rows
 * backfilled by migration 030 always have level=1, but tests and
 * fixtures sometimes synthesise sections through `as ManuscriptSection`
 * casts that omit the field; treating those as level 1 preserves the
 * pre-Phase-6 heading depth and keeps the export byte-identical.
 */
function safeLevel(level: number | undefined | null): number {
  if (typeof level === 'number' && Number.isFinite(level) && level >= 1) return level
  return 1
}

/**
 * Markdown heading prefix for a section at the given 1-based level.
 * Phase 6 of the Configurable Spine Depth Refactor: level → '#'
 * count, anchored at `##` for level 1 so depth-1 manuscripts (which
 * are byte-identical to the pre-Phase-6 export) keep getting `##`
 * section headings and the existing test fixtures pass unchanged.
 *
 *   level 1 → '##'
 *   level 2 → '###'
 *   level 3 → '####'
 *   level 4 → '#####'   (max — MAX_SPINE_DEPTH from the migration)
 */
function sectionHashes(level: number | undefined | null): string {
  return '#'.repeat(safeLevel(level) + 1)
}

/** Heading prefix for an item under a section at the given level. */
function itemHashes(sectionLevel: number | undefined | null): string {
  return '#'.repeat(safeLevel(sectionLevel) + 2)
}

function renderToc(roots: RenderNode[], unassigned: ExportItem[]): string {
  const lines: string[] = ['', '## Contents', '']

  // Recursive TOC walker. Indents 2 spaces per tree level so the
  // markdown renderer nests the bulleted list. Items always appear
  // at one indent deeper than their container — matching the
  // depth-1 output exactly when every section is a level-1 leaf.
  const walk = (node: RenderNode, indentLevel: number): void => {
    const indent = '  '.repeat(indentLevel)
    lines.push(`${indent}- [${node.section.title}](#${slugForAnchor(node.section.title)})`)
    // Children at this section's tree depth become next indent.
    for (const child of node.children) walk(child, indentLevel + 1)
    // Items only attach to leaves; render them at child indent so the
    // bullet hierarchy reads as "section → item" regardless of depth.
    for (const item of node.items) {
      const itemIndent = '  '.repeat(indentLevel + 1)
      lines.push(`${itemIndent}- [${item.title}](#${slugForAnchor(item.title)})`)
    }
  }
  for (const root of roots) walk(root, 0)

  if (unassigned.length > 0) {
    lines.push('- [Unassigned](#unassigned)')
    for (const item of unassigned) {
      lines.push(`  - [${item.title}](#${slugForAnchor(item.title)})`)
    }
  }

  return lines.join('\n')
}

function renderSectionHeading(section: ManuscriptSection): string {
  const hashes = sectionHashes(section.level)
  const purposeNote = section.purpose && section.purpose !== 'unassigned'
    ? ` — *${PURPOSE_LABELS[section.purpose] ?? section.purpose}*`
    : ''
  const lines = ['', `${hashes} ${section.title}${purposeNote}`]
  if (section.notes) {
    lines.push('', `> ${section.notes.replace(/\n/g, '\n> ')}`)
  }
  return lines.join('\n')
}

function renderUnassignedHeading(): string {
  return [
    '',
    '## Unassigned',
    '',
    '*Items not yet placed in a section.*',
  ].join('\n')
}

/**
 * @param itemHashesPrefix Heading prefix for the item title. Computed
 *   from the containing section's level so depth-1 stays `###`.
 */
function renderItem(
  item: ExportItem,
  opts: Required<MarkdownExportOptions>,
  ordinal: number | null,
  itemHashesPrefix: string,
): string {
  const numberPrefix = ordinal !== null ? `${ordinal}. ` : ''
  const lines: string[] = []
  lines.push('')
  lines.push(`${itemHashesPrefix} ${numberPrefix}${item.title}`)

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
 * The whole export: front matter + optional TOC + tree-walked sections
 * in order.
 *
 * Phase 6 of the Configurable Spine Depth Refactor: depth-aware. The
 * section heading level scales with `section.level` so a memoir at
 * depth=2 reads as `## Part One` → `### Chapter` → `#### Essay`. At
 * depth=1 (today's default for every existing manuscript) every
 * section is at level 1 and the output is byte-identical to the
 * pre-Phase-6 export — the existing test fixtures in
 * manuscript-export.test.ts gate this.
 */
export function manuscriptToMarkdown(
  manuscript: ManuscriptProject,
  sections: ManuscriptSection[],
  items: ExportItem[],
  options: MarkdownExportOptions = {}
): string {
  const opts: Required<MarkdownExportOptions> = { ...DEFAULTS, ...options }

  const filtered = filterItems(items, opts)
  const { roots, unassigned } = buildRenderTree(sections, filtered)
  const hasContent = roots.length > 0 || unassigned.length > 0

  const parts: string[] = []
  if (opts.includeFrontMatter) {
    parts.push(renderFrontMatter(manuscript))
  } else {
    parts.push(`# ${manuscript.title}`)
  }
  if (opts.includeToc && hasContent) {
    parts.push(renderToc(roots, unassigned))
  }

  // DFS the tree. We track the numbering ordinal across the whole
  // traversal so essay numbering (`1.`, `2.`, …) stays in document
  // order regardless of how deep the manuscript nests. Items live at
  // each leaf section; non-leaf containers emit a heading only.
  let ordinal = 0
  const walk = (node: RenderNode): void => {
    parts.push(renderSectionHeading(node.section))
    const itemPrefix = itemHashes(node.section.level)
    for (const item of node.items) {
      const counted = opts.numberItems && item.itemType === 'essay'
      if (counted) ordinal += 1
      parts.push(renderItem(item, opts, counted ? ordinal : null, itemPrefix))
    }
    for (const child of node.children) walk(child)
  }
  for (const root of roots) walk(root)

  if (unassigned.length > 0) {
    parts.push(renderUnassignedHeading())
    // Unassigned items are loose — they have no container level, so
    // they sit at the same heading depth items would sit at under a
    // top-level section, matching the pre-Phase-6 `###` prefix.
    const unassignedItemPrefix = itemHashes(1)
    for (const item of unassigned) {
      const counted = opts.numberItems && item.itemType === 'essay'
      if (counted) ordinal += 1
      parts.push(renderItem(item, opts, counted ? ordinal : null, unassignedItemPrefix))
    }
  }

  // Single trailing newline is friendlier for downstream tooling than none.
  return parts.join('\n') + '\n'
}
