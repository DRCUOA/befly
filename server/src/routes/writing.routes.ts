import { Router } from 'express'
import { writingController } from '../controllers/writing.controller.js'
import { writingEditorController } from '../controllers/writing-editor.controller.js'
import { writingRevisionController } from '../controllers/writing-revision.controller.js'
import { uploadsController, uploadSingle } from '../controllers/uploads.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Public routes (with optional auth for visibility filtering)
router.get('/', optionalAuthMiddleware, asyncHandler(writingController.getAll))

// "Frags I was invited to edit" — must be declared BEFORE the /:id route
// so Express doesn't match the literal "my-grants" as an :id param.
router.get('/my-grants', authMiddleware, asyncHandler(writingEditorController.myGrants))

router.get('/:id', optionalAuthMiddleware, asyncHandler(writingController.getById))

// Upload (authenticated users - for own essay covers)
router.post('/upload', authMiddleware, uploadSingle, asyncHandler(uploadsController.upload))

// Protected routes require authentication
router.post('/', authMiddleware, validateBody(['title', 'body']), asyncHandler(writingController.create))
router.put('/:id', authMiddleware, asyncHandler(writingController.update))
router.put('/:id/sort-order', authMiddleware, asyncHandler(writingController.moveSortOrder))
router.delete('/:id', authMiddleware, asyncHandler(writingController.delete))

// Editor grants — owner/admin/manager only. List + upsert by userId,
// individual patch/remove by target userId.
router.get('/:id/editors', authMiddleware, asyncHandler(writingEditorController.list))
router.post('/:id/editors', authMiddleware, asyncHandler(writingEditorController.upsert))
router.patch('/:id/editors/:targetUserId', authMiddleware, asyncHandler(writingEditorController.patch))
router.delete('/:id/editors/:targetUserId', authMiddleware, asyncHandler(writingEditorController.remove))

// Revision history + rollback — read mirrors GET /:id access policy;
// restore requires edit-or-higher on the frag.
router.get('/:id/revisions', authMiddleware, asyncHandler(writingRevisionController.list))
router.get('/:id/revisions/:versionNumber', authMiddleware, asyncHandler(writingRevisionController.getOne))
router.post('/:id/restore/:versionNumber', authMiddleware, asyncHandler(writingRevisionController.restore))

// AI assist — six core modes (coherence, define, focus, expand, proofread,
// factcheck) plus the four-mode "Develop" quadrant (fiction-breadth,
// fiction-depth, nonfiction-breadth, nonfiction-depth).
// See shared/WritingAssist.ts for the per-mode args shape.
router.post('/:id/assist', authMiddleware, validateBody(['mode', 'args']), asyncHandler(writingController.runAssist))

export default router
