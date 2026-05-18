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

const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes'

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
 * Main entry. Throws an Error with `.attempts` attached if nothing matches.
 * `userIsbn` is what the user originally scanned — that form is preserved on
 * the returned data even when a conversion was needed.
 */
export async function lookupIsbn(userIsbn: string): Promise<IsbnLookupResult> {
  const allAttempts: ProviderAttempt[] = []

  const first = await tryChain(userIsbn)
  allAttempts.push(...first.attempts)
  if (first.data) return { data: { ...first.data, isbn: userIsbn }, attempts: allAttempts }

  // Convert and try again with the alternate form.
  const alt = userIsbn.length === 13 ? isbn13to10(userIsbn) : userIsbn.length === 10 ? isbn10to13(userIsbn) : null
  if (alt && alt !== userIsbn) {
    const second = await tryChain(alt)
    allAttempts.push(...second.attempts)
    if (second.data) return { data: { ...second.data, isbn: userIsbn }, attempts: allAttempts }
  }

  const error = new Error('No provider returned a record for this ISBN') as Error & { attempts: ProviderAttempt[] }
  error.attempts = allAttempts
  throw error
}
