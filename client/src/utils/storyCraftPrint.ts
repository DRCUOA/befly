// Print helpers for the story-craft views (Character Studio, Polyphonic Map,
// Plot Causality).
//
// These artifacts are STRUCTURED REFERENCE material — character bibles,
// beat detail, knowledge ledgers — not flowing prose. The book-wizard
// typography path used by the essay print is the wrong tool here: novel
// chapter openings, justified body type and first-line indents look awful
// applied to labelled fields and lists.
//
// Instead this module emits a self-contained A4-portrait reference
// document with deliberate page composition: clean section blocks,
// `break-inside: avoid-page` on small atomic items so they never split
// across a page break, `break-before: page` between artifacts so each
// character / beat starts at the top of a fresh sheet, a quiet running
// header and a centred page number. Screen-only chrome is stripped from
// the printed output.

import type {
  Beat,
  BeatKnowledge,
  CausalLink,
  Character,
  CharacterMisreading,
  KnowledgeKind,
} from '@shared/StoryCraft'
import { KNOWLEDGE_KINDS } from '@shared/StoryCraft'
import { openPrintWindow } from '../components/manuscripts/bookPreview/print'

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escCss(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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

// Single-line "Label: value" row inside a definition list. Kept short — the
// CSS turns each `.row` into a two-column grid (label left, value right).
function row(label: string, value: string | null | undefined): string {
  const v = (value || '').trim()
  if (!v) return ''
  return `<div class="row"><dt>${escHtml(label)}</dt><dd>${escHtml(v)}</dd></div>`
}

// Multi-paragraph block with a small uppercase label above the body text.
// Use this for fields that can be long (outer event, voice constraint…).
function fieldBlock(label: string, value: string | null | undefined): string {
  const v = (value || '').trim()
  if (!v) return ''
  return `<div class="field-block"><p class="field-label">${escHtml(label)}</p>${paragraphs(v)}</div>`
}

function listBlock(label: string, items: string[] | undefined | null): string {
  const cleaned = (items || []).map(i => (i || '').trim()).filter(Boolean)
  if (!cleaned.length) return ''
  const lis = cleaned.map(i => `<li>${escHtml(i)}</li>`).join('')
  return `<div class="field-block"><p class="field-label">${escHtml(label)}</p><ul>${lis}</ul></div>`
}

function section(heading: string, body: string): string {
  if (!body.trim()) return ''
  return `<section><h2>${escHtml(heading)}</h2>${body}</section>`
}

function formatSnake(s: string): string {
  return s.replace(/_/g, ' ')
}

function formatKind(kind: KnowledgeKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

function characterArticle(c: Character, misreadings: CharacterMisreading[]): string {
  const v = c.voice || {}
  const cMisreadings = misreadings
    .filter(m => m.characterId === c.id)
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const identityRows = [
    row('Full name', c.fullName),
    row('Role', c.role),
    row('Social position', c.socialPosition),
  ].filter(Boolean).join('')

  const wantsRows = [
    row('Contradiction', c.contradiction),
    row('Public want', c.publicWant),
    row('Private want', c.privateWant),
    row('Hidden need', c.hiddenNeed),
    row('Greatest fear', c.greatestFear),
    row('False belief', c.falseBelief),
    row('Wound', c.wound),
  ].filter(Boolean).join('')

  const voiceRows = [
    row('Sentence length', v.sentenceLength),
    row('Rhythm', v.rhythm),
    row('Punctuation habits', v.punctuationHabits),
    row('Attention pattern', v.attentionPattern),
    row('Avoidance pattern', v.avoidancePattern),
  ].filter(Boolean).join('')

  const voiceLongFields = [
    listBlock('Preferred words', v.preferredWords),
    listBlock('Forbidden words', v.forbiddenWords),
    listBlock('Metaphor sources', v.metaphorSources),
    listBlock('What they notice', v.whatTheyNotice),
    listBlock('What they miss', v.whatTheyMiss),
    fieldBlock('What they lie about', v.whatTheyLieAbout),
    fieldBlock('What they selectively tell', v.whatTheySelectivelyTell),
    fieldBlock('What they never say directly', v.whatTheyNeverSayDirectly),
    fieldBlock('How emotion leaks', v.howEmotionLeaks),
    fieldBlock('How pressure changes the voice', v.howPressureChangesTheVoice),
  ].filter(Boolean).join('')

  const voiceSamples = [
    fieldBlock('Sample sentence (neutral)', v.sampleSentenceNeutral),
    fieldBlock('Sample sentence (under pressure)', v.sampleSentenceUnderPressure),
  ].filter(Boolean).join('')

  const arc = listBlock('Arc phases', c.arcPhases)
  const plot = listBlock('Plot functions', c.plotFunctions)

  const misreadingsBlock = cMisreadings.length
    ? `<ul class="misreadings">${cMisreadings.map(m => {
        return `<li><strong>${escHtml(m.label)}</strong>${m.why ? ` — <em>${escHtml(m.why)}</em>` : ''}</li>`
      }).join('')}</ul>`
    : ''

  const notes = c.notes ? paragraphs(c.notes) : ''

  const subtitleParts: string[] = []
  if (c.role) subtitleParts.push(c.role)
  if (c.socialPosition) subtitleParts.push(c.socialPosition)

  const sections: string[] = []
  if (identityRows) sections.push(section('Identity', `<dl>${identityRows}</dl>`))
  if (wantsRows) sections.push(section('Wants, needs & wounds', `<dl>${wantsRows}</dl>`))
  if (voiceRows || voiceLongFields) {
    let voiceBody = ''
    if (voiceRows) voiceBody += `<dl>${voiceRows}</dl>`
    if (voiceLongFields) voiceBody += voiceLongFields
    sections.push(section('Voice bible', voiceBody))
  }
  if (voiceSamples) sections.push(section('Voice samples', voiceSamples))
  if (arc) sections.push(section('Arc', arc))
  if (plot) sections.push(section('Plot functions', plot))
  if (misreadingsBlock) sections.push(section('Misreadings', misreadingsBlock))
  if (notes) sections.push(section('Notes', notes))

  const body = sections.length
    ? sections.join('')
    : '<p class="empty">No details captured yet.</p>'

  return `<article class="artifact">
    <header class="artifact-header">
      <p class="eyebrow">Character</p>
      <h1>${escHtml(c.name)}</h1>
      ${subtitleParts.length ? `<p class="subtitle">${escHtml(subtitleParts.join(' · '))}</p>` : ''}
      ${c.contradiction ? `<p class="lede">${escHtml(c.contradiction)}</p>` : ''}
    </header>
    ${body}
  </article>`
}

function buildKnowledgeLedger(
  beat: Beat,
  characters: Character[],
  knowledge: BeatKnowledge[],
): string {
  const beatKnow = knowledge.filter(k => k.beatId === beat.id)
  if (!beatKnow.length) return ''

  const rows: { label: string; characterId: string | null; color?: string | null }[] = [
    { label: 'Reader', characterId: null, color: null },
    ...characters.map(c => ({ label: c.name, characterId: c.id, color: c.color || null })),
  ]
  const parts: string[] = []
  for (const r of rows) {
    const entries: string[] = []
    for (const kind of KNOWLEDGE_KINDS) {
      const entry = beatKnow.find(
        k => (k.characterId ?? null) === r.characterId && k.knowledgeKind === kind,
      )
      const text = entry?.text?.trim()
      if (text) {
        entries.push(`<div class="row"><dt>${escHtml(formatKind(kind))}</dt><dd>${escHtml(text)}</dd></div>`)
      }
    }
    if (entries.length) {
      const dot = r.color
        ? `<span class="dot" style="background:${escHtml(r.color)};"></span>`
        : `<span class="dot reader-dot"></span>`
      parts.push(`<div class="knowledge-row">
        <h3>${dot}${escHtml(r.label)}</h3>
        <dl>${entries.join('')}</dl>
      </div>`)
    }
  }
  return parts.join('')
}

function beatArticle(
  beat: Beat,
  characters: Character[],
  knowledge: BeatKnowledge[],
  link?: CausalLink | null,
  prevBeat?: Beat | null,
): string {
  const b = beat
  const pov = characters.find(c => c.id === (b.povCharacterId || '')) || null
  const eyebrowParts: string[] = ['Beat']
  if (b.label) eyebrowParts.push(b.label)
  if (pov) eyebrowParts.push(`POV: ${pov.name}`)
  if (b.timelinePoint) eyebrowParts.push(b.timelinePoint)

  const metaRows = [
    row('Movement', b.movement),
    row('Scene function', b.sceneFunctionType ? formatSnake(b.sceneFunctionType) : null),
    row('Withholding level', b.withholdingLevel),
  ].filter(Boolean).join('')

  const sceneBody = [
    fieldBlock('Outer event', b.outerEvent),
    fieldBlock('Inner turn', b.innerTurn),
    fieldBlock('Voice constraint', b.voiceConstraint),
    fieldBlock('Final image', b.finalImage),
  ].filter(Boolean).join('')

  const ironyBody = [
    fieldBlock('Unique perception', b.uniquePerception),
    fieldBlock('Blind spot', b.blindSpot),
    fieldBlock('Misreading', b.misreading),
    fieldBlock('Reader inference', b.readerInference),
    fieldBlock('Reason for next POV switch', b.reasonForNextPovSwitch),
  ].filter(Boolean).join('')

  const ledger = buildKnowledgeLedger(beat, characters, knowledge)

  const sections: string[] = []
  if (metaRows) sections.push(section('Meta', `<dl>${metaRows}</dl>`))
  if (sceneBody) sections.push(section('Scene', sceneBody))
  if (ironyBody) sections.push(section('Voice & irony', ironyBody))
  if (ledger) sections.push(section('Knowledge ledger', ledger))

  const body = sections.length
    ? sections.join('')
    : '<p class="empty">No details captured yet.</p>'

  const linkRow = link && prevBeat
    ? `<p class="causal-link">${escHtml(formatSnake(link.linkType))} — from <em>"${escHtml(prevBeat.title || prevBeat.label || 'previous beat')}"</em>${link.note ? ` (${escHtml(link.note)})` : ''}</p>`
    : ''

  const heading = b.title || b.label || '(untitled beat)'

  return `<article class="artifact">
    <header class="artifact-header">
      <p class="eyebrow">${escHtml(eyebrowParts.join(' · '))}</p>
      <h1>${escHtml(heading)}</h1>
      ${linkRow}
    </header>
    ${body}
  </article>`
}

interface BuildArgs {
  manuscriptTitle: string
  sectionType: string
  documentTitle: string
  bodyHtml: string
}

function buildHtml(args: BuildArgs): string {
  const { manuscriptTitle, sectionType, documentTitle, bodyHtml } = args
  const runHeaderLeft = escCss(manuscriptTitle)
  const runHeaderRight = escCss(sectionType)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escHtml(documentTitle)}</title>
<style>
  /* ===== Page geometry =====
     A4 portrait with quiet margins. Running header is the manuscript
     title (left) and section type (right); page number sits centre-bottom.
     The first page suppresses the running header so the document opens
     cleanly with the first artifact. */
  @page {
    size: A4 portrait;
    margin: 22mm 18mm 22mm 18mm;
    @top-left {
      content: "${runHeaderLeft}";
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 8pt;
      color: #888;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    @top-right {
      content: "${runHeaderRight}";
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 8pt;
      color: #888;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    @bottom-center {
      content: counter(page);
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 8pt;
      color: #888;
    }
  }
  @page :first {
    @top-left { content: ""; }
    @top-right { content: ""; }
  }

  /* ===== Base ===== */
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
  }
  body {
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  p { margin: 0 0 6pt; }
  p:last-child { margin-bottom: 0; }
  em { font-style: italic; }
  strong { font-weight: 600; }

  /* ===== Article (one character or one beat) =====
     break-before: page on every artifact except the first, so each
     character / beat starts on a fresh sheet. */
  .artifact {
    break-before: page;
  }
  .artifact:first-of-type {
    break-before: auto;
  }

  .artifact-header {
    margin: 0 0 18pt;
    padding-bottom: 12pt;
    border-bottom: 0.5pt solid #cfcfcf;
    break-after: avoid-page;
  }
  .artifact-header .eyebrow {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #888;
    margin: 0 0 4pt;
  }
  .artifact-header h1 {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 22pt;
    font-weight: 500;
    letter-spacing: -0.005em;
    line-height: 1.15;
    margin: 0;
  }
  .artifact-header .subtitle {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 9.5pt;
    color: #666;
    margin: 4pt 0 0;
    letter-spacing: 0.02em;
  }
  .artifact-header .lede {
    font-style: italic;
    color: #555;
    margin: 8pt 0 0;
    font-size: 11pt;
    line-height: 1.4;
  }
  .artifact-header .causal-link {
    font-style: italic;
    color: #666;
    margin: 8pt 0 0;
    font-size: 10pt;
    padding: 4pt 0 4pt 10pt;
    border-left: 2pt solid #d8d8d8;
  }

  /* ===== Sections =====
     We don't put break-inside: avoid-page on a whole section (it could be
     longer than a page). Atomic blocks inside — rows, field-blocks,
     knowledge-rows — get it instead so they never split. */
  section {
    margin-top: 14pt;
  }
  section + section { margin-top: 18pt; }
  section h2 {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 10.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #555;
    margin: 0 0 10pt;
    padding-bottom: 5pt;
    border-bottom: 0.5pt solid #e2e2e2;
    break-after: avoid-page;
  }

  /* ===== Definition rows ===== */
  dl { margin: 0; padding: 0; }
  .row {
    display: flex;
    gap: 14pt;
    padding: 4pt 0;
    border-bottom: 0.5pt dotted #ececec;
    break-inside: avoid-page;
  }
  .row:last-child { border-bottom: none; }
  .row dt {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 8.5pt;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #777;
    flex: 0 0 42mm;
    padding-top: 1pt;
  }
  .row dd {
    margin: 0;
    flex: 1;
    font-size: 10pt;
    line-height: 1.5;
  }

  /* ===== Long-form field blocks ===== */
  .field-block {
    margin-top: 10pt;
    break-inside: avoid-page;
  }
  .field-block:first-child { margin-top: 0; }
  .field-block .field-label {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 8.5pt;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #777;
    margin: 0 0 4pt;
  }

  /* ===== Lists ===== */
  ul, ol {
    margin: 4pt 0 0;
    padding-left: 18pt;
    list-style-position: outside;
  }
  ul li, ol li {
    margin-bottom: 3pt;
    line-height: 1.45;
  }
  ul.misreadings li { margin-bottom: 6pt; }

  /* ===== Knowledge ledger ===== */
  .knowledge-row {
    margin-top: 10pt;
    padding: 8pt 12pt;
    background: #f7f7f5;
    border-left: 2pt solid #d8d8d8;
    break-inside: avoid-page;
  }
  .knowledge-row:first-child { margin-top: 0; }
  .knowledge-row h3 {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 9.5pt;
    font-weight: 600;
    margin: 0 0 6pt;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6pt;
  }
  .knowledge-row .dot {
    display: inline-block;
    width: 7pt;
    height: 7pt;
    border-radius: 50%;
    border: 0.5pt solid rgba(0,0,0,0.18);
    background: #999;
  }
  .knowledge-row .reader-dot { background: #111; }
  .knowledge-row .row { padding: 3pt 0; border-bottom-color: #e6e6e2; }
  .knowledge-row .row dt { flex: 0 0 24mm; }

  .empty {
    color: #999;
    font-style: italic;
    text-align: center;
    padding: 18pt 0;
  }

  /* ===== Honest backgrounds in print =====
     The knowledge-row background is signal, not chrome, so force the
     browser to actually emit it instead of stripping it as a background
     graphic. */
  @media print {
    .knowledge-row {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pp-screen-only { display: none !important; }
  }

  /* ===== Print-preview toolbar (screen only) ===== */
  .toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 8px 14px;
    background: #222;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif;
    font-size: 13px;
    display: flex;
    gap: 10px;
    align-items: center;
    z-index: 9999;
  }
  .toolbar strong { font-weight: 600; }
  .toolbar .hint { opacity: 0.78; }
  .toolbar button {
    margin-left: auto;
    padding: 5px 12px;
    background: #fff;
    color: #000;
    border: 0;
    border-radius: 3px;
    cursor: pointer;
    font: inherit;
  }
  .toolbar button.ghost {
    margin-left: 0;
    background: transparent;
    color: #fff;
    border: 1px solid #fff;
  }
  .toolbar + .doc-pad { height: 50px; }
  @media print {
    .toolbar, .doc-pad { display: none !important; }
  }
</style>
</head>
<body>
  <div class="toolbar pp-screen-only">
    <strong>Print preview.</strong>
    <span class="hint">Use your browser's Print dialog (⌘P / Ctrl-P) to send to printer or save as PDF.</span>
    <button onclick="window.print()">Print</button>
    <button class="ghost" onclick="window.close()">Close</button>
  </div>
  <div class="doc-pad pp-screen-only"></div>
  ${bodyHtml}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 80);
    });
  </script>
</body>
</html>`
}

function launch(html: string): void {
  if (!openPrintWindow(html)) {
    alert('Could not open the print window. Please allow pop-ups for this site.')
  }
}

export function printCharacter(
  character: Character,
  misreadings: CharacterMisreading[],
  manuscriptTitle: string,
): void {
  const body = characterArticle(character, misreadings)
  launch(buildHtml({
    manuscriptTitle,
    sectionType: 'Character',
    documentTitle: `${manuscriptTitle} — ${character.name}`,
    bodyHtml: body,
  }))
}

export function printAllCharacters(
  characters: Character[],
  misreadings: CharacterMisreading[],
  manuscriptTitle: string,
): void {
  const sorted = [...characters].sort((a, b) => a.orderIndex - b.orderIndex)
  const body = sorted.map(c => characterArticle(c, misreadings)).join('')
  launch(buildHtml({
    manuscriptTitle,
    sectionType: 'Characters',
    documentTitle: `${manuscriptTitle} — Characters`,
    bodyHtml: body,
  }))
}

export function printBeat(
  beat: Beat,
  characters: Character[],
  knowledge: BeatKnowledge[],
  manuscriptTitle: string,
): void {
  const body = beatArticle(beat, characters, knowledge)
  const heading = beat.title || beat.label || 'Beat'
  launch(buildHtml({
    manuscriptTitle,
    sectionType: 'Beat',
    documentTitle: `${manuscriptTitle} — ${heading}`,
    bodyHtml: body,
  }))
}

export function printPolyphonicMap(
  characters: Character[],
  beats: Beat[],
  knowledge: BeatKnowledge[],
  manuscriptTitle: string,
): void {
  const sortedBeats = [...beats].sort((a, b) => a.orderIndex - b.orderIndex)
  const body = sortedBeats.map(b => beatArticle(b, characters, knowledge)).join('')
  launch(buildHtml({
    manuscriptTitle,
    sectionType: 'Polyphonic Map',
    documentTitle: `${manuscriptTitle} — Polyphonic Map`,
    bodyHtml: body,
  }))
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
  const body = sortedBeats
    .map((b, i) => {
      const link = linkByTarget.get(b.id) || null
      const prev = i > 0 ? sortedBeats[i - 1] : null
      return beatArticle(b, characters, knowledge, link, prev)
    })
    .join('')
  launch(buildHtml({
    manuscriptTitle,
    sectionType: 'Plot Causality',
    documentTitle: `${manuscriptTitle} — Plot Causality`,
    bodyHtml: body,
  }))
}
