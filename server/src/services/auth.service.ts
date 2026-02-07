import bcrypt from 'bcrypt'
import jwt, { SignOptions } from 'jsonwebtoken'
import { userRepo } from '../repositories/user.repo.js'
import { User } from '../models/User.js'
import { UnauthorizedError, ValidationError } from '../utils/errors.js'
import { sanitizeEmail } from '../utils/sanitize.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/env.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const BCRYPT_ROUNDS = 12

/**
 * Auth service - handles authentication logic
 */
export const authService = {
  async signup(data: {
    email: string
    password: string
    displayName: string
  }): Promise<{ user: User; token: string }> {
    // Validate input
    if (!data.email || !data.password || !data.displayName) {
      logger.warn('Signup failed: missing required fields')
      throw new ValidationError('Email, password, and display name are required')
    }

    if (data.password.length < 8) {
      logger.warn('Signup failed: password too short')
      throw new ValidationError('Password must be at least 8 characters')
    }

    if (data.displayName.trim().length < 2) {
      logger.warn('Signup failed: display name too short')
      throw new ValidationError('Display name must be at least 2 characters')
    }

    if (data.displayName.trim().length > 255) {
      logger.warn('Signup failed: display name too long')
      throw new ValidationError('Display name must be 255 characters or less')
    }

    // Sanitize and validate email
    const email = sanitizeEmail(data.email)

    // Check if user already exists
    const existing = await userRepo.findByEmail(email)
    if (existing) {
      logger.warn(`Signup failed: email already registered: ${email}`)
      throw new ValidationError('Email already registered')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS)

    // Create user
    const user = await userRepo.create({
      email,
      passwordHash,
      displayName: data.displayName.trim()
    })
    
    logger.info(`User created: ${user.id} (${user.email})`)

    // Generate token
    const token = this.generateToken(user.id)

    return { user, token }
  },

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    if (!email || !password) {
      logger.warn('Login failed: missing email or password')
      throw new ValidationError('Email and password are required')
    }

    // Sanitize email
    const sanitizedEmail = sanitizeEmail(email)

    // Find user
    const userWithPassword = await userRepo.findByEmail(sanitizedEmail)
    if (!userWithPassword) {
      logger.warn(`Login failed: user not found: ${sanitizedEmail}`)
      throw new UnauthorizedError('Invalid email or password')
    }

    // Check status
    if (userWithPassword.status !== 'active') {
      logger.warn(`Login failed: account not active: ${userWithPassword.id}`)
      throw new UnauthorizedError('Account is not active')
    }

    // Verify password
    const isValid = await bcrypt.compare(password, userWithPassword.passwordHash)
    if (!isValid) {
      logger.warn(`Login failed: invalid password for: ${sanitizedEmail}`)
      throw new UnauthorizedError('Invalid email or password')
    }
    
    logger.info(`User logged in: ${userWithPassword.id} (${sanitizedEmail})`)

    // Get user without password
    const user = await userRepo.findById(userWithPassword.id)
    if (!user) {
      throw new UnauthorizedError('User not found')
    }

    // Generate token
    const token = this.generateToken(user.id)

    return { user, token }
  },

  async verifyToken(token: string): Promise<string> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
      return decoded.userId
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token')
    }
  },

  generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    } as SignOptions)
  }
}
