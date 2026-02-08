import { Router } from 'express'
import { activityController } from '../controllers/activity.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Get userlog.json formatted data (public endpoint)
router.get('/userlog', asyncHandler(activityController.getUserLog))

// Get userlog.json formatted data as HTML (public endpoint)
router.get('/userlog/html', asyncHandler(activityController.getUserLogHtml))

// All activity log routes require authentication
router.use(authMiddleware)

// Get current user's activity logs
router.get('/me', asyncHandler(activityController.getMyLogs))

// Get activity logs for a specific resource
router.get('/resource/:resourceType/:resourceId', asyncHandler(activityController.getResourceLogs))

// Get recent activity logs
router.get('/recent', asyncHandler(activityController.getRecentLogs))

export default router
