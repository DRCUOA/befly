import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { randomUUID } from 'crypto'
import { ValidationError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')
const COVER_SUBDIR = 'cover'

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = path.join(UPLOADS_DIR, COVER_SUBDIR)
    fs.mkdirSync(dest, { recursive: true })
    cb(null, dest)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext.toLowerCase()) ? ext : '.jpg'
    cb(null, `${randomUUID()}${safeExt}`)
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
 */
export const uploadsController = {
  /**
   * POST /api/admin/uploads - upload an image to the stock
   * Returns { path: "/uploads/cover/xxx.jpg" }
   */
  async upload(req: Request, res: Response) {
    const adminUserId = (req as any).userId
    const file = req.file

    if (!file) {
      throw new ValidationError('No file uploaded. Use field name "file".')
    }

    const relativePath = `/uploads/${COVER_SUBDIR}/${file.filename}`

    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'upload',
      resourceId: file.filename,
      action: 'upload_image',
      details: { path: relativePath, originalName: file.originalname },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(201).json({ data: { path: relativePath } })
  },

  /**
   * GET /api/admin/uploads - list all images in the stock
   * Returns { data: [{ path, filename }] }
   */
  async list(req: Request, res: Response) {
    const coverDir = path.join(UPLOADS_DIR, COVER_SUBDIR)
    if (!fs.existsSync(coverDir)) {
      res.json({ data: [] })
      return
    }

    const files = fs.readdirSync(coverDir)
    const images = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(filename => ({
        path: `/uploads/${COVER_SUBDIR}/${filename}`,
        filename
      }))
      .sort((a, b) => b.filename.localeCompare(a.filename))

    res.json({ data: images })
  }
}
