import { Router } from 'express'
import { adminController } from '../controllers/admin.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/authorize.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All admin routes require authentication AND admin role
router.use(authMiddleware)
router.use(requireAdmin)

// User management
router.get('/users', asyncHandler(adminController.listUsers))
router.get('/users/:id', asyncHandler(adminController.getUser))
router.put('/users/:id', asyncHandler(adminController.updateUser))
router.delete('/users/:id', asyncHandler(adminController.deleteUser))

export default router
