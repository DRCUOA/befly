import { Router } from 'express'
import { authController } from '../controllers/auth.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'
import rateLimit from 'express-rate-limit'

// Rate limiting for auth endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
})

const router = Router()

router.post('/signup', authRateLimit, validateBody(['email', 'password', 'displayName']), authController.signup)
router.post('/login', authRateLimit, validateBody(['email', 'password']), authController.login)
router.post('/logout', authController.logout)
router.get('/me', authController.getMe)

export default router
