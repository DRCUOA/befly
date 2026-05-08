// Print pipeline.
//
// Older versions of this module produced one snapshot DIV per paginated page
// and embedded the full book flow in each — fine for a short story, but for
// a 200-page novel that's 200 copies of the same HTML. Generating, parsing,
// and rendering that string brought the print dialog to its knees on long
// books.
//
// The current implementation hands the *book flow once* to the print engine
// and relies on natural CSS pagination — `@page` rules for size, margins,
// running headers and folios; `break-before` on chapter sections — and lets
// the browser do the page splitting at print time. Result: print-document
// HTML scales linearly with manuscript length (1× the flow, not N× the
// flow), and dialogs open in a fraction of a second even for long books.
//
// Two layouts:
//
//   * a5_single — `@page { size: 148mm 210mm }`. One page per A5 sheet, in
//     reading order, with covers on dedicated cover-pages either side.
//
//   * a4_booklet_2up — same single-page layout, but the print dialog is
//     opened with a hint to use the OS booklet/2-up imposition feature
//     (Preview, Adobe, Foxit, most professional drivers) which interprets
//     the document as bound pages and lays them out for saddle-stitching.
//     We avoid generating bespoke imposition HTML because that path
//     requires per-page snapshots, which is the slow path we're escaping.

import type { PreviewConfig, HeadersFootersConfig, PageNumberPosition } from './types'
import { trimInches } from './defaults'

export type PrintLayout = 'a5_single' | 'a4_booklet_2up'

export interface PrintBuildArgs {
  cfg: PreviewConfig
  /** Already-built bookFlowHtml (front matter + chapters + back matter). */
  bookFlowHtml: string
  /** Self-contained HTML for the front cover. */
  frontCoverHtml: string
  /** Self-contained HTML for the back cover. */
  backCoverHtml: string
  /** Manuscript title for running header default. */
  bookTitle: string
  /** Author name for running header default. */
  authorName: string
  /** Document title shown in the print window's title bar. */
  documentTitle: string
  /** Print layout. */
  layout: PrintLayout
}

const A5_W_MM = 148
const A5_H_MM = 210

export function buildNaturalPrintHtml(args: PrintBuildArgs): string {
  const {
    cfg, bookFlowHtml, frontCoverHtml, backCoverHtml,
    bookTitle, authorName, documentTitle, layout,
  } = args

  const fontFamily = `"${escapeCssString(cfg.typography.bodyFont)}", "Iowan Old Style", Georgia, "Times New Roman", serif`
  const fontSize = cfg.typography.fontSize + 'pt'
  const lineHeight = cfg.typography.lineHeight + 'pt'
  const align = cfg.typography.alignment === 'justified' ? 'justify' : 'left'
  const hyph = cfg.typography.hyphenation ? 'auto' : 'manual'
  const indent = cfg.paragraphs.firstLineIndent + 'in'
  const paraSpacing = cfg.paragraphs.paragraphSpacing + 'pt'
  const paperColor = cfg.paper.color === 'white' ? '#ffffff' : '#f4ecdd'

  const trim = trimInches(cfg.trimSize)

  // Sheet size: A5 single-up always uses A5 paper. The booklet option also
  // uses A5 — the OS print dialog imposes 2-up booklet at print time.
  const sheetW = A5_W_MM
  const sheetH = A5_H_MM

  // Mirrored facing-page margins. Recto (right) has gutter on the left,
  // outside on the right; verso (left) is the inverse.
  const m = cfg.margins
  const rightMarginCss = `${m.top}in ${m.outside}in ${m.bottom}in ${m.insideGutter}in`
  const leftMarginCss = `${m.top}in ${m.insideGutter}in ${m.bottom}in ${m.outside}in`

  const hf = cfg.headersAndFooters
  const headerLeft = hf.runningHeaders ? resolveHeaderText('left', hf, bookTitle, authorName) : ''
  const headerRight = hf.runningHeaders ? resolveHeaderText('right', hf, bookTitle, authorName) : ''

  const folioCssLeft = folioMarginBox(hf.pageNumberPosition, 'left', fontFamily)
  const folioCssRight = folioMarginBox(hf.pageNumberPosition, 'right', fontFamily)

  const headerCssLeft = headerLeft
    ? `@top-center { content: "${escapeCssString(headerLeft)}"; font-family: ${fontFamily}; font-size: 9pt; color: #5a4f3f; letter-spacing: 0.04em; }`
    : ''
  const headerCssRight = headerRight
    ? `@top-center { content: "${escapeCssString(headerRight)}"; font-family: ${fontFamily}; font-size: 9pt; color: #5a4f3f; letter-spacing: 0.04em; }`
    : ''

  // Chapter-opening pages get a named page so we can suppress the running
  // header (only). Folios on chapter openings are also suppressed via the
  // `suppressFolioOnChapterOpenings` rule, which we model with a CSS
  // counter-reset trick: chapter openings live in `page: chapter-opening`,
  // whose @page rules are bare.
  const suppressOnChapter = hf.suppressHeaderOnChapterOpenings

  const chapterStartBreak = cfg.chapters.chapterStart === 'right_hand_page' ? 'right' : 'page'

  const openingPaddingCss = (() => {
    switch (cfg.chapters.chapterOpeningPosition) {
      case 'top': return '0%'
      case 'centered_high': return '20%'
      case 'upper_third':
      default: return '32%'
    }
  })()

  const dropCapCss = cfg.chapters.dropCap
    ? `.bp-has-drop-cap + .bp-item-opening > p:first-child::first-letter,
       .bp-chapter-opening + .bp-item-opening > p:first-child::first-letter {
         font-size: 3.6em; line-height: 1; font-weight: 500;
         float: left; padding: 0.06em 0.1em 0 0;
       }`
    : ''
  const smallCapsCss = cfg.chapters.smallCapsOpening
    ? `.bp-has-small-caps-opening + .bp-item-opening > p:first-child::first-line,
       .bp-chapter-opening + .bp-item-opening > p:first-child::first-line {
         font-variant: small-caps; letter-spacing: 0.04em;
       }`
    : ''

  // The booklet option still uses A5 page geometry; we add a tip in the
  // toolbar telling the user to enable booklet/2-up at the OS level.
  const toolbarHint = layout === 'a4_booklet_2up'
    ? 'Open Print → Layout / Booklet (or "Pages per sheet → 2") in the system print dialog to fold and saddle-stitch.'
    : 'Use your browser\'s Print dialog (⌘P / Ctrl-P) to send to printer or save as PDF.'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(documentTitle)}</title>
<style>
  /* ===== Page rules ===== */
  @page {
    size: ${sheetW}mm ${sheetH}mm;
    margin: ${rightMarginCss};
  }
  @page :left {
    margin: ${leftMarginCss};
    ${headerCssLeft}
    ${folioCssLeft}
  }
  @page :right {
    margin: ${rightMarginCss};
    ${headerCssRight}
    ${folioCssRight}
  }
  @page :first {
    @top-center { content: ""; }
    @bottom-center { content: ""; }
    @top-left-corner { content: ""; }
    @top-right-corner { content: ""; }
    @bottom-left-corner { content: ""; }
    @bottom-right-corner { content: ""; }
  }
  @page chapter-opening {
    margin: ${rightMarginCss};
    ${suppressOnChapter ? `
      @top-center { content: ""; }
      @top-left-corner { content: ""; }
      @top-right-corner { content: ""; }
      @bottom-center { content: ""; }
      @bottom-left-corner { content: ""; }
      @bottom-right-corner { content: ""; }
    ` : `${headerCssRight} ${folioCssRight}`}
  }
  @page cover {
    margin: 0;
    @top-center { content: ""; } @bottom-center { content: ""; }
    @top-left-corner { content: ""; } @top-right-corner { content: ""; }
    @bottom-left-corner { content: ""; } @bottom-right-corner { content: ""; }
  }

  /* ===== Document chrome ===== */
  html, body { margin: 0; padding: 0; background: ${paperColor}; }
  body {
    font-family: ${fontFamily};
    font-size: ${fontSize};
    line-height: ${lineHeight};
    text-align: ${align};
    hyphens: ${hyph};
    -webkit-hyphens: ${hyph};
    color: #1f1a14;
  }

  /* ===== Body type ===== */
  p { margin: 0; text-indent: ${indent}; padding-bottom: ${paraSpacing}; }
  .bp-item > p:first-child,
  .bp-item-opening > p:first-child { text-indent: 0; }
  ${cfg.paragraphs.removeIndentAfterSceneBreak
    ? '.bp-scene-break + .bp-item > p:first-child { text-indent: 0; }'
    : ''}
  .bp-scene-break {
    text-indent: 0; text-align: center; margin: 1.2em 0;
    font-style: italic; letter-spacing: 0.4em;
  }
  .bp-scene-break-blank { color: transparent; }
  em { font-style: italic; }
  strong { font-weight: 600; }
  blockquote { margin: 0.6em 1.2em; font-style: italic; color: #3a3022; }

  /* ===== Chapter openings ===== */
  .bp-chapter-opening, .bp-chapter {
    break-before: ${chapterStartBreak};
    break-inside: avoid-page;
    page: chapter-opening;
    text-align: center;
  }
  .bp-chapter-opening > .bp-chapter-spacer { display: block; height: ${openingPaddingCss}; }
  .bp-chapter-heading {
    font-size: 1.6em; font-weight: 300; letter-spacing: 0.04em;
    margin: 0 0 1em 0;
  }

  /* ===== Front matter ===== */
  .bp-frontmatter, .bp-titlepage, .bp-toc {
    break-before: ${chapterStartBreak};
    page: chapter-opening;
  }
  .bp-half-title { text-align: center; margin-top: 40%; font-size: 1.2em; letter-spacing: 0.06em; }
  .bp-titlepage { text-align: center; padding-top: 18%; }
  .bp-book-title { font-size: 1.8em; font-weight: 300; margin: 0 0 0.4em 0; }
  .bp-book-subtitle { font-style: italic; }
  .bp-book-author { margin-top: 1.5em; font-style: italic; }
  .bp-fm-line { text-align: center; font-size: 0.85em; margin: 0.4em 0; text-indent: 0; }
  .bp-fm-h { text-align: center; font-size: 1.2em; margin-top: 30%; }
  .bp-dedication { text-align: center; margin-top: 40%; text-indent: 0; }
  .bp-epigraph { text-align: center; margin: 30% 1.5em 0; font-style: italic; }
  .bp-toc { padding-top: 8%; }
  .bp-h2 { text-align: center; font-size: 1.4em; margin: 8% 0 1em 0; }
  .bp-toc-list { list-style: none; padding: 0; margin: 1em 0; font-size: 0.95em; }
  .bp-toc-list li { margin: 0.35em 0; }
  .bp-toc-num { display: inline-block; width: 1.6em; }
  .bp-bridge {
    margin: 0.6em 1.2em; padding: 0.6em 0;
    border-top: 1px solid #c7bfae; border-bottom: 1px solid #c7bfae;
    text-align: center; font-style: italic;
  }
  .bp-placeholder { font-style: italic; color: #6a5f4d; }

  /* ===== Cover pages ===== */
  .pp-cover-page {
    break-before: page;
    break-after: page;
    page: cover;
    width: ${sheetW}mm;
    height: ${sheetH}mm;
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
    background: #2a2620;
    color: #f4ecdd;
  }
  .pp-cover-page-front { /* first sheet — already gets @page :first */ }

  ${dropCapCss}
  ${smallCapsCss}

  /* Trim guides (commented out — uncomment if you want crop marks)
  @media print { body::after { content: ''; position: fixed; ... } }
  */

  @media print {
    .pp-screen-only { display: none !important; }
  }
</style>
</head>
<body>
  <div class="pp-screen-only" style="position:fixed;top:0;left:0;right:0;padding:8px 12px;background:#222;color:#fff;font-family:system-ui,sans-serif;font-size:13px;display:flex;gap:8px;align-items:center;z-index:9999;">
    <strong>Print preview.</strong>
    <span style="opacity:.85;">${escapeHtml(toolbarHint)}</span>
    <button onclick="window.print()" style="margin-left:auto;padding:4px 10px;background:#fff;color:#000;border:0;border-radius:3px;cursor:pointer;">Print</button>
    <button onclick="window.close()" style="padding:4px 10px;background:transparent;color:#fff;border:1px solid #fff;border-radius:3px;cursor:pointer;">Close</button>
  </div>
  <div class="pp-screen-only" style="height:46px;"></div>

  <div class="pp-cover-page pp-cover-page-front">${frontCoverHtml}</div>
  ${bookFlowHtml}
  <div class="pp-cover-page">${backCoverHtml}</div>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 250);
    });
  </script>
</body>
</html>`
  // Note: the browser's print engine already handles thousands of pages of
  // natural-flow HTML faster than we can synthesise per-page snapshots, so
  // even very long books open the dialog promptly with this approach.
  // The trim-vs-A5 scaling difference (e.g. 5.25"×8" content on A5 paper)
  // is handled by the user's print dialog "Fit to page" option; we don't
  // attempt to scale within the document.
  // The reference to `trim` keeps it in scope for future use (e.g. emitting
  // crop marks).
  void trim
}

function resolveHeaderText(
  side: 'left' | 'right',
  hf: HeadersFootersConfig,
  bookTitle: string,
  authorName: string,
): string {
  const which = side === 'left' ? hf.leftPageHeader : hf.rightPageHeader
  switch (which) {
    case 'author_name': return authorName
    case 'book_title': return bookTitle
    // chapter_title isn't supported in @page :left/:right because it requires
    // CSS string-set/string() with broader engine support than we can rely
    // on — fall back to the book title.
    case 'chapter_title': return bookTitle
    case 'none':
    default:
      return ''
  }
}

function folioMarginBox(
  pos: PageNumberPosition,
  side: 'left' | 'right',
  fontFamily: string,
): string {
  const counter = `content: counter(page); font-family: ${fontFamily}; font-size: 9pt; color: #5a4f3f;`
  switch (pos) {
    case 'bottom_center':
      return `@bottom-center { ${counter} }`
    case 'outer_top':
      return side === 'left'
        ? `@top-left-corner { ${counter} }`
        : `@top-right-corner { ${counter} }`
    case 'outer_bottom':
    default:
      return side === 'left'
        ? `@bottom-left-corner { ${counter} }`
        : `@bottom-right-corner { ${counter} }`
  }
}

export function openPrintWindow(html: string): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeCssString(s: string): string {
  // Quote characters and backslashes break out of `content: "..."`. Use the
  // CSS string escape \HEX for those; everything else is fine inside double
  // quotes.
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}
