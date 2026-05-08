// Build a self-contained HTML document that prints the laid-out book using
// the user's browser print dialog. Two layouts are supported:
//
//   * A5 single-up — every reading page on its own A5 sheet, in reading
//     order. Best when the destination is an A5 printer or a print shop that
//     will trim and bind for you.
//
//   * A4 two-up booklet — each A4 sheet (landscape) holds two A5 pages
//     side-by-side, with pages laid out in saddle-stitch imposition order so
//     that, after printing duplex (flip on long edge) and folding the stack
//     in half, the pages read 1, 2, 3, …
//
// In both cases the front and back covers are included as the first and last
// sheets respectively.

import type { PreviewConfig } from './types'
import { bookletImposition, readingOrderSpreads, type ImposedSpread } from './imposition'

export type PrintLayout = 'a5_single' | 'a4_booklet_2up'

export interface PrintBundle {
  /** Reading-order pages (1-based access). Index 0 unused. Each entry is the
   *  inner HTML of the page (already includes margins / folio / headers). */
  pages: string[]
  frontCoverHtml: string
  backCoverHtml: string
  /** Inline CSS shared by every print sheet (font face hints, page styles). */
  baseCss: string
  /** Document title for the print window. */
  documentTitle: string
}

const A5_W_MM = 148
const A5_H_MM = 210
const A4_W_MM = 297 // landscape width — fits two A5 portraits side-by-side
const A4_H_MM = 210

export function buildPrintHtml(layout: PrintLayout, bundle: PrintBundle, _cfg: PreviewConfig): string {
  const numPages = bundle.pages.length - 1 // bundle.pages[0] is unused (1-based)
  const pageStyle = layout === 'a5_single'
    ? `@page { size: ${A5_W_MM}mm ${A5_H_MM}mm; margin: 0; }`
    : `@page { size: ${A4_W_MM}mm ${A4_H_MM}mm; margin: 0; }`

  const sheetCss = layout === 'a5_single'
    ? singleUpSheetCss()
    : twoUpSheetCss()

  const sheets = layout === 'a5_single'
    ? renderSingleUp(numPages, bundle)
    : renderTwoUp(numPages, bundle)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(bundle.documentTitle)}</title>
  <style>
    ${pageStyle}
    html, body { margin: 0; padding: 0; background: #fff; }
    ${bundle.baseCss}
    ${sheetCss}
    .pp-blank { background: transparent; }
    .pp-cover { background: #2a2620; color: #f4ecdd; display: flex; align-items: center; justify-content: center; }
    .pp-cover-inner { width: 100%; height: 100%; position: relative; }
    .pp-cover img.pp-cover-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .pp-page-num-print { position: absolute; bottom: 8mm; left: 0; right: 0; text-align: center; font-size: 9pt; color: #5a4f3f; }
    @media print { .pp-screen-only { display: none !important; } }
  </style>
</head>
<body>
  <div class="pp-screen-only" style="position:fixed;top:0;left:0;right:0;padding:8px 12px;background:#222;color:#fff;font-family:system-ui,sans-serif;font-size:13px;display:flex;gap:8px;align-items:center;">
    <strong>Print preview.</strong>
    <span style="opacity:.8;">Use your browser's Print dialog (⌘P / Ctrl-P) to send to printer or save as PDF.</span>
    <button onclick="window.print()" style="margin-left:auto;padding:4px 10px;background:#fff;color:#000;border:0;border-radius:3px;cursor:pointer;">Print</button>
    <button onclick="window.close()" style="padding:4px 10px;background:transparent;color:#fff;border:1px solid #fff;border-radius:3px;cursor:pointer;">Close</button>
  </div>
  <div style="height:46px" class="pp-screen-only"></div>
  ${sheets}
  <script>
    // Wait for fonts and images, then auto-open the print dialog.
    window.addEventListener('load', function () {
      setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 250);
    });
  </script>
</body>
</html>`
}

function singleUpSheetCss(): string {
  return `
    .pp-sheet {
      width: ${A5_W_MM}mm;
      height: ${A5_H_MM}mm;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      background: var(--paper-color, #f4ecdd);
    }
    .pp-sheet:last-child { page-break-after: auto; }
    .pp-sheet-inner { position: absolute; inset: 0; }
  `
}

function twoUpSheetCss(): string {
  return `
    .pp-a4 {
      width: ${A4_W_MM}mm;
      height: ${A4_H_MM}mm;
      page-break-after: always;
      display: flex;
      flex-direction: row;
      background: #fff;
    }
    .pp-a4:last-child { page-break-after: auto; }
    .pp-a4 > .pp-half {
      width: 50%;
      height: 100%;
      position: relative;
      overflow: hidden;
      background: var(--paper-color, #f4ecdd);
    }
  `
}

function renderSingleUp(numPages: number, bundle: PrintBundle): string {
  // Cover, then pages 1..N in reading order, then back cover.
  const sheets: string[] = []
  sheets.push(`<div class="pp-sheet pp-cover"><div class="pp-cover-inner">${bundle.frontCoverHtml}</div></div>`)
  for (let i = 1; i <= numPages; i++) {
    const html = bundle.pages[i] || ''
    sheets.push(`<div class="pp-sheet"><div class="pp-sheet-inner">${html}</div></div>`)
  }
  sheets.push(`<div class="pp-sheet pp-cover"><div class="pp-cover-inner">${bundle.backCoverHtml}</div></div>`)
  return sheets.join('\n')
}

function renderTwoUp(numPages: number, bundle: PrintBundle): string {
  // Booklet imposition. The cover sheet is its own A4 with front + back on
  // the OUTER side of the cover sheet; we follow tradition by putting the
  // back cover on the left and front cover on the right of the outermost
  // imposed sheet, then the inside-front/inside-back blanks on the inner
  // side of the cover sheet. (Most print shops actually want the cover as a
  // separate file; we just render it inline so a hobbyist printing at home
  // can fold it together.)
  const sheets: string[] = []

  // Cover sheet — outer side: back-cover on the left, front-cover on the right.
  sheets.push(`
    <div class="pp-a4">
      <div class="pp-half pp-cover"><div class="pp-cover-inner">${bundle.backCoverHtml}</div></div>
      <div class="pp-half pp-cover"><div class="pp-cover-inner">${bundle.frontCoverHtml}</div></div>
    </div>`)
  // Cover sheet — inner side: blank | blank (inside-front / inside-back).
  sheets.push(`
    <div class="pp-a4">
      <div class="pp-half pp-blank"></div>
      <div class="pp-half pp-blank"></div>
    </div>`)

  const imposed: ImposedSpread[] = bookletImposition(numPages)
  for (const spread of imposed) {
    const left = spread.leftPage > 0 ? bundle.pages[spread.leftPage] || '' : ''
    const right = spread.rightPage > 0 ? bundle.pages[spread.rightPage] || '' : ''
    sheets.push(`
      <div class="pp-a4">
        <div class="pp-half">${left || '<div class="pp-blank"></div>'}</div>
        <div class="pp-half">${right || '<div class="pp-blank"></div>'}</div>
      </div>`)
  }
  return sheets.join('\n')
}

export function openPrintWindow(html: string): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}

// Reading-order spreads aren't used for the document layout (the printer
// takes care of folding) but the on-screen "Print preview" thumbnail uses
// them for the single-up case. Re-export for that.
export { readingOrderSpreads }

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
