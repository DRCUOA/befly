/**
 * Manuscript briefing service.
 *
 * Assembles a one-way "state snapshot" envelope of a manuscript — literary
 * direction, spine, beats, characters, motifs, causal links, silences, and
 * recent AI artifacts — that another model (or a human reviewer) can use to
 * understand the latest state without ingesting every word.
 *
 * Composition is pure read-assembly: every layer is fetched through the
 * existing repos which already enforce visibility and ownership. No new
 * SQL, no new tables.
 *
 * Two output renderers live here:
 *   - buildManuscriptBriefing(...)  : the canonical structured envelope.
 *   - briefingToMarkdown(envelope)  : a human-readable rendering of the same
 *                                     envelope. Cheap because it's pure over
 *                                     the envelope.
 *
 * Both are exported so the controller can serve either format from the same
 * one-shot fetch.
 */

import { pool } from '../config/db.js'
import { manuscriptRepo } from '../repositories/manuscript.repo.js'
import { storyCraftRepo } from '../repositories/storycraft.repo.js'
import { manuscriptArtifactRepo } from '../repositories/manuscript-artifact.repo.js'
import {
  MANUSCRIPT_BRIEFING_VERSION,
  type ManuscriptBriefingEnvelope,
  type ProseLevel,
  type BriefingProject,
  type BriefingTheme,
  type BriefingSection,
  type BriefingItem,
  type BriefingCharacter,
  type BriefingMotif,
  type BriefingBeat,
  type BriefingCausalLink,
  type BriefingSilence,
  type BriefingArtifact,
  type BriefingCounts,
  type BriefingFreshness,
} from '../models/ManuscriptBriefing.js'
import type { ManuscriptItemType } from '../models/Manuscript.js'

export interface BuildBriefingOptions {
  proseLevel?: ProseLevel
  /** Cap on how many of the most recent artifacts to include. Default 10. */
  artifactLimit?: number
}

const DEFAULT_OPTIONS: Required<BuildBriefingOptions> = {
  proseLevel: 'digest',
  artifactLimit: 10,
}

/* ----- Small helpers ----- */

/** Best-effort word count on a markdown body. Cheap and good enough for a glance metric. */
function wordCount(body: string | null | undefined): number {
  if (!body) return 0
  // Split on whitespace; ignore empty tokens. Markdown punctuation/syntax
  // tokens count as "words" here, which is fine for an order-of-magnitude
  // figure (10 vs 5,000) and avoids pulling in a markdown parser.
  return body.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Pull the first and last sentence out of a markdown body for the digest
 * prose mode. We deliberately keep this naive: split on sentence terminators,
 * trim, and pick the ends. If the body is one short paragraph the first and
 * last sentence may be the same — we de-duplicate.
 *
 * Strips markdown heading hashes from the leading sentence so a body that
 * starts with "# Title\n\nFirst sentence." doesn't return the title.
 */
function digestProse(body: string | null | undefined): string | null {
  if (!body) return null
  const trimmed = body.trim()
  if (!trimmed) return null

  // Drop a leading markdown H1 line if present, plus any blank lines after.
  const noTitle = trimmed.replace(/^#{1,6}\s.*\n+/, '').trim()
  if (!noTitle) return null

  // Sentence-ish split on . ? ! followed by whitespace or end. Imperfect for
  // "Mr. Smith" type inputs but fine for first/last extraction.
  const sentences = noTitle
    .split(/(?<=[.?!])\s+/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 0)

  if (sentences.length === 0) return null
  if (sentences.length === 1) return sentences[0]

  const first = sentences[0]
  const last = sentences[sentences.length - 1]
  if (first === last) return first
  return `${first} […] ${last}`
}

/**
 * Latest ISO timestamp across a list of rows. Returns null when the list is
 * empty. Defensive about pg's behaviour of returning timestamps as Date
 * objects despite the TS types saying string — we coerce to ISO either way
 * so consumers always see a string.
 */
function toIso(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  return null
}

function maxUpdatedAt(
  rows: { updatedAt?: string | Date | null; createdAt?: string | Date | null }[]
): string | null {
  let best: string | null = null
  for (const r of rows) {
    const t = toIso(r.updatedAt) ?? toIso(r.createdAt)
    if (!t) continue
    if (best === null || t > best) best = t
  }
  return best
}

/* ----- The builder ----- */

export async function buildManuscriptBriefing(
  manuscriptId: string,
  userId: string | null,
  isAdmin: boolean = false,
  options: BuildBriefingOptions = {}
): Promise<ManuscriptBriefingEnvelope> {
  const opts: Required<BuildBriefingOptions> = { ...DEFAULT_OPTIONS, ...options }

  // 1) Project (this enforces read access; if the caller can't see the
  //    manuscript, this throws and the request 404s).
  const project = await manuscriptRepo.findById(manuscriptId, userId, isAdmin)

  // 2) Pull every other layer in parallel. Each repo enforces the same
  //    visibility rules; calling them after the findById check is purely a
  //    convenience (saves us re-asserting in this layer).
  const [
    sectionsRaw,
    itemsWithBodies,
    storyCraft,
    artifacts,
    themesResult,
  ] = await Promise.all([
    manuscriptRepo.listSections(manuscriptId, userId, isAdmin),
    manuscriptRepo.listItemsWithBodies(manuscriptId, userId, isAdmin),
    storyCraftRepo.getBundle(manuscriptId, userId, isAdmin),
    manuscriptArtifactRepo.list(manuscriptId, userId, isAdmin),
    project.sourceThemeIds.length > 0
      ? pool.query(
          `SELECT id, name, slug FROM themes WHERE id = ANY($1::uuid[]) ORDER BY name ASC`,
          [project.sourceThemeIds]
        )
      : Promise.resolve({ rows: [] as { id: string; name: string; slug: string }[] }),
  ])

  // 3) Spine: sections (with their item-id lists) and items (with prose
  //    materialised at the requested level).
  const itemIdsBySection = new Map<string, string[]>()
  for (const s of sectionsRaw) itemIdsBySection.set(s.id, [])
  for (const item of itemsWithBodies) {
    if (item.sectionId && itemIdsBySection.has(item.sectionId)) {
      itemIdsBySection.get(item.sectionId)!.push(item.id)
    }
  }

  const sections: BriefingSection[] = sectionsRaw.map(s => ({
    id: s.id,
    title: s.title,
    orderIndex: s.orderIndex,
    purpose: s.purpose,
    notes: s.notes ?? null,
    itemIds: itemIdsBySection.get(s.id) ?? [],
  }))

  const items: BriefingItem[] = itemsWithBodies.map(item => {
    let prose: string | null = null
    if (opts.proseLevel === 'full') {
      prose = item.body && item.body.trim() ? item.body : null
    } else if (opts.proseLevel === 'digest') {
      prose = digestProse(item.body)
    }
    return {
      id: item.id,
      sectionId: item.sectionId ?? null,
      writingBlockId: item.writingBlockId ?? null,
      itemType: item.itemType,
      title: item.title,
      orderIndex: item.orderIndex,
      structuralRole: item.structuralRole ?? null,
      summary: item.summary ?? null,
      wordCount: item.body !== null ? wordCount(item.body) : null,
      prose,
    }
  })

  // 4) Themes (just id/name/slug — visibility doesn't matter here, the user
  //    already has read access on the parent manuscript).
  const themes: BriefingTheme[] = themesResult.rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }))

  // 5) StoryCraft layers.

  // Misreadings keyed by character so each character carries its own list.
  const misreadingsByCharacter = new Map<string, { label: string; why: string | null }[]>()
  for (const m of storyCraft.misreadings) {
    const list = misreadingsByCharacter.get(m.characterId) ?? []
    list.push({ label: m.label, why: m.why ?? null })
    misreadingsByCharacter.set(m.characterId, list)
  }

  const characters: BriefingCharacter[] = storyCraft.characters.map(c => ({
    id: c.id,
    name: c.name,
    fullName: c.fullName ?? null,
    role: c.role ?? null,
    socialPosition: c.socialPosition ?? null,
    contradiction: c.contradiction ?? null,
    publicWant: c.publicWant ?? null,
    privateWant: c.privateWant ?? null,
    hiddenNeed: c.hiddenNeed ?? null,
    greatestFear: c.greatestFear ?? null,
    falseBelief: c.falseBelief ?? null,
    wound: c.wound ?? null,
    voice: c.voice ?? {},
    arcPhases: c.arcPhases ?? [],
    plotFunctions: c.plotFunctions ?? [],
    misreadings: misreadingsByCharacter.get(c.id) ?? [],
  }))

  // Motif voice variants keyed by motif id.
  const variantsByMotif = new Map<string, { characterId: string; meaning: string }[]>()
  for (const v of storyCraft.motifVariants) {
    if (!v.meaning) continue // skip empty meanings — nothing for a model to learn from
    const list = variantsByMotif.get(v.motifId) ?? []
    list.push({ characterId: v.characterId, meaning: v.meaning })
    variantsByMotif.set(v.motifId, list)
  }

  const motifs: BriefingMotif[] = storyCraft.motifs.map(m => ({
    id: m.id,
    name: m.name,
    function: m.function ?? null,
    voiceVariants: variantsByMotif.get(m.id) ?? [],
  }))

  // Beat knowledge and beat motifs grouped by beat id.
  const knowledgeByBeat = new Map<string, BriefingBeat['knowledge']>()
  for (const k of storyCraft.beatKnowledge) {
    const list = knowledgeByBeat.get(k.beatId) ?? []
    list.push({
      characterId: k.characterId,
      knowledgeKind: k.knowledgeKind,
      text: k.text,
    })
    knowledgeByBeat.set(k.beatId, list)
  }
  const motifsByBeat = new Map<string, BriefingBeat['motifs']>()
  for (const bm of storyCraft.beatMotifs) {
    const list = motifsByBeat.get(bm.beatId) ?? []
    list.push({ motifId: bm.motifId, variantNote: bm.variantNote ?? null })
    motifsByBeat.set(bm.beatId, list)
  }

  const beats: BriefingBeat[] = storyCraft.beats.map(b => ({
    id: b.id,
    itemId: b.itemId ?? null,
    povCharacterId: b.povCharacterId ?? null,
    orderIndex: b.orderIndex,
    label: b.label ?? null,
    title: b.title ?? null,
    timelinePoint: b.timelinePoint ?? null,
    movement: b.movement ?? null,
    outerEvent: b.outerEvent ?? null,
    innerTurn: b.innerTurn ?? null,
    voiceConstraint: b.voiceConstraint ?? null,
    finalImage: b.finalImage ?? null,
    sceneFunctionType: b.sceneFunctionType ?? null,
    withholdingLevel: b.withholdingLevel ?? null,
    uniquePerception: b.uniquePerception ?? null,
    blindSpot: b.blindSpot ?? null,
    misreading: b.misreading ?? null,
    readerInference: b.readerInference ?? null,
    reasonForNextPovSwitch: b.reasonForNextPovSwitch ?? null,
    knowledge: knowledgeByBeat.get(b.id) ?? [],
    motifs: motifsByBeat.get(b.id) ?? [],
  }))

  const causalLinks: BriefingCausalLink[] = storyCraft.causalLinks.map(l => ({
    id: l.id,
    fromBeatId: l.fromBeatId,
    toBeatId: l.toBeatId,
    linkType: l.linkType,
    note: l.note ?? null,
  }))

  const silences: BriefingSilence[] = storyCraft.silences.map(s => ({
    id: s.id,
    characterId: s.characterId ?? null,
    beatId: s.beatId ?? null,
    whatUnsaid: s.whatUnsaid,
    why: s.why ?? null,
    consequence: s.consequence ?? null,
    silenceType: s.silenceType ?? null,
  }))

  // 6) Recent artifacts. The repo orders by created_at DESC already; cap to
  //    the configured limit so the envelope doesn't grow unboundedly.
  const recentArtifacts: BriefingArtifact[] = (
    opts.artifactLimit > 0
      ? artifacts.slice(0, opts.artifactLimit)
      : []
  ).map(a => ({
    id: a.id,
    type: a.type,
    title: a.title,
    status: a.status,
    content: (a.content ?? {}) as Record<string, unknown>,
    fromItemId: a.fromItemId ?? null,
    toItemId: a.toItemId ?? null,
    sourceModel: a.sourceModel ?? null,
    createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date(a.createdAt).toISOString(),
  }))

  // 7) Counts and freshness — cheap glance metrics.
  const itemsByType: Record<ManuscriptItemType, number> = {
    essay: 0, bridge: 0, placeholder: 0, note: 0, fragment: 0,
  }
  let totalWordCount = 0
  for (const item of items) {
    itemsByType[item.itemType] = (itemsByType[item.itemType] ?? 0) + 1
    if (item.wordCount) totalWordCount += item.wordCount
  }

  const counts: BriefingCounts = {
    sections: sections.length,
    items: items.length,
    itemsByType,
    characters: characters.length,
    beats: beats.length,
    motifs: motifs.length,
    causalLinks: causalLinks.length,
    silences: silences.length,
    artifacts: artifacts.length, // total in DB, not the truncated recent list
    totalWordCount,
  }

  const freshness: BriefingFreshness = {
    project: toIso(project.updatedAt) ?? toIso(project.createdAt) ?? new Date().toISOString(),
    spine: maxUpdatedAt([...sectionsRaw, ...itemsWithBodies]),
    beats: maxUpdatedAt(storyCraft.beats),
    characters: maxUpdatedAt(storyCraft.characters),
    motifs: maxUpdatedAt(storyCraft.motifs),
    causalLinks: maxUpdatedAt(storyCraft.causalLinks),
    silences: maxUpdatedAt(storyCraft.silences),
    artifacts: maxUpdatedAt(artifacts),
  }

  // 8) Project subset.
  const projectOut: BriefingProject = {
    id: project.id,
    title: project.title,
    workingSubtitle: project.workingSubtitle ?? null,
    form: project.form,
    status: project.status,
    visibility: project.visibility,
    intendedReader: project.intendedReader ?? null,
    centralQuestion: project.centralQuestion ?? null,
    throughLine: project.throughLine ?? null,
    emotionalArc: project.emotionalArc ?? null,
    narrativePromise: project.narrativePromise ?? null,
    sourceThemeIds: project.sourceThemeIds,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }

  // 9) Self-describing readme. Lives as a key (JSON has no comments) so the
  //    very first thing a model sees explains the rest of the envelope.
  const documentation: Record<string, string> = {
    purpose:
      'A one-way "state snapshot" of this manuscript intended for AI ' +
      'consumption or fast human review. NOT a round-trip backup — re-importing ' +
      'this file is not supported. For backups, use /api/manuscripts/:id/export ' +
      'or the admin essay-export tool.',
    proseLevel:
      `Set to "${opts.proseLevel}". "none" omits all prose, "digest" gives ` +
      'first/last sentence per essay-backed item, "full" includes whole bodies. ' +
      'Default is "digest".',
    spine:
      'sections[] are ordered by orderIndex. Each section.itemIds lists items ' +
      'in that section in order. items[] is the flat list of all items; an item ' +
      'with sectionId = null is unassigned. items[].prose may be null when no ' +
      'writing block is linked or when proseLevel = "none".',
    plot:
      'beats[] are the planning unit (one scene). Each beat carries outerEvent, ' +
      'innerTurn, sceneFunctionType, withholdingLevel, plus a knowledge ledger ' +
      '(knowledge[]) and any motifs touched. A knowledge entry with characterId ' +
      'null is the "reader" row — what the reader knows at this beat (the ' +
      'dramatic-irony spine).',
    causality:
      'causalLinks[] is a flat edge list referencing beat ids. linkType values ' +
      '(because, therefore, but_because, until, reversal, recognition, ' +
      'crisis_choice, climax, plant, payoff, and_then) describe how one beat ' +
      'leads to another.',
    characters:
      'characters[] include the voice bible (sentenceLength, rhythm, ' +
      'preferredWords, etc.), wants, fears, false beliefs, wounds, and arc ' +
      'phases. The writer\'s scratch-pad notes field is deliberately omitted.',
    silences:
      'silences[] capture what is deliberately left unsaid. A silence with ' +
      'beatId null is a structural pattern, not local to one beat.',
    recentArtifacts:
      'recentArtifacts[] is the last N AI-generated artifacts (gap analyses, ' +
      'spine suggestions, etc.) so a downstream model knows what has already ' +
      'been considered. Capped at artifactLimit (default 10). counts.artifacts ' +
      'is the un-truncated total.',
    sensitivity:
      'This briefing carries the writer\'s deepest planning — voice bible, ' +
      'hidden needs, false beliefs, silences. Treat with the same care as ' +
      'unpublished prose. Visibility on the parent manuscript was enforced at ' +
      'export time; do not re-share without the writer\'s explicit consent.',
    freshness:
      'freshness.* is the most recent updatedAt (or createdAt) across each ' +
      'layer. Use to judge what is recent vs. stale.',
  }

  const scopeLabel = `Briefing for "${project.title}" (${project.status}, ${counts.items} items, ${counts.beats} beats)`

  return {
    version: MANUSCRIPT_BRIEFING_VERSION,
    type: 'manuscript_briefing',
    exportedAt: new Date().toISOString(),
    proseLevel: opts.proseLevel,
    scopeLabel,
    _documentation: documentation,
    project: projectOut,
    themes,
    sections,
    items,
    characters,
    motifs,
    beats,
    causalLinks,
    silences,
    recentArtifacts,
    counts,
    freshness,
  }
}

/* ----- JSON output helper ----- */

/**
 * Pretty-printed JSON. Two-space indent so a human can scan the file in any
 * editor without reformatting. Mirrors envelopeToJson() in essay-export.
 */
export function briefingToJson(envelope: ManuscriptBriefingEnvelope): string {
  return JSON.stringify(envelope, null, 2) + '\n'
}

/* ----- Markdown renderer ----- */

/**
 * Placeholder for a blank string field in the Markdown output. Rendered in
 * italics so the absence of content is visible to a downstream reader —
 * silence is information, not noise.
 */
const BLANK = '_(blank)_'

/** Returns the value if it is a non-empty string, otherwise the BLANK marker. */
function or(v: string | null | undefined): string {
  return v && v.trim() ? v : BLANK
}

const SCENE_FUNCTION_LABELS: Record<string, string> = {
  establishing_voice: 'Establishing voice',
  counterpoint: 'Counterpoint',
  correction: 'Correction',
  echo: 'Echo',
  withholding: 'Withholding',
  fragment: 'Fragment',
  reframing: 'Reframing',
  stretto: 'Stretto',
  other: 'Other',
}

const CAUSAL_LINK_LABELS: Record<string, string> = {
  because: 'because',
  therefore: 'therefore',
  but_because: 'but because',
  until: 'until',
  reversal: 'reversal',
  recognition: 'recognition',
  crisis_choice: 'crisis choice',
  climax: 'climax',
  plant: 'plant',
  payoff: 'payoff',
  and_then: 'and then',
}

/**
 * Produce a Markdown rendering of an envelope. Cheap because it's a pure
 * walk over already-assembled data. The rendering is structured for human
 * skim: headings, ordered beat list, a causal-link prose section, and a
 * trimmed character + motif index.
 */
export function briefingToMarkdown(env: ManuscriptBriefingEnvelope): string {
  const lines: string[] = []
  const m = env.project

  /* Header */
  lines.push(`# Briefing — ${m.title}`)
  if (m.workingSubtitle) lines.push('', `*${m.workingSubtitle}*`)
  lines.push('')
  lines.push(`*${m.form.replace(/_/g, ' ')} · ${m.status} · ${env.proseLevel} prose · exported ${env.exportedAt}*`)

  /* Counts at a glance */
  const c = env.counts
  lines.push('')
  lines.push(
    `_${c.sections} section(s), ${c.items} item(s), ${c.beats} beat(s), ${c.characters} character(s), ` +
    `${c.causalLinks} causal link(s), ${c.silences} silence(s), ${c.artifacts} AI artifact(s), ` +
    `~${c.totalWordCount.toLocaleString()} words._`
  )

  /* Literary direction */
  const direction: { label: string; value: string }[] = []
  if (m.centralQuestion) direction.push({ label: 'Central question', value: m.centralQuestion })
  if (m.throughLine) direction.push({ label: 'Through-line', value: m.throughLine })
  if (m.emotionalArc) direction.push({ label: 'Emotional arc', value: m.emotionalArc })
  if (m.narrativePromise) direction.push({ label: 'Narrative promise', value: m.narrativePromise })
  if (m.intendedReader) direction.push({ label: 'Intended reader', value: m.intendedReader })

  if (direction.length > 0) {
    lines.push('', '## Literary direction', '')
    for (const d of direction) {
      lines.push(`**${d.label}.** ${d.value}`)
      lines.push('')
    }
  }

  /* Themes */
  if (env.themes.length > 0) {
    lines.push('## Themes', '')
    lines.push(env.themes.map(t => `- ${t.name}`).join('\n'))
    lines.push('')
  }

  /* Spine */
  lines.push('## Spine', '')
  if (env.sections.length === 0 && env.items.length === 0) {
    lines.push('_No sections or items yet._', '')
  } else {
    const itemsById = new Map(env.items.map(i => [i.id, i]))
    const orderedSections = [...env.sections].sort((a, b) => a.orderIndex - b.orderIndex)
    for (const s of orderedSections) {
      lines.push(`### ${s.title || 'Untitled section'}`)
      if (s.purpose && s.purpose !== 'unassigned') lines.push(`*${s.purpose.replace(/_/g, ' ')}*`)
      lines.push('')
      const sectionItems = s.itemIds
        .map(id => itemsById.get(id))
        .filter((i): i is BriefingItem => Boolean(i))
        .sort((a, b) => a.orderIndex - b.orderIndex)
      if (sectionItems.length === 0) {
        lines.push('_(empty)_', '')
      } else {
        for (const i of sectionItems) lines.push(...renderItemMd(i))
      }
    }
    const unassigned = env.items
      .filter(i => !i.sectionId || !env.sections.some(s => s.id === i.sectionId))
      .sort((a, b) => a.orderIndex - b.orderIndex)
    if (unassigned.length > 0) {
      lines.push('### Unassigned', '')
      for (const i of unassigned) lines.push(...renderItemMd(i))
    }
  }

  /* Beats — every field on each beat is rendered, blank or not. A missing
     value is information for a downstream model: it signals which beats are
     fully developed and which are stubs. */
  if (env.beats.length > 0) {
    lines.push('## Beats', '')
    const charNameById = new Map(env.characters.map(c => [c.id, c.name]))
    const motifNameById = new Map(env.motifs.map(m => [m.id, m.name]))
    for (const b of [...env.beats].sort((a, b) => a.orderIndex - b.orderIndex)) {
      const head = [b.label, b.title].filter(Boolean).join(' · ') || `Beat ${b.orderIndex + 1}`
      lines.push(`### ${head}`)
      lines.push('')

      // Identification + structural metadata
      lines.push(`**ID.** ${b.id}`)
      lines.push(`**Order index.** ${b.orderIndex}`)
      lines.push(`**Item ID.** ${b.itemId ?? BLANK}`)
      lines.push(`**Label.** ${or(b.label)}`)
      lines.push(`**Title.** ${or(b.title)}`)

      // Setting
      lines.push(`**POV character.** ${
        b.povCharacterId ? (charNameById.get(b.povCharacterId) ?? b.povCharacterId) : BLANK
      }`)
      lines.push(`**Timeline point.** ${or(b.timelinePoint)}`)
      lines.push(`**Movement.** ${or(b.movement)}`)
      lines.push(`**Scene function.** ${
        b.sceneFunctionType ? (SCENE_FUNCTION_LABELS[b.sceneFunctionType] ?? b.sceneFunctionType) : BLANK
      }`)
      lines.push(`**Withholding level.** ${b.withholdingLevel ?? BLANK}`)

      // Narrative content
      lines.push(`**Outer event.** ${or(b.outerEvent)}`)
      lines.push(`**Inner turn.** ${or(b.innerTurn)}`)
      lines.push(`**Voice constraint.** ${or(b.voiceConstraint)}`)
      lines.push(`**Final image.** ${or(b.finalImage)}`)

      // POV-perception fields
      lines.push(`**Unique perception.** ${or(b.uniquePerception)}`)
      lines.push(`**Blind spot.** ${or(b.blindSpot)}`)
      lines.push(`**Misreading.** ${or(b.misreading)}`)
      lines.push(`**Reader inference.** ${or(b.readerInference)}`)
      lines.push(`**Reason for next POV switch.** ${or(b.reasonForNextPovSwitch)}`)
      lines.push('')

      // Knowledge ledger — always shown.
      lines.push('**Knowledge ledger.**')
      if (b.knowledge.length === 0) {
        lines.push(`- ${BLANK}`)
      } else {
        for (const k of b.knowledge) {
          const who = k.characterId ? (charNameById.get(k.characterId) ?? k.characterId) : 'Reader'
          lines.push(`- _${who} (${k.knowledgeKind})_: ${k.text}`)
        }
      }
      lines.push('')

      // Motifs touched — always shown.
      lines.push('**Motifs touched.**')
      if (b.motifs.length === 0) {
        lines.push(`- ${BLANK}`)
      } else {
        for (const bm of b.motifs) {
          const name = motifNameById.get(bm.motifId) ?? bm.motifId
          lines.push(`- ${name}${bm.variantNote ? ` — ${bm.variantNote}` : ''}`)
        }
      }
      lines.push('')
    }
  }

  /* Causal links — rendered as readable prose */
  if (env.causalLinks.length > 0) {
    lines.push('## Causality', '')
    const beatLabel = new Map<string, string>()
    for (const b of env.beats) {
      beatLabel.set(b.id, b.title || b.label || `Beat ${b.orderIndex + 1}`)
    }
    for (const link of env.causalLinks) {
      const from = beatLabel.get(link.fromBeatId) ?? link.fromBeatId
      const to = beatLabel.get(link.toBeatId) ?? link.toBeatId
      const verb = CAUSAL_LINK_LABELS[link.linkType] ?? link.linkType
      const note = link.note ? ` — ${link.note}` : ''
      lines.push(`- ${from} **${verb}** ${to}${note}`)
    }
    lines.push('')
  }

  /* Characters */
  if (env.characters.length > 0) {
    lines.push('## Characters', '')
    for (const ch of env.characters) {
      lines.push(`### ${ch.name}${ch.role ? ` — ${ch.role}` : ''}`)
      const fields: { label: string; value: string | null }[] = [
        { label: 'Contradiction', value: ch.contradiction },
        { label: 'Public want', value: ch.publicWant },
        { label: 'Private want', value: ch.privateWant },
        { label: 'Hidden need', value: ch.hiddenNeed },
        { label: 'Greatest fear', value: ch.greatestFear },
        { label: 'False belief', value: ch.falseBelief },
        { label: 'Wound', value: ch.wound },
      ]
      const populated = fields.filter(f => f.value)
      if (populated.length > 0) {
        for (const f of populated) lines.push(`- **${f.label}.** ${f.value}`)
      }
      if (ch.arcPhases.length > 0) lines.push(`- **Arc phases.** ${ch.arcPhases.join(' → ')}`)
      if (ch.misreadings.length > 0) {
        lines.push('- **Misreadings.**')
        for (const mr of ch.misreadings) lines.push(`  - ${mr.label}${mr.why ? ` — ${mr.why}` : ''}`)
      }
      lines.push('')
    }
  }

  /* Motifs */
  if (env.motifs.length > 0) {
    lines.push('## Motifs', '')
    for (const mo of env.motifs) {
      lines.push(`- **${mo.name}**${mo.function ? ` — ${mo.function}` : ''}`)
    }
    lines.push('')
  }

  /* Silences */
  if (env.silences.length > 0) {
    lines.push('## Silences', '')
    for (const s of env.silences) {
      const tag = s.silenceType ? `_${s.silenceType}_ — ` : ''
      lines.push(`- ${tag}${s.whatUnsaid}${s.why ? ` _(${s.why})_` : ''}`)
    }
    lines.push('')
  }

  /* Recent artifacts */
  if (env.recentArtifacts.length > 0) {
    lines.push('## Recent AI artifacts', '')
    for (const a of env.recentArtifacts) {
      lines.push(`- **${a.title}** _(${a.type}, ${a.status}, ${a.createdAt.slice(0, 10)})_`)
    }
    lines.push('')
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function renderItemMd(item: BriefingItem): string[] {
  const lines: string[] = []
  const meta: string[] = [item.itemType]
  if (item.structuralRole) meta.push(item.structuralRole.replace(/_/g, ' '))
  if (item.wordCount !== null && item.wordCount > 0) meta.push(`${item.wordCount.toLocaleString()} words`)
  lines.push(`#### ${item.title || 'Untitled'}`)
  lines.push(`*${meta.join(' · ')}*`)
  if (item.summary) lines.push('', `> ${item.summary.replace(/\n/g, '\n> ')}`)
  if (item.prose) {
    lines.push('', item.prose)
  }
  lines.push('')
  return lines
}

/** Best-effort filename for the Content-Disposition header. */
export function suggestBriefingFilename(
  manuscriptTitle: string,
  ext: 'json' | 'md'
): string {
  const slug = manuscriptTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'manuscript'
  return `${slug}-briefing.${ext}`
}
