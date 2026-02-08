import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { errorMiddleware } from './middleware/error.middleware.js'
import { csrfTokenMiddleware, csrfMiddleware } from './middleware/csrf.middleware.js'
import authRoutes from './routes/auth.routes.js'
import writingRoutes from './routes/writing.routes.js'
import themeRoutes from './routes/theme.routes.js'
import appreciationRoutes from './routes/appreciation.routes.js'
import commentRoutes from './routes/comment.routes.js'
import activityRoutes from './routes/activity.routes.js'
import adminRoutes from './routes/admin.routes.js'
import { config } from './config/env.js'

const app = express()

// Heroku sits behind a router/proxy and forwards client IP via X-Forwarded-For.
// Trust the first proxy hop so express-rate-limit can derive client IP correctly.
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const staticDir = path.resolve(__dirname, '../public')
const hasStaticBuild = fs.existsSync(path.join(staticDir, 'index.html'))


// General API rate limiting (applied to all routes)
// More lenient than auth endpoints to allow normal usage
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
})

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Apply general rate limiting to all API routes (except health check and auth routes)
// Auth routes have their own stricter rate limiting
app.use('/api', (req, res, next) => {
  // Skip rate limiting for health check
  if (req.path === '/health') {
    return next()
  }
  // Skip general rate limiting for auth routes (they have their own stricter limits)
  if (req.path.startsWith('/auth')) {
    return next()
  }
  generalRateLimit(req, res, next)
})

// CSRF token generation (must be before CSRF protection)
// Skip CSRF for auth endpoints - they use their own protection
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) {
    return next()
  }
  csrfTokenMiddleware(req, res, next)
})

// CSRF protection for state-changing operations
app.use(csrfMiddleware)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/writing', writingRoutes)
app.use('/api/themes', themeRoutes)
app.use('/api/appreciations', appreciationRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/admin', adminRoutes)

// Health check
app.get('/api/health', async (req, res) => {
  const { activityService } = await import('./services/activity.service.js')
  const userActivity = activityService.getUserLogFromFile()
  
  res.json({ 
    status: 'ok',
    userActivity: userActivity ? {
      summary: userActivity.summary,
      recentActivity: userActivity.recentActivity
    } : null
  })
})

// Config endpoint (public, no auth required)
app.get('/api/config', (req, res) => {
  res.json({ appName: config.appName })
})


// Serve frontend build when present (Docker/Heroku production image)
if (hasStaticBuild) {
  app.use(express.static(staticDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next()
    }
    res.sendFile(path.join(staticDir, 'index.html'))
  })
}

// Error handling
app.use(errorMiddleware)

export default app
