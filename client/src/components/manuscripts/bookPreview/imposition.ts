// Booklet (saddle-stitch) imposition helpers.
//
// When you fold a stack of paper in half to make a booklet, the page
// numbering on each printed sheet must be reordered so that, after folding,
// the pages appear in reading order. For an N-page book (N padded up to a
// multiple of 4) and sheet index i (0-indexed):
//
//   sheet i, outer side: [N - 2i, 2i + 1]              (left, right)
//   sheet i, inner side: [2i + 2, N - 2i - 1]          (left, right)
//
// Pages outside the actual page range come back as 0 and should be rendered
// as blanks.

export interface ImposedSpread {
  sheetIndex: number
  side: 'outer' | 'inner'
  /** 1-based logical page number, or 0 for a blank pad. */
  leftPage: number
  /** 1-based logical page number, or 0 for a blank pad. */
  rightPage: number
}

/**
 * Compute the saddle-stitch imposition for a book of `numPages` reading
 * pages. The returned array has 2 entries per sheet (outer then inner), in
 * print order (sheet 0 first), so a single-sided printer can be fed in this
 * order to produce a foldable booklet.
 */
export function bookletImposition(numPages: number): ImposedSpread[] {
  if (numPages <= 0) return []
  const padded = Math.ceil(numPages / 4) * 4
  const sheets = padded / 4
  const out: ImposedSpread[] = []
  for (let i = 0; i < sheets; i++) {
    const outerLeft = padded - 2 * i
    const outerRight = 2 * i + 1
    const innerLeft = 2 * i + 2
    const innerRight = padded - 2 * i - 1
    out.push({
      sheetIndex: i,
      side: 'outer',
      leftPage: outerLeft > numPages ? 0 : outerLeft,
      rightPage: outerRight > numPages ? 0 : outerRight,
    })
    out.push({
      sheetIndex: i,
      side: 'inner',
      leftPage: innerLeft > numPages ? 0 : innerLeft,
      rightPage: innerRight > numPages ? 0 : innerRight,
    })
  }
  return out
}

/**
 * Linear reading order — useful when "book order" just means "1, 2, 3 …".
 * Returned as 2-page spreads so the same renderer can handle both modes.
 */
export function readingOrderSpreads(numPages: number): ImposedSpread[] {
  const out: ImposedSpread[] = []
  // Reading order: page 1 is a recto by itself (first spread = blank | 1),
  // then 2|3, 4|5, … This matches the on-screen book preview's own
  // left=verso / right=recto convention.
  let cursor = 1
  let sheet = 0
  out.push({ sheetIndex: sheet++, side: 'outer', leftPage: 0, rightPage: cursor++ })
  while (cursor <= numPages) {
    const left = cursor++
    const right = cursor <= numPages ? cursor++ : 0
    out.push({ sheetIndex: sheet++, side: 'outer', leftPage: left, rightPage: right })
  }
  return out
}
