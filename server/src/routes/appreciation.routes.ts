import { Router } from 'express'
import { appreciationController } from '../controllers/appreciation.controller.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Public route (anyone can see appreciations)
router.get('/writing/:writingId', optionalAuthMiddleware, asyncHandler(appreciationController.getByWritingId))

// Protected routes require authentication
router.post('/writing/:writingId', authMiddleware, asyncHandler(appreciationController.create))
router.delete('/writing/:writingId', authMiddleware, asyncHandler(appreciationController.remove))

export default router
