import { Router } from 'express'
import { themeController } from '../controllers/theme.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'

const router = Router()

router.get('/', themeController.getAll)
router.get('/:id', themeController.getById)
router.post('/', validateBody(['name']), themeController.create)

export default router
