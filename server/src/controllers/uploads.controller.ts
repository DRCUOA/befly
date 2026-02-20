import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { ValidationError } from '../utils/errors.js'
import { generateUUID } from '../utils/uuid.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'
import { uploadsRepo } from '../repositories/uploads.repo.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')
const COVER_SUBDIR = 'cover'

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = path.join(UPLOADS_DIR, COVER_SUBDIR)
    fs.mkdirSync(dest, { recursive: true })
    cb(null, dest)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext.toLowerCase()) ? ext : '.jpg'
    cb(null, `${generateUUID()}${safeExt}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new ValidationError('Only JPEG, PNG, GIF, and WebP images are allowed'))
    }
  }
})

/**
 * Single file upload middleware - expects field name "file"
 */
export const uploadSingle = upload.single('file')

/**
 * Upload controller - image stock for essay covers
 * Admin: full access. Authenticated users: can upload for own writings.
 *
 * Images are persisted in PostgreSQL (not the filesystem) so they survive
 * Heroku dyno restarts and ephemeral-FS environments.
 */
export const uploadsController = {
  /**
   * POST /api/admin/uploads or /api/writing/upload
   * Multer writes to disk temporarily; we read into a buffer, persist to
   * PostgreSQL, then delete the temp file.
   */
  async upload(req: Request, res: Response) {
    const userId = (req as any).userId
    const file = req.file

    if (!file) {
      throw new ValidationError('No file uploaded. Use field name "file".')
    }

    const relativePath = `/uploads/${COVER_SUBDIR}/${file.filename}`

    try {
      const fileData = fs.readFileSync(file.path)
      await uploadsRepo.save(file.filename, file.mimetype, fileData, userId)
    } finally {
      fs.unlink(file.path, () => {})
    }

    const resourceId = path.parse(file.filename).name
    await activityService.logActivity({
      userId,
      activityType: 'admin',
      resourceType: 'upload',
      resourceId,
      action: 'upload_image',
      details: { path: relativePath, filename: file.filename, originalName: file.originalname },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(201).json({ data: { path: relativePath } })
  },

  /**
   * GET /api/admin/uploads - list all images in the stock
   * Now reads from PostgreSQL instead of the filesystem.
   */
  async list(_req: Request, res: Response) {
    const files = await uploadsRepo.listMetadata()
    const images = files.map(f => ({
      path: `/uploads/${COVER_SUBDIR}/${f.filename}`,
      filename: f.filename
    }))
    res.json({ data: images })
  },

  /**
   * GET /uploads/cover/:filename - serve an image from PostgreSQL.
   * Aggressive caching (immutable filenames with UUID) avoids repeated DB reads.
   */
  async serve(req: Request, res: Response) {
    const { filename } = req.params
    const file = await uploadsRepo.findByFilename(filename)

    if (!file) {
      res.status(404).send('Not found')
      return
    }

    const ext = path.extname(filename).toLowerCase()
    const contentType = file.content_type ||
      Object.entries(MIME_TO_EXT).find(([, e]) => e === ext)?.[0] ||
      'application/octet-stream'

    res.set({
      'Content-Type': contentType,
      'Content-Length': String(file.size_bytes),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': `"${file.id}"`,
    })
    res.send(file.data)
  }
}
