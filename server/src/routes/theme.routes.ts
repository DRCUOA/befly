import { Router } from 'express'
import { themeController } from '../controllers/theme.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()

// Public routes (with optional auth for visibility filtering)
router.get('/', optionalAuthMiddleware, themeController.getAll)
router.get('/:id', optionalAuthMiddleware, themeController.getById)

// Protected routes require authentication
router.post('/', authMiddleware, validateBody(['name']), themeController.create)
router.put('/:id', authMiddleware, themeController.update)
router.delete('/:id', authMiddleware, themeController.delete)

export default router
