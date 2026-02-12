import { Router } from 'express'
import { typographyController } from '../controllers/typography.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/authorize.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Public route: no auth required — returns enabled rules for Write page
router.get('/', asyncHandler(typographyController.getEnabled))

export default router
