import { pool } from '../config/db.js'
import type { LibraryBook, LibraryBookUpdate } from '@shared/LibraryBook'
import { ConflictError, NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js'

const COLUMNS = `
  id,
  user_id            AS "userId",
  isbn,
  title,
  authors,
  publisher,
  published_date     AS "publishedDate",
  description,
  page_count         AS "pageCount",
  thumbnail,
  categories,
  language,
  read,
  read_motivation    AS "readMotivation",
  physical_condition AS "physicalCondition",
  owner,
  notes,
  provider,
  raw_metadata       AS "raw",
  created_at         AS "createdAt"
`

/** Columns the user can patch via the general update endpoint. */
const UPDATABLE_COLUMNS: Record<keyof LibraryBookUpdate, string> = {
  title: 'title',
  authors: 'authors',
  publisher: 'publisher',
  publishedDate: 'published_date',
  description: 'description',
  pageCount: 'page_count',
  thumbnail: 'thumbnail',
  categories: 'categories',
  language: 'language',
  read: 'read',
  readMotivation: 'read_motivation',
  physicalCondition: 'physical_condition',
  owner: 'owner',
  notes: 'notes',
}

export const libraryRepo = {
  async listForUser(userId: string): Promise<LibraryBook[]> {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM library_books WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    )
    return result.rows
  },

  async findByIsbn(userId: string, isbn: string): Promise<LibraryBook | null> {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM library_books WHERE user_id = $1 AND isbn = $2`,
      [userId, isbn]
    )
    return result.rows[0] ?? null
  },

  async create(
    book: Omit<LibraryBook, 'id' | 'createdAt'>
  ): Promise<LibraryBook> {
    try {
      const result = await pool.query(
        `INSERT INTO library_books
          (user_id, isbn, title, authors, publisher, published_date,
           description, page_count, thumbnail, categories, language,
           read, read_motivation, physical_condition, owner, notes,
           provider, raw_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 $12, $13, $14, $15, $16, $17, $18)
         RETURNING ${COLUMNS}`,
        [
          book.userId,
          book.isbn,
          book.title,
          book.authors,
          book.publisher,
          book.publishedDate,
          book.description,
          book.pageCount,
          book.thumbnail,
          book.categories,
          book.language,
          book.read,
          book.readMotivation,
          book.physicalCondition,
          book.owner,
          book.notes,
          book.provider,
          book.raw,
        ]
      )
      return result.rows[0]
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictError('This ISBN is already in your library')
      }
      throw err
    }
  },

  async update(id: string, userId: string, updates: LibraryBookUpdate): Promise<LibraryBook> {
    const existing = await pool.query('SELECT user_id FROM library_books WHERE id = $1', [id])
    if (existing.rows.length === 0) throw new NotFoundError('Library book not found')
    if (existing.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to update this library book')
    }

    const fields: string[] = []
    const values: unknown[] = []
    let i = 1
    for (const key of Object.keys(updates) as (keyof LibraryBookUpdate)[]) {
      if (updates[key] === undefined) continue
      const column = UPDATABLE_COLUMNS[key]
      if (!column) continue
      fields.push(`${column} = $${i++}`)
      values.push(updates[key])
    }

    if (fields.length === 0) {
      // Nothing to update — return current row.
      const cur = await pool.query(
        `SELECT ${COLUMNS} FROM library_books WHERE id = $1`,
        [id]
      )
      return cur.rows[0]
    }

    values.push(id)
    const result = await pool.query(
      `UPDATE library_books SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${COLUMNS}`,
      values
    )
    if (result.rowCount === 0) throw new NotFoundError('Library book not found')
    return result.rows[0]
  },

  async delete(id: string, userId: string): Promise<void> {
    const existing = await pool.query('SELECT user_id FROM library_books WHERE id = $1', [id])
    if (existing.rows.length === 0) throw new NotFoundError('Library book not found')
    if (existing.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to delete this library book')
    }
    await pool.query('DELETE FROM library_books WHERE id = $1', [id])
  },
}

/** Range-validate an integer 0..100. Throws ValidationError on bad input. */
export function validateScore(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new ValidationError(`${fieldName} must be an integer between 0 and 100`)
  }
  return value
}
