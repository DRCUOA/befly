import { Request, Response } from 'express'
import { authService } from '../services/auth.service.js'
import { userRepo } from '../repositories/user.repo.js'
import { UnauthorizedError } from '../utils/errors.js'

/**
 * Auth controller - handles authentication requests/responses
 */
export const authController = {
  async signup(req: Request, res: Response) {
    const { email, password, displayName } = req.body

    const { user, token } = await authService.signup({
      email,
      password,
      displayName
    })

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.status(201).json({
      data: {
        user,
        token // Also return in body for clients that prefer it
      }
    })
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body

    const { user, token } = await authService.login(email, password)

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.json({
      data: {
        user,
        token // Also return in body for clients that prefer it
      }
    })
  },

  async logout(req: Request, res: Response) {
    res.clearCookie('token')
    res.status(204).send()
  },

  async getMe(req: Request, res: Response) {
    // User is attached by authMiddleware
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Not authenticated')
    }

    const user = await userRepo.findById(userId)
    if (!user) {
      throw new UnauthorizedError('User not found')
    }

    res.json({ data: user })
  }
}
