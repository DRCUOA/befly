import { Router } from 'express'
import { themeController } from '../controllers/theme.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Public routes (with optional auth for visibility filtering)
router.get('/', optionalAuthMiddleware, asyncHandler(themeController.getAll))
router.get('/:id', optionalAuthMiddleware, asyncHandler(themeController.getById))

// Protected routes require authentication
router.post('/', authMiddleware, validateBody(['name']), asyncHandler(themeController.create))
router.put('/:id', authMiddleware, asyncHandler(themeController.update))
router.delete('/:id', authMiddleware, asyncHandler(themeController.delete))

export default router
