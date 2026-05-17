/**
 * A book in a writer's personal reference library. Captured by scanning an
 * ISBN barcode (or typing one in) and enriched server-side via
 * @library-pals/isbn, which aggregates metadata from Google Books, Open
 * Library, et al.
 *
 * `isbn` is the canonical key the user scanned (ISBN-10 or ISBN-13, digits
 * only). The metadata fields come from the lookup provider and may be empty
 * when the provider has nothing for a given record.
 *
 * Personal fields (read / readMotivation / physicalCondition / owner /
 * notes) live alongside the metadata so a writer can keep their own
 * appraisal of each book — defaults are applied at insertion.
 */
export interface LibraryBook {
  id: string
  userId: string
  isbn: string
  title: string
  authors: string[]
  publisher: string
  publishedDate: string
  description: string
  pageCount: number | null
  thumbnail: string
  categories: string[]
  language: string

  /** Whether the user has read this book. */
  read: boolean
  /** 0 = no interest in (re-)reading, 100 = strong want-to-read. */
  readMotivation: number
  /** 0 = wrecked, 100 = mint. */
  physicalCondition: number
  /** Who currently owns this copy (free-text — could be a person or a shelf). */
  owner: string
  notes: string

  /** Provider that returned the metadata, when known (google, openlibrary, …). */
  provider: string
  /** Full lookup-provider response, preserved for the JSON inspector. */
  raw: Record<string, unknown> | null

  createdAt: string
}

/**
 * Shape returned by the ISBN-lookup endpoint before the book is saved.
 * Has the metadata + provider/raw, but no personal fields or persistence
 * columns — the UI applies personal-field defaults at save time.
 */
export type LibraryBookLookup = Omit<
  LibraryBook,
  'id' | 'userId' | 'createdAt' | 'read' | 'readMotivation' | 'physicalCondition' | 'owner' | 'notes'
>

/** Fields the user can edit after the book is saved. */
export interface LibraryBookUpdate {
  title?: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  pageCount?: number | null
  thumbnail?: string
  categories?: string[]
  language?: string
  read?: boolean
  readMotivation?: number
  physicalCondition?: number
  owner?: string
  notes?: string
}

/**
 * Phase of an ISBN-scan funnel event. `scan` is the camera-side decode;
 * `lookup` is the server-side metadata fetch.
 */
export type LibraryScanPhase = 'scan' | 'lookup'

/**
 * Client-emitted telemetry for the scan phase. The server attaches user_id
 * and inserts a row in library_scan_events; the page later POSTs another
 * event for the lookup phase based on the API response.
 */
export interface LibraryScanEventInput {
  phase: LibraryScanPhase
  isbn?: string
  succeeded: boolean
  /** Provider that returned data (lookup phase). */
  provider?: string
  /** Short machine-readable error tag (e.g. "ISBN_INVALID", "PROVIDER_404"). */
  errorCode?: string
  /** Human-readable error message (truncated server-side). */
  errorMessage?: string
  /** How long the phase took, in milliseconds. */
  durationMs?: number
  /** Which scanner produced the read (zxing | barcodedetector | manual). */
  scanner?: string
}
