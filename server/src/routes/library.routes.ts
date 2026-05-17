import { Router } from 'express'
import { libraryController } from '../controllers/library.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.use(authMiddleware)

router.get('/', asyncHandler(libraryController.list))
router.get('/lookup/:isbn', asyncHandler(libraryController.lookup))
router.post('/', asyncHandler(libraryController.create))
router.patch('/:id/notes', asyncHandler(libraryController.updateNotes))
router.delete('/:id', asyncHandler(libraryController.delete))

export default router
