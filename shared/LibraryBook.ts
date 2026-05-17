/**
 * A book in a writer's personal reference library. Captured by scanning an
 * ISBN barcode (or typing one in) and enriched server-side via
 * @library-pals/isbn, which aggregates metadata from Google Books, Open
 * Library, et al.
 *
 * `isbn` is the canonical key the user scanned (ISBN-10 or ISBN-13, digits
 * only). All other fields come from the lookup provider and may be empty
 * when the provider has nothing for a given record.
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
  notes: string
  createdAt: string
}

/**
 * Shape of what the ISBN-lookup endpoint returns before the book is saved.
 * Same fields as LibraryBook minus the persistence-only ones.
 */
export type LibraryBookLookup = Omit<LibraryBook, 'id' | 'userId' | 'notes' | 'createdAt'>
