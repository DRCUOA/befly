import { Router } from 'express'
import { appreciationController } from '../controllers/appreciation.controller.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()

// Public route (anyone can see appreciations)
router.get('/writing/:writingId', optionalAuthMiddleware, appreciationController.getByWritingId)

// Protected routes require authentication
router.post('/writing/:writingId', authMiddleware, appreciationController.create)
router.delete('/writing/:writingId', authMiddleware, appreciationController.remove)

export default router
