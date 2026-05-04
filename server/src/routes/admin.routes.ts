import { Router, json as expressJson } from 'express'
import { adminController } from '../controllers/admin.controller.js'
import { typographyController } from '../controllers/typography.controller.js'
import { uploadsController, uploadSingle } from '../controllers/uploads.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/authorize.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All admin routes require authentication AND admin role
router.use(authMiddleware)
router.use(requireAdmin)

// Typography rules (admin CRUD)
router.get('/typography-rules', asyncHandler(typographyController.getAll))
router.post('/typography-rules/import', asyncHandler(typographyController.bulkImport))
router.get('/typography-rules/:id', asyncHandler(typographyController.getById))
router.post('/typography-rules', asyncHandler(typographyController.create))
router.put('/typography-rules/:id', asyncHandler(typographyController.update))
router.delete('/typography-rules/:id', asyncHandler(typographyController.delete))
router.post('/typography-rules/:id/reorder', asyncHandler(typographyController.reorder))

// Usage analytics
router.get('/stats', asyncHandler(adminController.getStats))

// AI exchanges (diagnostic log of LLM request/response)
router.get('/ai-exchanges', asyncHandler(adminController.listAiExchanges))

// User management
router.get('/users', asyncHandler(adminController.listUsers))
router.get('/users/:id', asyncHandler(adminController.getUser))
router.get('/users/:id/content', asyncHandler(adminController.getUserContent))
router.put('/users/:id', asyncHandler(adminController.updateUser))
router.delete('/users/:id', asyncHandler(adminController.deleteUser))

// Image uploads (admin stock for essay covers)
router.post('/uploads', uploadSingle, asyncHandler(uploadsController.upload))
router.get('/uploads', asyncHandler(uploadsController.list))

// Content management (admin CRUD on any content)
router.get('/writings', asyncHandler(adminController.listWritings))
router.put('/writings/:id/visibility', asyncHandler(adminController.updateWritingVisibility))
router.put('/writings/:id/cover-image', asyncHandler(adminController.updateWritingCoverImage))
router.delete('/writings/:id', asyncHandler(adminController.deleteWriting))
router.delete('/comments/:id', asyncHandler(adminController.deleteComment))
router.delete('/appreciations/:id', asyncHandler(adminController.deleteAppreciation))

// Essay import / export (JSON envelope; downloadable template provided).
// Import gets its own much larger body-parser limit because batch envelopes
// can comfortably exceed the 2mb global cap. Admin-only + requireAdmin already
// gates abuse, and reading 50mb of JSON is cheap compared to actually
// inserting thousands of rows.
router.get('/essays/template', asyncHandler(adminController.exportEssaysTemplate))
router.get('/essays/export', asyncHandler(adminController.exportEssays))
router.post(
  '/essays/import',
  expressJson({ limit: '50mb' }),
  asyncHandler(adminController.importEssays)
)

export default router
