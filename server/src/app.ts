import express from 'express'
import cors from 'cors'
import { errorMiddleware } from './middleware/error.middleware.js'
import writingRoutes from './routes/writing.routes.js'
import themeRoutes from './routes/theme.routes.js'
import appreciationRoutes from './routes/appreciation.routes.js'

const app = express()

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5178',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
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
