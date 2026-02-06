import { Router } from 'express'
import { commentController } from '../controllers/comment.controller.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Public route (anyone can see comments)
router.get('/writing/:writingId', optionalAuthMiddleware, asyncHandler(commentController.getByWritingId))

// Protected routes require authentication
router.post('/writing/:writingId', authMiddleware, asyncHandler(commentController.create))
router.put('/:commentId', authMiddleware, asyncHandler(commentController.update))
router.delete('/:commentId', authMiddleware, asyncHandler(commentController.remove))

export default router
