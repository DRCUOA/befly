import { Router } from 'express'
import { writingController } from '../controllers/writing.controller.js'
import { uploadsController, uploadSingle } from '../controllers/uploads.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Public routes (with optional auth for visibility filtering)
router.get('/', optionalAuthMiddleware, asyncHandler(writingController.getAll))
router.get('/:id', optionalAuthMiddleware, asyncHandler(writingController.getById))

// Upload (authenticated users - for own essay covers)
router.post('/upload', authMiddleware, uploadSingle, asyncHandler(uploadsController.upload))

// Protected routes require authentication
router.post('/', authMiddleware, validateBody(['title', 'body']), asyncHandler(writingController.create))
router.put('/:id', authMiddleware, asyncHandler(writingController.update))
router.delete('/:id', authMiddleware, asyncHandler(writingController.delete))

export default router
