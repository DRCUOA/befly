import { Router } from 'express'
import { authController } from '../controllers/auth.controller.js'
import { validateBody } from '../middleware/validate.middleware.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import rateLimit from 'express-rate-limit'

// Rate limiting for auth endpoints
// More lenient limits to allow legitimate retries while still preventing brute force attacks
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per 15 minutes (allows for retries and multiple attempts)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, including successful ones
  skipFailedRequests: false // Count failed requests too
})

const router = Router()

router.post('/signup', authRateLimit, validateBody(['email', 'password', 'displayName']), asyncHandler(authController.signup))
router.post('/login', authRateLimit, validateBody(['email', 'password']), asyncHandler(authController.login))
router.post('/logout', asyncHandler(authController.logout))
router.get('/me', authMiddleware, asyncHandler(authController.getMe))
router.put('/me', authMiddleware, asyncHandler(authController.updateProfile))

export default router
