// Spoofed-ISBN and EAN-13 barcode helpers for the back-cover preview.
//
// The user explicitly asked for a *spoofed* ISBN — these are NEVER real
// publisher-issued numbers. We use the bookland prefix 978 followed by nine
// digits derived deterministically from a seed string (typically the
// manuscript title), with the standard EAN-13 modulo-10 check digit. The
// resulting barcode is a real, scannable EAN-13 symbol — the digits encoded
// just don't correspond to any actual published book.
//
// Hyphen formatting is the conventional 978-X-XXXX-XXXX-X. Real ISBNs use
// registration-group-aware hyphenation; we don't have those tables and they
// don't affect scannability, so we use a fixed pattern.

/** Run a small deterministic hash over a seed string. djb2 with XOR. */
function djb2(seed: string): number {
  let h = 5381 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h = (((h << 5) + h) ^ seed.charCodeAt(i)) >>> 0
  }
  return h
}

/** EAN-13 check digit for the first twelve digits. */
export function ean13CheckDigit(twelveDigits: number[]): number {
  if (twelveDigits.length !== 12) {
    throw new Error('ean13CheckDigit expects exactly 12 digits')
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += twelveDigits[i] * (i % 2 === 0 ? 1 : 3)
  }
  const mod = sum % 10
  return mod === 0 ? 0 : 10 - mod
}

/**
 * Produce a deterministic, spoofed ISBN-13 from a seed string. The leading
 * three digits are always 978 (bookland EAN prefix); the next nine come from
 * a stable hash of the seed; the trailing check digit is the standard
 * EAN-13 modulo-10 check.
 *
 * Returns the canonical hyphenated form: "978-X-XXXX-XXXX-X".
 */
export function spoofIsbn(seed: string): string {
  const base: number[] = [9, 7, 8]
  // Build nine digits by repeatedly hashing the seed with a salt, so that the
  // sequence is stable per-seed yet reasonably well-distributed.
  let bucket = djb2(seed || 'untitled')
  for (let i = 0; i < 9; i++) {
    if (bucket === 0) bucket = djb2(seed + ':' + i)
    base.push(bucket % 10)
    bucket = Math.floor(bucket / 10)
  }
  const check = ean13CheckDigit(base)
  const all = [...base, check]
  return formatIsbn(all.join(''))
}

/** Format a 13-digit string into "978-X-XXXX-XXXX-X". */
export function formatIsbn(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length !== 13) return digits
  return `${d.slice(0, 3)}-${d[3]}-${d.slice(4, 8)}-${d.slice(8, 12)}-${d[12]}`
}

/** Strip hyphens / whitespace, returning bare digits. */
export function digitsOf(isbn: string): number[] {
  return isbn.replace(/\D/g, '').split('').map(n => parseInt(n, 10))
}

// EAN-13 encoding tables (each a 7-module pattern per digit).
const L_CODES = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
]
const G_CODES = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
]
const R_CODES = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
]
// Parity table indexed by the leading digit. L = use L_CODES, G = use G_CODES.
const PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
]

/**
 * Compute the 95-module bar pattern for a 13-digit ISBN/EAN-13 code as a
 * binary string ('1' = bar, '0' = space). Throws if the input isn't a valid
 * 13-digit number.
 */
export function ean13Pattern(isbn: string): string {
  const d = digitsOf(isbn)
  if (d.length !== 13) {
    throw new Error('EAN-13 pattern requires exactly 13 digits')
  }
  const parity = PARITY[d[0]]
  let bits = '101' // start guard
  for (let i = 0; i < 6; i++) {
    bits += parity[i] === 'L' ? L_CODES[d[i + 1]] : G_CODES[d[i + 1]]
  }
  bits += '01010' // centre guard
  for (let i = 0; i < 6; i++) {
    bits += R_CODES[d[i + 7]]
  }
  bits += '101' // end guard
  return bits
}

export interface BarcodeSvgOptions {
  /** Bar height in module units. Defaults to 70 (≈ standard EAN-13 ratio). */
  barHeight?: number
  /** Background colour. Defaults to white for maximum scanner contrast. */
  bgColor?: string
  /** Bar colour. Defaults to black. */
  fgColor?: string
}

/**
 * Render the EAN-13 symbol for `isbn` as a self-contained SVG string. The
 * SVG includes the human-readable digits below the bars in three groups
 * (leading digit, left half, right half), matching the standard layout.
 */
export function barcodeSvg(isbn: string, options: BarcodeSvgOptions = {}): string {
  const bits = ean13Pattern(isbn)
  const digits = digitsOf(isbn)
  const barHeight = options.barHeight ?? 70
  const bg = options.bgColor ?? '#ffffff'
  const fg = options.fgColor ?? '#000000'

  // Modules: 11 left quiet zone + 95 symbol + 7 right quiet zone = 113.
  const QUIET_LEFT = 11
  const QUIET_RIGHT = 7
  const TOTAL_MODULES = QUIET_LEFT + bits.length + QUIET_RIGHT

  // Bars at positions 0..2, 45..49, 92..94 of the symbol drop below the digit
  // baseline (the long guard bars). Other bars stop above the text.
  const TEXT_BASELINE = barHeight
  const TEXT_HEIGHT = 9
  const SHORT_HEIGHT = barHeight - 6

  const bars: string[] = []
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue
    const isLong = i < 3 || (i >= 45 && i < 50) || i >= 92
    const h = isLong ? barHeight : SHORT_HEIGHT
    bars.push(`<rect x="${QUIET_LEFT + i}" y="0" width="1" height="${h}" fill="${fg}"/>`)
  }

  // Digit text placement: leading digit just outside the left quiet zone,
  // left half centred over modules 3–44 of the symbol, right half centred
  // over modules 50–91.
  const leadingX = QUIET_LEFT - 1
  const leftMidX = QUIET_LEFT + 3 + 21
  const rightMidX = QUIET_LEFT + 50 + 21
  const textY = TEXT_BASELINE + TEXT_HEIGHT - 1

  const text =
    `<text x="${leadingX}" y="${textY}" font-family="OCR-B, Consolas, ui-monospace, monospace" font-size="9" text-anchor="end" fill="${fg}">${digits[0]}</text>` +
    `<text x="${leftMidX}" y="${textY}" font-family="OCR-B, Consolas, ui-monospace, monospace" font-size="9" text-anchor="middle" fill="${fg}">${digits.slice(1, 7).join('')}</text>` +
    `<text x="${rightMidX}" y="${textY}" font-family="OCR-B, Consolas, ui-monospace, monospace" font-size="9" text-anchor="middle" fill="${fg}">${digits.slice(7).join('')}</text>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TOTAL_MODULES} ${barHeight + TEXT_HEIGHT + 2}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" style="background:${bg};display:block;width:100%;height:100%">` +
    bars.join('') +
    text +
    `</svg>`
  )
}
