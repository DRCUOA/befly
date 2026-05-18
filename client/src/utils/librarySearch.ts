/**
 * Tokenised search for the MyLibrary view.
 *
 * Supported syntax (all case-insensitive):
 *
 *   tolkien                 — substring match across every text field
 *   tolkien hobbit          — AND across terms (book must contain both)
 *   "the long road"         — exact phrase
 *   author:tolkien          — match only the authors field
 *   cat:fiction             — match only the categories
 *   desc:"alchemy"          — quoted phrase scoped to one field
 *   year:2023               — substring of the publishedDate (so "2023" or "20" both work)
 *   -author:rowling         — negate: book must NOT have rowling in authors
 *
 * Field aliases:
 *   author / authors        → authors
 *   desc / description      → description
 *   cat / category /
 *   categories              → categories
 *   note / notes            → notes
 *   lang / language         → language
 *   year / date / published → publishedDate
 *   pub / publisher         → publisher
 *
 * Anything unknown after the colon is treated as part of the term (so
 * "9780:" still searches as "9780:" rather than crashing).
 */
import type { LibraryBook } from '@shared/LibraryBook'

export type SearchField =
  | 'title' | 'authors' | 'isbn' | 'owner' | 'description'
  | 'publisher' | 'publishedDate' | 'categories' | 'notes'
  | 'language' | 'provider'

export interface SearchTerm {
  /** Undefined means "match across every text field". */
  field?: SearchField
  text: string
  /** True when the user prefixed with `-` ("not"). */
  negate: boolean
}

const FIELD_ALIASES: Record<string, SearchField> = {
  title: 'title',
  author: 'authors',
  authors: 'authors',
  isbn: 'isbn',
  owner: 'owner',
  desc: 'description',
  description: 'description',
  publisher: 'publisher',
  pub: 'publisher',
  year: 'publishedDate',
  date: 'publishedDate',
  published: 'publishedDate',
  cat: 'categories',
  category: 'categories',
  categories: 'categories',
  note: 'notes',
  notes: 'notes',
  lang: 'language',
  language: 'language',
  provider: 'provider',
}

/**
 * Split the raw query into terms. Handles quoted phrases, field
 * prefixes, and leading `-` for negation.
 */
export function parseQuery(raw: string): SearchTerm[] {
  const terms: SearchTerm[] = []
  if (!raw) return terms

  // Capture groups:
  //   1: leading "-"
  //   2: optional field prefix
  //   3: quoted phrase content
  //   4: bare token
  const re = /(-)?(?:(\w+):)?(?:"([^"]+)"|(\S+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const negate = !!m[1]
    const fieldAlias = m[2]?.toLowerCase()
    const text = (m[3] ?? m[4] ?? '').toLowerCase()
    if (!text) continue

    // Unknown prefix → fold it back into the term so the user gets a
    // sane substring search rather than silent dropping.
    const field = fieldAlias ? FIELD_ALIASES[fieldAlias] : undefined
    if (fieldAlias && !field) {
      terms.push({ field: undefined, text: `${fieldAlias}:${text}`, negate })
    } else {
      terms.push({ field, text, negate })
    }
  }
  return terms
}

function fieldValue(b: LibraryBook, field: SearchField): string {
  switch (field) {
    case 'title':         return b.title
    case 'authors':       return b.authors.join(' ')
    case 'isbn':          return b.isbn
    case 'owner':         return b.owner
    case 'description':   return b.description
    case 'publisher':     return b.publisher
    case 'publishedDate': return b.publishedDate
    case 'categories':    return b.categories.join(' ')
    case 'notes':         return b.notes
    case 'language':      return b.language
    case 'provider':      return b.provider
  }
}

/** Concatenation of every text field, lower-cased once per book per query. */
function allFields(b: LibraryBook): string {
  return [
    b.title, b.authors.join(' '), b.isbn, b.owner, b.description,
    b.publisher, b.publishedDate, b.categories.join(' '), b.notes,
    b.language, b.provider,
  ].join(' ').toLowerCase()
}

function termMatches(b: LibraryBook, t: SearchTerm, cachedAll: string): boolean {
  const haystack = t.field ? fieldValue(b, t.field).toLowerCase() : cachedAll
  const hit = haystack.includes(t.text)
  return t.negate ? !hit : hit
}

/** True when every term in `terms` matches `book`. Empty terms list matches everything. */
export function matchBook(book: LibraryBook, terms: SearchTerm[]): boolean {
  if (terms.length === 0) return true
  const cachedAll = allFields(book)
  for (const t of terms) {
    if (!termMatches(book, t, cachedAll)) return false
  }
  return true
}
