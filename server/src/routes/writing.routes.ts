import { Router } from 'express'
import { writingController } from '../controllers/writing.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()

// Public routes (with optional auth for visibility filtering)
router.get('/', optionalAuthMiddleware, writingController.getAll)
router.get('/:id', optionalAuthMiddleware, writingController.getById)

// Protected routes require authentication
router.post('/', authMiddleware, validateBody(['title', 'body']), writingController.create)
router.put('/:id', authMiddleware, writingController.update)
router.delete('/:id', authMiddleware, writingController.delete)

export default router
