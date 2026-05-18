/**
 * ISBN lookup with a small fallback chain:
 *
 *   1. Google Books, called directly with an API key (when configured).
 *      `@library-pals/isbn` calls Google unauthenticated, which 429s
 *      almost immediately on shared egress IPs (Heroku, etc.) — telemetry
 *      showed 0% Google success in production. Authenticating lifts the
 *      quota to 1000 req/day per key.
 *   2. Open Library via @library-pals/isbn (its parser is the strongest
 *      and we already depend on the package).
 *   3. If both miss and the ISBN can be converted between 10 and 13
 *      digits, repeat the chain with the alternate form. Some providers
 *      only index one form.
 *
 * Every provider call is wrapped — a JS crash inside one parser must NOT
 * end the chain. Each attempt returns a structured outcome so the
 * controller can log per-provider telemetry rows.
 */
import Isbn, { type Book as PalsBook } from '@library-pals/isbn'
import type { LibraryBookLookup } from '@shared/LibraryBook'
import { config } from '../config/env.js'

const PROVIDER_GOOGLE = 'google'
const PROVIDER_OPENLIBRARY = 'openlibrary'
const PROVIDER_OPENLIBRARY_GAPFILL = 'openlibrary-gapfill'

const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes'
const OPENLIBRARY_DATA_URL = 'https://openlibrary.org/api/books'

const fallbackClient = new Isbn()
fallbackClient.provider([PROVIDER_OPENLIBRARY])

export interface ProviderAttempt {
  provider: string
  /** ISBN form actually queried (may differ from the user-supplied form). */
  isbn: string
  succeeded: boolean
  errorCode?: string
  errorMessage?: string
  durationMs: number
}

export interface IsbnLookupResult {
  data: LibraryBookLookup
  attempts: ProviderAttempt[]
}

/**
 * Convert an ISBN-13 with the 978 prefix to its ISBN-10 equivalent. ISBN-13
 * with 979 prefix has no ISBN-10. Returns null for any non-convertible form.
 */
export function isbn13to10(isbn13: string): string | null {
  if (isbn13.length !== 13 || !isbn13.startsWith('978')) return null
  const core = isbn13.slice(3, 12)
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const d = parseInt(core[i]!, 10)
    if (Number.isNaN(d)) return null
    sum += d * (10 - i)
  }
  const check = (11 - (sum % 11)) % 11
  return core + (check === 10 ? 'X' : String(check))
}

/** Convert any ISBN-10 to its canonical 978-prefixed ISBN-13. */
export function isbn10to13(isbn10: string): string | null {
  if (isbn10.length !== 10) return null
  const core = '978' + isbn10.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(core[i]!, 10)
    if (Number.isNaN(d)) return null
    sum += d * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return core + String(check)
}

/** Best-effort short error code from a thrown error or HTTP status. */
function classifyError(err: unknown, status?: number): string {
  if (status === 429) return 'RATE_LIMITED'
  if (status === 404) return 'NOT_FOUND'
  if (status && status >= 500) return 'PROVIDER_5XX'
  if (status && status >= 400) return `PROVIDER_${status}`
  const msg = (err as any)?.message ?? String(err)
  if (/timeout/i.test(msg)) return 'TIMEOUT'
  if (/Cannot read properties of undefined/i.test(msg)) return 'PARSER_CRASH'
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN/i.test(msg)) return 'NETWORK'
  return 'PROVIDER_ERROR'
}

async function tryGoogleBooks(isbn: string): Promise<LibraryBookLookup> {
  const url = new URL(GOOGLE_BOOKS_URL)
  url.searchParams.set('q', `isbn:${isbn}`)
  url.searchParams.set('maxResults', '1')
  const key = config.googleBooksApiKey
  if (key) url.searchParams.set('key', key)

  // 8s ceiling per provider — three providers in a chain shouldn't keep a
  // user waiting longer than the request timeout.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  let res: Response
  try {
    res = await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const err = new Error(`Google Books responded ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  const json = (await res.json()) as {
    items?: Array<{ volumeInfo?: Record<string, unknown> }>
  }
  if (!json.items || json.items.length === 0) {
    const err = new Error('Google Books returned no items') as Error & { status: number }
    err.status = 404
    throw err
  }

  const volume = json.items[0]
  const info = (volume?.volumeInfo ?? {}) as Record<string, unknown>
  return {
    isbn,
    title: typeof info.title === 'string' ? info.title : '',
    authors: Array.isArray(info.authors) ? (info.authors as string[]) : [],
    publisher: typeof info.publisher === 'string' ? info.publisher : '',
    publishedDate: typeof info.publishedDate === 'string' ? info.publishedDate : '',
    description: typeof info.description === 'string' ? info.description : '',
    pageCount: typeof info.pageCount === 'number' ? info.pageCount : null,
    thumbnail: pickThumbnail(info),
    categories: Array.isArray(info.categories) ? (info.categories as string[]) : [],
    language: typeof info.language === 'string' ? info.language : '',
    provider: PROVIDER_GOOGLE,
    raw: volume as Record<string, unknown>,
  }
}

function pickThumbnail(info: Record<string, unknown>): string {
  const links = info.imageLinks as Record<string, unknown> | undefined
  if (!links) return ''
  const order = ['thumbnail', 'smallThumbnail', 'small', 'medium', 'large']
  for (const k of order) {
    const v = links[k]
    if (typeof v === 'string') return v.replace(/^http:/, 'https:')
  }
  return ''
}

/**
 * Direct Open Library `?jscmd=data` lookup. Exposes richer subjects /
 * number_of_pages / cover URLs than @library-pals/isbn's parser pulls
 * out today, which is why we keep both paths.
 *
 * Used in two places: (a) as a fallback inside `tryChain` would be
 * overkill — we already have @library-pals for that; (b) as the
 * **gap-fill** source after a successful Google hit that came back
 * missing fields. The shape returned matches `LibraryBookLookup`, with
 * the categories/page fields populated when available so `mergeGaps`
 * can lift them onto the primary record.
 */
async function fetchOpenLibraryDirect(isbn: string): Promise<LibraryBookLookup> {
  const url = new URL(OPENLIBRARY_DATA_URL)
  url.searchParams.set('bibkeys', `ISBN:${isbn}`)
  url.searchParams.set('jscmd', 'data')
  url.searchParams.set('format', 'json')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  let res: Response
  try {
    res = await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const err = new Error(`Open Library responded ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  const json = (await res.json()) as Record<string, unknown>
  const key = `ISBN:${isbn}`
  const record = json[key] as Record<string, unknown> | undefined
  if (!record) {
    const err = new Error('Open Library has no record for this ISBN') as Error & { status: number }
    err.status = 404
    throw err
  }

  const authors = Array.isArray(record.authors)
    ? (record.authors as Array<Record<string, unknown>>)
        .map(a => (typeof a.name === 'string' ? a.name : ''))
        .filter(Boolean)
    : []
  const publishers = Array.isArray(record.publishers)
    ? (record.publishers as Array<Record<string, unknown>>)
        .map(p => (typeof p.name === 'string' ? p.name : ''))
        .filter(Boolean)
    : []
  const subjects = Array.isArray(record.subjects)
    ? (record.subjects as Array<Record<string, unknown>>)
        .map(s => (typeof s.name === 'string' ? s.name : ''))
        // Filter out LCSH subdivisions ("X -- Y -- Z") that aren't useful
        // as user-facing genre labels.
        .filter(s => s && !s.includes(' -- '))
        .slice(0, 10)
    : []
  const cover = (record.cover as Record<string, unknown> | undefined) ?? {}
  const thumbnail = [cover.medium, cover.large, cover.small]
    .find((v): v is string => typeof v === 'string' && v.length > 0) ?? ''
  const description = typeof record.description === 'string'
    ? record.description
    : (record.description as Record<string, unknown> | undefined)?.value as string ?? ''

  return {
    isbn,
    title: typeof record.title === 'string' ? record.title : '',
    authors,
    publisher: publishers[0] ?? '',
    publishedDate: typeof record.publish_date === 'string' ? record.publish_date : '',
    description,
    pageCount: typeof record.number_of_pages === 'number' ? record.number_of_pages : null,
    thumbnail,
    categories: subjects,
    language: '',
    provider: PROVIDER_OPENLIBRARY_GAPFILL,
    raw: record,
  }
}

async function tryOpenLibrary(isbn: string): Promise<LibraryBookLookup> {
  const book = await fallbackClient.resolve(isbn, { timeout: 8000 }) as PalsBook
  return {
    isbn,
    title: book.title ?? '',
    authors: book.authors ?? [],
    publisher: book.publisher ?? '',
    publishedDate: book.publishedDate ?? '',
    description: book.description ?? '',
    pageCount: typeof book.pageCount === 'number' ? book.pageCount : null,
    thumbnail: book.thumbnail ?? '',
    categories: book.categories ?? [],
    language: book.language ?? '',
    provider: book.bookProvider || PROVIDER_OPENLIBRARY,
    raw: book as unknown as Record<string, unknown>,
  }
}

/**
 * Run one provider attempt with a try/catch + timer. A crash never bubbles
 * out — the caller gets a structured outcome and decides what to do.
 */
async function runAttempt(
  provider: string,
  isbn: string,
  fn: () => Promise<LibraryBookLookup>
): Promise<{ ok: true; data: LibraryBookLookup; attempt: ProviderAttempt } | { ok: false; attempt: ProviderAttempt }> {
  const startedAt = Date.now()
  try {
    const data = await fn()
    return {
      ok: true,
      data,
      attempt: { provider, isbn, succeeded: true, durationMs: Date.now() - startedAt },
    }
  } catch (err: any) {
    return {
      ok: false,
      attempt: {
        provider,
        isbn,
        succeeded: false,
        errorCode: classifyError(err, err?.status),
        errorMessage: String(err?.message ?? err).slice(0, 400),
        durationMs: Date.now() - startedAt,
      },
    }
  }
}

/** True when the record is missing at least one field that gap-fill can plug. */
function hasGaps(b: LibraryBookLookup): boolean {
  return (
    b.categories.length === 0
    || b.pageCount === null
    || b.description.trim() === ''
    || b.thumbnail.trim() === ''
  )
}

/**
 * Fill the empty fields of `primary` with values from `supplement`.
 * Non-empty primary fields always win. The provider attribution stays
 * on `primary` (it's the canonical source); the `raw` payload picks up
 * a `_gapFilled` annotation so the JSON inspector shows what was added
 * and where it came from.
 */
function mergeGaps(primary: LibraryBookLookup, supplement: LibraryBookLookup): LibraryBookLookup {
  const filledFields: string[] = []
  const pickString = (a: string, b: string, name: string) => {
    if (!a && b) { filledFields.push(name); return b }
    return a
  }
  const pickArray = (a: string[], b: string[], name: string) => {
    if (a.length === 0 && b.length > 0) { filledFields.push(name); return b }
    return a
  }

  const merged: LibraryBookLookup = {
    isbn: primary.isbn,
    title: pickString(primary.title, supplement.title, 'title'),
    authors: pickArray(primary.authors, supplement.authors, 'authors'),
    publisher: pickString(primary.publisher, supplement.publisher, 'publisher'),
    publishedDate: pickString(primary.publishedDate, supplement.publishedDate, 'publishedDate'),
    description: pickString(primary.description, supplement.description, 'description'),
    pageCount: primary.pageCount !== null
      ? primary.pageCount
      : (supplement.pageCount !== null ? (filledFields.push('pageCount'), supplement.pageCount) : null),
    thumbnail: pickString(primary.thumbnail, supplement.thumbnail, 'thumbnail'),
    categories: pickArray(primary.categories, supplement.categories, 'categories'),
    language: pickString(primary.language, supplement.language, 'language'),
    provider: primary.provider,
    raw: {
      ...((primary.raw as Record<string, unknown>) ?? {}),
      _gapFilled: filledFields.length
        ? { from: supplement.provider, fields: filledFields, raw: supplement.raw }
        : undefined,
    },
  }
  return merged
}

/** Run Google → Open Library against one ISBN form. */
async function tryChain(isbn: string): Promise<{ data?: LibraryBookLookup; attempts: ProviderAttempt[] }> {
  const attempts: ProviderAttempt[] = []

  const g = await runAttempt(PROVIDER_GOOGLE, isbn, () => tryGoogleBooks(isbn))
  attempts.push(g.attempt)
  if (g.ok) return { data: g.data, attempts }

  const o = await runAttempt(PROVIDER_OPENLIBRARY, isbn, () => tryOpenLibrary(isbn))
  attempts.push(o.attempt)
  if (o.ok) return { data: o.data, attempts }

  return { attempts }
}

/**
 * If the winning record is missing fields that Open Library typically
 * carries (categories, page count, description, cover), call the OL
 * data API for the same ISBN and merge in only the empty slots.
 *
 * Skipped when the primary record is itself already Open Library —
 * re-querying the same source rarely helps. The OL provider id from
 * @library-pals/isbn is "Open Library" (with space), so we detect both
 * forms.
 */
async function gapFillIfNeeded(
  primary: LibraryBookLookup,
  isbnForLookup: string,
  attempts: ProviderAttempt[]
): Promise<LibraryBookLookup> {
  if (!hasGaps(primary)) return primary
  const p = primary.provider.toLowerCase()
  if (p.includes('openlibrary') || p.includes('open library')) return primary

  const fill = await runAttempt(
    PROVIDER_OPENLIBRARY_GAPFILL,
    isbnForLookup,
    () => fetchOpenLibraryDirect(isbnForLookup)
  )
  attempts.push(fill.attempt)
  if (!fill.ok) return primary
  return mergeGaps(primary, fill.data)
}

/**
 * Main entry. Throws an Error with `.attempts` attached if nothing matches.
 * `userIsbn` is what the user originally scanned — that form is preserved on
 * the returned data even when a conversion was needed.
 */
export async function lookupIsbn(userIsbn: string): Promise<IsbnLookupResult> {
  const allAttempts: ProviderAttempt[] = []

  const first = await tryChain(userIsbn)
  allAttempts.push(...first.attempts)
  if (first.data) {
    const filled = await gapFillIfNeeded(first.data, userIsbn, allAttempts)
    return { data: { ...filled, isbn: userIsbn }, attempts: allAttempts }
  }

  // Convert and try again with the alternate form.
  const alt = userIsbn.length === 13 ? isbn13to10(userIsbn) : userIsbn.length === 10 ? isbn10to13(userIsbn) : null
  if (alt && alt !== userIsbn) {
    const second = await tryChain(alt)
    allAttempts.push(...second.attempts)
    if (second.data) {
      const filled = await gapFillIfNeeded(second.data, alt, allAttempts)
      return { data: { ...filled, isbn: userIsbn }, attempts: allAttempts }
    }
  }

  const error = new Error('No provider returned a record for this ISBN') as Error & { attempts: ProviderAttempt[] }
  error.attempts = allAttempts
  throw error
}
