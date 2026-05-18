import { Router } from 'express'
import { libraryController } from '../controllers/library.controller.js'
import { uploadsController, uploadSingle } from '../controllers/uploads.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/authorize.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// MyLibrary is currently an admin-only feature. authMiddleware first to
// attach userId/userRole; requireAdmin then forbids anyone whose role
// isn't 'admin'. Belt-and-braces: every route inherits both, including
// the lookup, telemetry, and upload endpoints, so there's no way to
// reach any library API as a non-admin.
router.use(authMiddleware)
router.use(requireAdmin)

router.get('/', asyncHandler(libraryController.list))
router.get('/lookup/:isbn', asyncHandler(libraryController.lookup))
router.post('/', asyncHandler(libraryController.create))
router.post('/telemetry', asyncHandler(libraryController.logTelemetry))
// Custom cover upload. Reuses the shared uploadsController so images
// land in the same uploaded_files PostgreSQL table (survives Heroku's
// ephemeral filesystem). Returns { data: { path: "/uploads/cover/<uuid>.jpg" } }
// which the client stores in library_books.thumbnail.
router.post('/upload', uploadSingle, asyncHandler(uploadsController.upload))
router.patch('/:id', asyncHandler(libraryController.update))
router.delete('/:id', asyncHandler(libraryController.delete))

export default router
