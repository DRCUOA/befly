import { Request, Response } from 'express'
import Isbn from '@library-pals/isbn'
import { libraryRepo } from '../repositories/library.repo.js'
import { UnauthorizedError, ValidationError, NotFoundError } from '../utils/errors.js'
import type { LibraryBookLookup } from '@shared/LibraryBook'

const isbnClient = new Isbn()
// Try Google Books first (richer descriptions/categories), fall back to
// Open Library so we still get something for older or self-published titles.
isbnClient.provider(['google', 'openlibrary'])

/** Strip everything but digits and the trailing X allowed by ISBN-10. */
function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

/** Accept ISBN-10 or ISBN-13 by length only — the lookup providers will
 *  reject genuinely malformed values, no need to duplicate the checksum
 *  math here. */
function isValidIsbn(isbn: string): boolean {
  return isbn.length === 10 || isbn.length === 13
}

export const libraryController = {
  async list(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const books = await libraryRepo.listForUser(userId)
    res.json({ data: books })
  },

  async lookup(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')

    const isbn = normalizeIsbn(String(req.params.isbn || ''))
    if (!isValidIsbn(isbn)) {
      throw new ValidationError('ISBN must be 10 or 13 digits')
    }

    try {
      const book = await isbnClient.resolve(isbn, { timeout: 8000 })
      const lookup: LibraryBookLookup = {
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
      }
      res.json({ data: lookup })
    } catch (err: any) {
      throw new NotFoundError(
        `No book found for ISBN ${isbn}${err?.message ? ` (${err.message})` : ''}`
      )
    }
  },

  async create(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')

    const isbn = normalizeIsbn(String(req.body?.isbn || ''))
    if (!isValidIsbn(isbn)) {
      throw new ValidationError('ISBN must be 10 or 13 digits')
    }

    const book = await libraryRepo.create({
      userId,
      isbn,
      title: String(req.body?.title ?? ''),
      authors: Array.isArray(req.body?.authors) ? req.body.authors.map(String) : [],
      publisher: String(req.body?.publisher ?? ''),
      publishedDate: String(req.body?.publishedDate ?? ''),
      description: String(req.body?.description ?? ''),
      pageCount: typeof req.body?.pageCount === 'number' ? req.body.pageCount : null,
      thumbnail: String(req.body?.thumbnail ?? ''),
      categories: Array.isArray(req.body?.categories) ? req.body.categories.map(String) : [],
      language: String(req.body?.language ?? ''),
      notes: String(req.body?.notes ?? ''),
    })

    res.status(201).json({ data: book })
  },

  async updateNotes(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const book = await libraryRepo.updateNotes(req.params.id, userId, String(req.body?.notes ?? ''))
    res.json({ data: book })
  },

  async delete(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await libraryRepo.delete(req.params.id, userId)
    res.status(204).send()
  },
}
