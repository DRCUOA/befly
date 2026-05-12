import { Router } from 'express'
import { userController } from '../controllers/user.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Authenticated user lookups for in-app features (e.g. "invite an
// editor"). Admin-only user listing lives at /api/admin/users.
router.get('/search', authMiddleware, asyncHandler(userController.search))

export default router
