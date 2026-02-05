import { Router } from 'express'
import { appreciationController } from '../controllers/appreciation.controller.js'

const router = Router()

router.get('/writing/:writingId', appreciationController.getByWritingId)
router.post('/writing/:writingId', appreciationController.create)
router.delete('/writing/:writingId', appreciationController.remove)

export default router
