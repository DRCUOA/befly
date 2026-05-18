import { Router } from 'express'
import { libraryController } from '../controllers/library.controller.js'
import { uploadsController, uploadSingle } from '../controllers/uploads.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.use(authMiddleware)

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
