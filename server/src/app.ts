import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorMiddleware } from './middleware/error.middleware.js'
import { csrfTokenMiddleware, csrfMiddleware } from './middleware/csrf.middleware.js'
import authRoutes from './routes/auth.routes.js'
import writingRoutes from './routes/writing.routes.js'
import themeRoutes from './routes/theme.routes.js'
import appreciationRoutes from './routes/appreciation.routes.js'

const app = express()

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5178',
  credentials: true
}))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Error handling
app.use(errorMiddleware)

export default app
