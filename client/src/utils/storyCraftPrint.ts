// Print helpers for the story-craft views (Character Studio, Polyphonic Map,
// Plot Causality). All paths reuse the book-wizard typography via
// `buildNaturalPrintHtml({ includeCovers: false })` so the printed output
// looks the same as the essay print — no covers, no front/back matter,
// just the artifact rendered as chapter-style sections.

import type {
  Beat,
  BeatKnowledge,
  CausalLink,
  Character,
  CharacterMisreading,
  KnowledgeKind,
} from '@shared/StoryCraft'
import { KNOWLEDGE_KINDS } from '@shared/StoryCraft'
import { buildNaturalPrintHtml, openPrintWindow } from '../components/manuscripts/bookPreview/print'
import { defaultPaperbackProfile } from '../components/manuscripts/bookPreview/defaults'

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraphs(text: string | null | undefined): string {
  const s = (text || '').trim()
  if (!s) return ''
  return s
    .split(/\r?\n\r?\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escHtml(p).replace(/\r?\n/g, '<br />')}</p>`)
    .join('')
}

// One labelled paragraph. Labels read as "Field: value." — text-indent: 0 so
// the inline label sits flush left rather than indenting like prose.
function field(label: string, value: string | null | undefined): string {
  const v = (value || '').trim()
  if (!v) return ''
  return `<p style="text-indent: 0;"><strong>${escHtml(label)}:</strong> ${escHtml(v)}</p>`
}

function fieldList(label: string, items: string[] | undefined | null): string {
  const cleaned = (items || []).map(i => (i || '').trim()).filter(Boolean)
  if (!cleaned.length) return ''
  const lis = cleaned.map(i => `<li>${escHtml(i)}</li>`).join('')
  return `<p style="text-indent: 0;"><strong>${escHtml(label)}:</strong></p><ul>${lis}</ul>`
}

function chapterOpening(heading: string, label?: string): string {
  const eyebrow = label ? `<div class="bp-chapter-eyebrow">${escHtml(label)}</div>` : ''
  return `<section class="bp-chapter bp-chapter-opening bp-page-break-before">
    ${eyebrow}
    <div class="bp-chapter-heading">${escHtml(heading)}</div>
  </section>`
}

function itemOpen(opening = true): string {
  return `<div class="bp-item${opening ? ' bp-item-opening' : ''}" style="text-align: left;">`
}

function buildCharacterFlow(character: Character, misreadings: CharacterMisreading[]): string {
  const c = character
  const v = c.voice || {}
  const cMisreadings = misreadings
    .filter(m => m.characterId === c.id)
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const identity = [
    field('Full name', c.fullName),
    field('Role', c.role),
    field('Social position', c.socialPosition),
    field('Contradiction', c.contradiction),
    field('Public want', c.publicWant),
    field('Private want', c.privateWant),
    field('Hidden need', c.hiddenNeed),
    field('Greatest fear', c.greatestFear),
    field('False belief', c.falseBelief),
    field('Wound', c.wound),
  ].filter(Boolean).join('')

  const voice = [
    field('Sentence length', v.sentenceLength),
    field('Rhythm', v.rhythm),
    field('Punctuation habits', v.punctuationHabits),
    fieldList('Preferred words', v.preferredWords),
    fieldList('Forbidden words', v.forbiddenWords),
    fieldList('Metaphor sources', v.metaphorSources),
    fieldList('What they notice', v.whatTheyNotice),
    fieldList('What they miss', v.whatTheyMiss),
    field('What they lie about', v.whatTheyLieAbout),
    field('What they selectively tell', v.whatTheySelectivelyTell),
    field('What they never say directly', v.whatTheyNeverSayDirectly),
    field('How emotion leaks', v.howEmotionLeaks),
    field('How pressure changes the voice', v.howPressureChangesTheVoice),
    field('Attention pattern', v.attentionPattern),
    field('Avoidance pattern', v.avoidancePattern),
    field('Sample sentence (neutral)', v.sampleSentenceNeutral),
    field('Sample sentence (under pressure)', v.sampleSentenceUnderPressure),
  ].filter(Boolean).join('')

  const arc = fieldList('Arc phases', c.arcPhases)
  const plot = fieldList('Plot functions', c.plotFunctions)
  const misreadingsBlock = cMisreadings.length
    ? `<p style="text-indent: 0;"><strong>Misreadings:</strong></p><ul>${cMisreadings.map(m => `<li>${escHtml(m.label)}${m.why ? ` — <em>${escHtml(m.why)}</em>` : ''}</li>`).join('')}</ul>`
    : ''
  const notes = c.notes ? `<p style="text-indent: 0;"><strong>Notes</strong></p>${paragraphs(c.notes)}` : ''

  const sections: string[] = []
  if (identity) sections.push(`<h3 class="bp-h3">Identity</h3>${identity}`)
  if (voice) sections.push(`<h3 class="bp-h3">Voice bible</h3>${voice}`)
  if (arc) sections.push(`<h3 class="bp-h3">Arc</h3>${arc}`)
  if (plot) sections.push(`<h3 class="bp-h3">Plot functions</h3>${plot}`)
  if (misreadingsBlock) sections.push(`<h3 class="bp-h3">Misreadings</h3>${misreadingsBlock}`)
  if (notes) sections.push(`<h3 class="bp-h3">Notes</h3>${notes}`)

  const body = sections.length
    ? sections.join('')
    : '<p><em>(No details captured yet.)</em></p>'

  return chapterOpening(c.name, c.role || undefined)
    + `${itemOpen()}${body}</div>`
}

function buildBeatFlow(
  beat: Beat,
  characters: Character[],
  knowledge: BeatKnowledge[],
  link?: CausalLink | null,
  prevBeat?: Beat | null,
): string {
  const b = beat
  const pov = characters.find(c => c.id === (b.povCharacterId || ''))
  const eyebrow = [b.label, pov?.name, b.timelinePoint].filter(Boolean).join(' · ')

  const linkRow = link && prevBeat
    ? `<p style="text-indent: 0; font-style: italic; color: #6a5f4d;">${escHtml(formatSnake(link.linkType))} (from "${escHtml(prevBeat.title || prevBeat.label || 'previous beat')}")${link.note ? ` — ${escHtml(link.note)}` : ''}</p>`
    : ''

  const meta = [
    field('Movement', b.movement),
    field('Scene function', b.sceneFunctionType ? formatSnake(b.sceneFunctionType) : null),
    field('Withholding level', b.withholdingLevel),
  ].filter(Boolean).join('')

  const events = [
    b.outerEvent ? `<p style="text-indent: 0;"><strong>Outer event:</strong></p>${paragraphs(b.outerEvent)}` : '',
    b.innerTurn ? `<p style="text-indent: 0;"><strong>Inner turn:</strong></p>${paragraphs(b.innerTurn)}` : '',
    b.voiceConstraint ? `<p style="text-indent: 0;"><strong>Voice constraint:</strong></p>${paragraphs(b.voiceConstraint)}` : '',
    b.finalImage ? `<p style="text-indent: 0;"><strong>Final image:</strong></p>${paragraphs(b.finalImage)}` : '',
  ].filter(Boolean).join('')

  const irony = [
    b.uniquePerception ? `<p style="text-indent: 0;"><strong>Unique perception:</strong></p>${paragraphs(b.uniquePerception)}` : '',
    b.blindSpot ? `<p style="text-indent: 0;"><strong>Blind spot:</strong></p>${paragraphs(b.blindSpot)}` : '',
    b.misreading ? `<p style="text-indent: 0;"><strong>Misreading:</strong></p>${paragraphs(b.misreading)}` : '',
    b.readerInference ? `<p style="text-indent: 0;"><strong>Reader inference:</strong></p>${paragraphs(b.readerInference)}` : '',
    b.reasonForNextPovSwitch ? `<p style="text-indent: 0;"><strong>Reason for next POV switch:</strong></p>${paragraphs(b.reasonForNextPovSwitch)}` : '',
  ].filter(Boolean).join('')

  const ledger = buildKnowledgeLedger(beat, characters, knowledge)

  const sections: string[] = []
  if (meta) sections.push(meta)
  if (events) sections.push(`<h3 class="bp-h3">Scene</h3>${events}`)
  if (irony) sections.push(`<h3 class="bp-h3">Voice & irony</h3>${irony}`)
  if (ledger) sections.push(`<h3 class="bp-h3">Knowledge ledger</h3>${ledger}`)

  const body = sections.length
    ? sections.join('')
    : '<p><em>(No details captured yet.)</em></p>'

  const heading = b.title || b.label || '(untitled beat)'
  return chapterOpening(heading, eyebrow || undefined)
    + `${itemOpen()}${linkRow}${body}</div>`
}

function buildKnowledgeLedger(
  beat: Beat,
  characters: Character[],
  knowledge: BeatKnowledge[],
): string {
  const beatKnow = knowledge.filter(k => k.beatId === beat.id)
  if (!beatKnow.length) return ''

  const rows: { label: string; characterId: string | null }[] = [
    { label: 'Reader', characterId: null },
    ...characters.map(c => ({ label: c.name, characterId: c.id })),
  ]
  const parts: string[] = []
  for (const row of rows) {
    const cells: string[] = []
    for (const kind of KNOWLEDGE_KINDS) {
      const entry = beatKnow.find(
        k => (k.characterId ?? null) === row.characterId && k.knowledgeKind === kind,
      )
      const text = entry?.text?.trim()
      if (text) cells.push(`<li><strong>${escHtml(formatKind(kind))}:</strong> ${escHtml(text)}</li>`)
    }
    if (cells.length) {
      parts.push(`<p style="text-indent: 0;"><strong>${escHtml(row.label)}</strong></p><ul>${cells.join('')}</ul>`)
    }
  }
  return parts.join('')
}

function formatSnake(s: string): string {
  return s.replace(/_/g, ' ')
}

function formatKind(kind: KnowledgeKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

function launch(
  bookFlowHtml: string,
  bookTitle: string,
  documentTitle: string,
): void {
  const cfg = defaultPaperbackProfile('')
  const html = buildNaturalPrintHtml({
    cfg,
    bookFlowHtml,
    bookTitle,
    authorName: '',
    documentTitle,
    layout: 'a5_single',
    includeCovers: false,
  })
  if (!openPrintWindow(html)) {
    alert('Could not open the print window. Please allow pop-ups for this site.')
  }
}

export function printCharacter(
  character: Character,
  misreadings: CharacterMisreading[],
  manuscriptTitle: string,
): void {
  const flow = buildCharacterFlow(character, misreadings)
  launch(flow, manuscriptTitle, `${manuscriptTitle} — ${character.name}`)
}

export function printAllCharacters(
  characters: Character[],
  misreadings: CharacterMisreading[],
  manuscriptTitle: string,
): void {
  const sorted = [...characters].sort((a, b) => a.orderIndex - b.orderIndex)
  const flow = sorted.map(c => buildCharacterFlow(c, misreadings)).join('')
  launch(flow, manuscriptTitle, `${manuscriptTitle} — Characters`)
}

export function printBeat(
  beat: Beat,
  characters: Character[],
  knowledge: BeatKnowledge[],
  manuscriptTitle: string,
): void {
  const flow = buildBeatFlow(beat, characters, knowledge)
  const heading = beat.title || beat.label || 'Beat'
  launch(flow, manuscriptTitle, `${manuscriptTitle} — ${heading}`)
}

export function printPolyphonicMap(
  characters: Character[],
  beats: Beat[],
  knowledge: BeatKnowledge[],
  manuscriptTitle: string,
): void {
  const sortedBeats = [...beats].sort((a, b) => a.orderIndex - b.orderIndex)
  const flow = sortedBeats.map(b => buildBeatFlow(b, characters, knowledge)).join('')
  launch(flow, manuscriptTitle, `${manuscriptTitle} — Polyphonic Map`)
}

export function printPlotCausality(
  beats: Beat[],
  characters: Character[],
  causalLinks: CausalLink[],
  knowledge: BeatKnowledge[],
  manuscriptTitle: string,
): void {
  const sortedBeats = [...beats].sort((a, b) => a.orderIndex - b.orderIndex)
  const linkByTarget = new Map<string, CausalLink>()
  for (const l of causalLinks) linkByTarget.set(l.toBeatId, l)
  const flow = sortedBeats
    .map((b, i) => {
      const link = linkByTarget.get(b.id) || null
      const prev = i > 0 ? sortedBeats[i - 1] : null
      return buildBeatFlow(b, characters, knowledge, link, prev)
    })
    .join('')
  launch(flow, manuscriptTitle, `${manuscriptTitle} — Plot Causality`)
}
