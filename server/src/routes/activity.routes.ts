import { Router } from 'express'
import { activityController } from '../controllers/activity.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/authorize.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Get userlog.json formatted data (public endpoint)
router.get('/userlog', asyncHandler(activityController.getUserLog))

// Get userlog.json formatted data as HTML (public endpoint)
router.get('/userlog/html', asyncHandler(activityController.getUserLogHtml))

// Get current user's activity logs (requires authentication)
router.get('/me', authMiddleware, asyncHandler(activityController.getMyLogs))

// Admin-only: Get activity logs for a specific resource
router.get('/resource/:resourceType/:resourceId', authMiddleware, requireAdmin, asyncHandler(activityController.getResourceLogs))

// Admin-only: Get recent activity logs (all users)
router.get('/recent', authMiddleware, requireAdmin, asyncHandler(activityController.getRecentLogs))

export default router
