import { Router } from 'express'
import { writingController } from '../controllers/writing.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'

const router = Router()

router.get('/', writingController.getAll)
router.get('/:id', writingController.getById)
router.post('/', validateBody(['title', 'body']), writingController.create)
router.put('/:id', writingController.update)
router.delete('/:id', writingController.delete)

export default router
