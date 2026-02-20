import { pool } from '../config/db.js'

export interface UploadedFile {
  id: string
  filename: string
  content_type: string
  data: Buffer
  size_bytes: number
  uploaded_by: string | null
  created_at: Date
}

export const uploadsRepo = {
  async save(filename: string, contentType: string, data: Buffer, uploadedBy: string | null): Promise<string> {
    const result = await pool.query(
      `INSERT INTO uploaded_files (filename, content_type, data, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (filename) DO UPDATE SET data = $3, content_type = $2, size_bytes = $4
       RETURNING id`,
      [filename, contentType, data, data.length, uploadedBy]
    )
    return result.rows[0].id
  },

  async findByFilename(filename: string): Promise<UploadedFile | null> {
    const result = await pool.query(
      'SELECT id, filename, content_type, data, size_bytes, uploaded_by, created_at FROM uploaded_files WHERE filename = $1',
      [filename]
    )
    return result.rows[0] || null
  },

  async listMetadata(): Promise<Omit<UploadedFile, 'data'>[]> {
    const result = await pool.query(
      'SELECT id, filename, content_type, size_bytes, uploaded_by, created_at FROM uploaded_files ORDER BY created_at DESC'
    )
    return result.rows
  },

  async deleteByFilename(filename: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM uploaded_files WHERE filename = $1',
      [filename]
    )
    return (result.rowCount ?? 0) > 0
  }
}
