/**
 * Typography suggestion engine — Option A (suggest only, no programmatic apply)
 *
 * Detects typography issues in markdown-aware manner. Does not mutate text;
 * returns suggestions for user to accept or dismiss.
 *
 * Rules: smart quotes, en/em dashes, ellipsis.
 * Skips: inline code, code blocks, URLs to avoid corrupting markdown.
 *
 * Rule format (extensible):
 *   TypographyRule = { id, description, pattern: RegExp, replace: (match, ...groups) => string | null }
 *   - id: unique rule identifier
 *   - description: shown in UI
 *   - pattern: regex with 'g' flag; matches are skipped if in excluded ranges (code, URLs)
 *   - replace: return replacement or null to skip. Use groups for capture groups.
 *
 * @see documentation/EPICS/editorLayer/Atomics/cni-06-autocorrection-option-a.json
 */

export interface TypographySuggestion {
  /** Start index in text */
  start: number
  /** End index (exclusive) in text */
  end: number
  /** Original text slice */
  original: string
  /** Suggested replacement */
  replacement: string
  /** Human-readable description */
  description: string
  /** Rule identifier for extensibility */
  ruleId: string
}

/** Rule definition for extensible plugin-style architecture */
export interface TypographyRule {
  id: string
  description: string
  /** Regex to find matches. Use capture groups if needed. */
  pattern: RegExp
  /** Return replacement for a match, or null to skip */
  replace: (match: string, ...groups: string[]) => string | null
}

/** Convert API record to client TypographyRule. Replacement supports $1, $2 for capture groups. */
export function recordToRule(record: {
  ruleId: string
  description: string
  pattern: string
  replacement: string
}): TypographyRule {
  const regex = new RegExp(record.pattern, 'g')
  return {
    id: record.ruleId,
    description: record.description,
    pattern: regex,
    replace: (_match: string, ...groups: string[]) => {
      let out = record.replacement
      groups.forEach((g, i) => {
        out = out.replace(new RegExp(`\\$${i + 1}`, 'g'), g ?? '')
      })
      return out
    }
  }
}

/**
 * Ranges that should not be modified (code, URLs).
 * Returns array of [start, end] pairs (exclusive end).
 */
function getExcludedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  let i = 0

  while (i < text.length) {
    // Inline code: `...`
    if (text[i] === '`') {
      const start = i
      i++
      // Triple backtick = code block
      if (text.slice(i, i + 2) === '``') {
        i += 2
        while (i < text.length) {
          const idx = text.indexOf('```', i)
          if (idx === -1) {
            ranges.push([start, text.length])
            i = text.length
            break
          }
          ranges.push([start, idx + 3])
          i = idx + 3
          break
        }
      } else {
        const end = text.indexOf('`', i)
        if (end === -1) break
        ranges.push([start, end + 1])
        i = end + 1
      }
      continue
    }

    // URL in [text](url) — exclude the (url) part
    if (text[i] === ']' && text[i + 1] === '(') {
      const urlStart = i + 1
      const urlEnd = text.indexOf(')', urlStart)
      if (urlEnd !== -1) {
        ranges.push([urlStart, urlEnd + 1])
        i = urlEnd + 1
        continue
      }
    }

    i++
  }

  return ranges
}

/** True if [index, end) overlaps any excluded range (don't corrupt code/URLs) */
function overlapsExcludedRange(index: number, end: number, excluded: Array<[number, number]>): boolean {
  return excluded.some(([s, e]) => index < e && end > s)
}

/** Default typography rules: smart quotes, en/em dashes, ellipsis. Order matters (em before en). Fallback when API fails. */
export const DEFAULT_TYPOGRAPHY_RULES: TypographyRule[] = [
  {
    id: 'ellipsis',
    description: 'Use ellipsis character',
    pattern: /\.{3}/g,
    replace: () => '…'
  },
  {
    id: 'em_dash',
    description: 'Use em dash',
    pattern: /---/g,
    replace: () => '—'
  },
  {
    id: 'en_dash',
    description: 'Use en dash',
    pattern: /--/g,
    replace: () => '–'
  },
  {
    id: 'smart_quotes_double',
    description: 'Use smart double quotes',
    pattern: /"(.*?)"/g,
    replace: (_, content) => `"${content}"`
  },
  {
    id: 'smart_quotes_single',
    description: 'Use smart single quotes',
    pattern: /'(.*?)'/g,
    replace: (_, content) => `'${content}'`
  }
]

/**
 * Scan text for typography suggestions. Markdown-aware (skips code, URLs).
 */
export function scanTypography(text: string, rules: TypographyRule[] = DEFAULT_TYPOGRAPHY_RULES): TypographySuggestion[] {
  const suggestions: TypographySuggestion[] = []
  const excluded = getExcludedRanges(text)

  for (const rule of rules) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      const original = match[0]

      if (overlapsExcludedRange(start, end, excluded)) continue

      const replacement = rule.replace(original, ...match.slice(1))
      if (replacement === null || replacement === original) continue

      suggestions.push({
        start,
        end,
        original,
        replacement,
        description: rule.description,
        ruleId: rule.id
      })
    }
  }

  // Deduplicate overlapping suggestions (e.g. same span suggested by multiple rules)
  return deduplicateSuggestions(suggestions)
}

function deduplicateSuggestions(suggestions: TypographySuggestion[]): TypographySuggestion[] {
  const result: TypographySuggestion[] = []
  for (const s of suggestions) {
    const overlaps = result.some(
      r => (s.start >= r.start && s.start < r.end) || (s.end > r.start && s.end <= r.end) || (s.start <= r.start && s.end >= r.end)
    )
    if (!overlaps) result.push(s)
  }
  return result.sort((a, b) => a.start - b.start)
}

/**
 * Apply a single suggestion to text. Returns new string.
 * Does not mutate; for use when user accepts a suggestion.
 */
export function applySuggestion(text: string, suggestion: TypographySuggestion): string {
  return text.slice(0, suggestion.start) + suggestion.replacement + text.slice(suggestion.end)
}

/**
 * Apply multiple suggestions. Applies in reverse order by start index
 * so indices remain valid. Returns new string.
 */
export function applySuggestions(text: string, suggestions: TypographySuggestion[]): string {
  const sorted = [...suggestions].sort((a, b) => b.start - a.start)
  let result = text
  for (const s of sorted) {
    result = applySuggestion(result, s)
  }
  return result
}

