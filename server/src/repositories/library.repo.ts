import { pool } from '../config/db.js'
import type { LibraryBook } from '@shared/LibraryBook'
import { ConflictError, NotFoundError, ForbiddenError } from '../utils/errors.js'

const COLUMNS = `
  id,
  user_id        AS "userId",
  isbn,
  title,
  authors,
  publisher,
  published_date AS "publishedDate",
  description,
  page_count     AS "pageCount",
  thumbnail,
  categories,
  language,
  notes,
  created_at     AS "createdAt"
`

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

  async create(book: Omit<LibraryBook, 'id' | 'createdAt'>): Promise<LibraryBook> {
    try {
      const result = await pool.query(
        `INSERT INTO library_books
          (user_id, isbn, title, authors, publisher, published_date,
           description, page_count, thumbnail, categories, language, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
          book.notes,
        ]
      )
      return result.rows[0]
    } catch (err: any) {
      // 23505 = unique_violation. Surfaces the friendly "already in your
      // library" error in the controller without leaking SQL state.
      if (err?.code === '23505') {
        throw new ConflictError('This ISBN is already in your library')
      }
      throw err
    }
  },

  async updateNotes(id: string, userId: string, notes: string): Promise<LibraryBook> {
    const existing = await pool.query('SELECT user_id FROM library_books WHERE id = $1', [id])
    if (existing.rows.length === 0) throw new NotFoundError('Library book not found')
    if (existing.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to update this library book')
    }
    const result = await pool.query(
      `UPDATE library_books SET notes = $1 WHERE id = $2 RETURNING ${COLUMNS}`,
      [notes, id]
    )
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
