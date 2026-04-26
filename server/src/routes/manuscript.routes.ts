import { Router } from 'express'
import { manuscriptController } from '../controllers/manuscript.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/* ----- Project routes ----- */
// Public listing/get with optional auth so visibility filtering can apply.
router.get('/', optionalAuthMiddleware, asyncHandler(manuscriptController.list))
router.get('/:id', optionalAuthMiddleware, asyncHandler(manuscriptController.get))
// Convenience: manuscript + ordered sections + items in one call (Book Room).
router.get('/:id/spine', optionalAuthMiddleware, asyncHandler(manuscriptController.getSpine))

// Export the manuscript as a downloadable file.
// Currently Markdown only; format query param is forward-looking.
router.get('/:id/export', optionalAuthMiddleware, asyncHandler(manuscriptController.exportFile))

router.post('/', authMiddleware, validateBody(['title']), asyncHandler(manuscriptController.create))
router.put('/:id', authMiddleware, asyncHandler(manuscriptController.update))
router.delete('/:id', authMiddleware, asyncHandler(manuscriptController.delete))

/* ----- Section routes (nested under manuscript) ----- */
router.get('/:id/sections', optionalAuthMiddleware, asyncHandler(manuscriptController.listSections))
router.post('/:id/sections', authMiddleware, validateBody(['title']), asyncHandler(manuscriptController.createSection))

// Section mutations addressed by sectionId (no manuscriptId in path - the repo
// resolves the parent manuscript from the section's own row).
router.put('/sections/:sectionId', authMiddleware, asyncHandler(manuscriptController.updateSection))
router.delete('/sections/:sectionId', authMiddleware, asyncHandler(manuscriptController.deleteSection))

/* ----- Item routes ----- */
router.get('/:id/items', optionalAuthMiddleware, asyncHandler(manuscriptController.listItems))
router.post('/:id/items', authMiddleware, validateBody(['title']), asyncHandler(manuscriptController.createItem))

// Bulk reorder for drag-and-drop. Body: { moves: [{ id, orderIndex, sectionId? }] }
router.put('/:id/items/reorder', authMiddleware, asyncHandler(manuscriptController.reorderItems))

router.put('/items/:itemId', authMiddleware, asyncHandler(manuscriptController.updateItem))
router.delete('/items/:itemId', authMiddleware, asyncHandler(manuscriptController.deleteItem))

export default router
