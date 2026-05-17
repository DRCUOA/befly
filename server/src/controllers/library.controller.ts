import { Request, Response } from 'express'
import Isbn from '@library-pals/isbn'
import { libraryRepo, validateScore } from '../repositories/library.repo.js'
import { libraryTelemetryRepo } from '../repositories/library-telemetry.repo.js'
import { UnauthorizedError, ValidationError, NotFoundError } from '../utils/errors.js'
import type { LibraryBookLookup, LibraryBookUpdate, LibraryScanEventInput } from '@shared/LibraryBook'

const isbnClient = new Isbn()
isbnClient.provider(['google', 'openlibrary'])

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

function isValidIsbn(isbn: string): boolean {
  return isbn.length === 10 || isbn.length === 13
}

/** Best-effort fire-and-forget telemetry. We never let logging failures
 *  bubble up — the user-facing operation already succeeded or failed on
 *  its own terms. */
function logScanEvent(
  userId: string,
  event: LibraryScanEventInput,
  userAgent: string
): void {
  libraryTelemetryRepo.record(userId, event, userAgent).catch(err => {
    console.error('library telemetry write failed', err)
  })
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

    const userAgent = String(req.headers['user-agent'] || '')
    const isbn = normalizeIsbn(String(req.params.isbn || ''))
    if (!isValidIsbn(isbn)) {
      logScanEvent(userId, {
        phase: 'lookup',
        isbn,
        succeeded: false,
        errorCode: 'ISBN_INVALID',
        errorMessage: 'ISBN must be 10 or 13 digits',
      }, userAgent)
      throw new ValidationError('ISBN must be 10 or 13 digits')
    }

    const startedAt = Date.now()
    try {
      const book = await isbnClient.resolve(isbn, { timeout: 8000 })
      const provider = book.bookProvider ?? ''
      const raw: Record<string, unknown> = { ...(book as unknown as Record<string, unknown>) }
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
        provider,
        raw,
      }

      logScanEvent(userId, {
        phase: 'lookup',
        isbn,
        succeeded: true,
        provider,
        durationMs: Date.now() - startedAt,
      }, userAgent)

      res.json({ data: lookup })
    } catch (err: any) {
      const message = err?.message ?? 'unknown'
      logScanEvent(userId, {
        phase: 'lookup',
        isbn,
        succeeded: false,
        errorCode: err?.code ?? 'PROVIDER_NO_HIT',
        errorMessage: String(message).slice(0, 1000),
        durationMs: Date.now() - startedAt,
      }, userAgent)
      throw new NotFoundError(`No book found for ISBN ${isbn} (${message})`)
    }
  },

  async create(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')

    const isbn = normalizeIsbn(String(req.body?.isbn || ''))
    if (!isValidIsbn(isbn)) {
      throw new ValidationError('ISBN must be 10 or 13 digits')
    }

    const read = Boolean(req.body?.read)
    const readMotivation = req.body?.readMotivation !== undefined
      ? validateScore(req.body.readMotivation, 'readMotivation')
      : 50
    const physicalCondition = req.body?.physicalCondition !== undefined
      ? validateScore(req.body.physicalCondition, 'physicalCondition')
      : 100

    const raw = req.body?.raw && typeof req.body.raw === 'object'
      ? (req.body.raw as Record<string, unknown>)
      : null

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
      read,
      readMotivation,
      physicalCondition,
      owner: String(req.body?.owner ?? ''),
      notes: String(req.body?.notes ?? ''),
      provider: String(req.body?.provider ?? ''),
      raw,
    })

    res.status(201).json({ data: book })
  },

  async update(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')

    const body = (req.body ?? {}) as Record<string, unknown>
    const updates: LibraryBookUpdate = {}
    if (typeof body.title === 'string') updates.title = body.title
    if (Array.isArray(body.authors)) updates.authors = body.authors.map(String)
    if (typeof body.publisher === 'string') updates.publisher = body.publisher
    if (typeof body.publishedDate === 'string') updates.publishedDate = body.publishedDate
    if (typeof body.description === 'string') updates.description = body.description
    if (body.pageCount === null) updates.pageCount = null
    else if (typeof body.pageCount === 'number') updates.pageCount = body.pageCount
    if (typeof body.thumbnail === 'string') updates.thumbnail = body.thumbnail
    if (Array.isArray(body.categories)) updates.categories = body.categories.map(String)
    if (typeof body.language === 'string') updates.language = body.language
    if (typeof body.read === 'boolean') updates.read = body.read
    if (body.readMotivation !== undefined) {
      updates.readMotivation = validateScore(body.readMotivation, 'readMotivation')
    }
    if (body.physicalCondition !== undefined) {
      updates.physicalCondition = validateScore(body.physicalCondition, 'physicalCondition')
    }
    if (typeof body.owner === 'string') updates.owner = body.owner
    if (typeof body.notes === 'string') updates.notes = body.notes

    const book = await libraryRepo.update(req.params.id, userId, updates)
    res.json({ data: book })
  },

  async delete(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await libraryRepo.delete(req.params.id, userId)
    res.status(204).send()
  },

  async logTelemetry(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')

    const body = (req.body ?? {}) as Record<string, unknown>
    const phase = body.phase === 'scan' || body.phase === 'lookup' ? body.phase : null
    if (!phase) {
      throw new ValidationError('phase must be "scan" or "lookup"')
    }

    const event: LibraryScanEventInput = {
      phase,
      isbn: typeof body.isbn === 'string' ? body.isbn : undefined,
      succeeded: Boolean(body.succeeded),
      provider: typeof body.provider === 'string' ? body.provider : undefined,
      errorCode: typeof body.errorCode === 'string' ? body.errorCode : undefined,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
      durationMs: typeof body.durationMs === 'number' ? body.durationMs : undefined,
      scanner: typeof body.scanner === 'string' ? body.scanner : undefined,
    }

    logScanEvent(userId, event, String(req.headers['user-agent'] || ''))
    res.status(204).send()
  },
}
