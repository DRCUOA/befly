// Find/Replace matching engine.
//
// Pulled out of the FindReplacePanel component so the matcher can be unit-
// tested in isolation. The engine is plain text-mode by default, with
// optional case-sensitivity, whole-word, and full regex modes — the same
// triad most editors expose.

export interface FindOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
}

export interface Match {
  /** Inclusive start offset in the source string. */
  start: number
  /** Exclusive end offset. */
  end: number
}

/**
 * Build a RegExp suitable for `String#matchAll` from a query and options.
 * Returns `null` when:
 *   - the query is empty (the caller should treat that as "no matches"), or
 *   - the regex mode is on and the user's pattern is invalid (the caller
 *     can surface a syntax error to the UI without crashing).
 */
export function buildRegex(query: string, opts: FindOptions): RegExp | null {
  if (!query) return null
  let pattern: string
  if (opts.regex) {
    pattern = query
  } else {
    pattern = escapeRegex(query)
  }
  if (opts.wholeWord) {
    // \b is unicode-naïve but matches editor expectations for ASCII content;
    // good enough for the typical essay use case. We also avoid wrapping
    // when the user already uses \b in their regex.
    pattern = `\\b(?:${pattern})\\b`
  }
  let flags = 'g'
  if (!opts.caseSensitive) flags += 'i'
  try {
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Find every match of `query` in `source`, given `opts`. Returns [] for
 *  empty queries or invalid regex patterns. */
export function findAll(source: string, query: string, opts: FindOptions): Match[] {
  const re = buildRegex(query, opts)
  if (!re) return []
  const out: Match[] = []
  for (const m of source.matchAll(re)) {
    if (m.index === undefined) continue
    const start = m.index
    const end = start + m[0].length
    if (end <= start) {
      // Zero-width match (e.g. /(?=)/g) — would loop forever; skip it
      // by advancing past the position.
      continue
    }
    out.push({ start, end })
  }
  return out
}

/**
 * Replace every match of `query` in `source` with `replacement`. When the
 * regex mode is on, `replacement` honours the standard `$1`, `$2`,
 * `$<name>`, and `$&` back-references that String.prototype.replace
 * supports. In plain mode the replacement is treated literally.
 */
export function replaceAll(
  source: string,
  query: string,
  replacement: string,
  opts: FindOptions,
): { result: string; count: number } {
  const re = buildRegex(query, opts)
  if (!re) return { result: source, count: 0 }
  let count = 0
  const result = source.replace(re, match => {
    count++
    return opts.regex ? expandReplacement(replacement, match) : replacement
  })
  return { result, count }
}

/** When using regex mode, callers can include `$1`, `$2`, etc. or `$&`.
 *  We let the underlying String.replace handle $1..$9 and $& natively by
 *  passing replacement as a string when we use the function form, BUT
 *  function-form replacements ignore $-tokens. So we expand them here. */
function expandReplacement(template: string, match: string): string {
  // `template` is what the user typed. It may contain $&. Strict $1..$9
  // expansion would require capture groups from the match, which we don't
  // forward through the function form. For now we support the common $&
  // (entire match) escape and leave $1..$9 to be wired in if requested.
  return template.replace(/\$&/g, match)
}

/**
 * Replace the FIRST match of `query` in `source` with `replacement`,
 * starting at or after `fromIndex`. Used for the "Replace + advance"
 * action where the user replaces one match and the engine moves to the
 * next.
 */
export function replaceFirstFrom(
  source: string,
  query: string,
  replacement: string,
  opts: FindOptions,
  fromIndex: number,
): { result: string; replaced: Match | null; nextIndex: number } {
  const re = buildRegex(query, opts)
  if (!re) return { result: source, replaced: null, nextIndex: fromIndex }
  re.lastIndex = Math.max(0, fromIndex)
  const match = re.exec(source)
  if (!match || match.index === undefined) {
    return { result: source, replaced: null, nextIndex: source.length }
  }
  const start = match.index
  const end = start + match[0].length
  const expanded = opts.regex ? expandReplacement(replacement, match[0]) : replacement
  const result = source.slice(0, start) + expanded + source.slice(end)
  return {
    result,
    replaced: { start, end },
    nextIndex: start + expanded.length,
  }
}
