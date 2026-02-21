import { Request, Response } from 'express'
import { authService } from '../services/auth.service.js'
import { userRepo } from '../repositories/user.repo.js'
import { UnauthorizedError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getLocationFromIp } from '../services/geo.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'
import { logger } from '../utils/logger.js'

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

    // Post-auth side-effects must not fail the signup response.
    let userToReturn = user

    try {
      await activityService.logAuth(
        'signup',
        user.id,
        getClientIp(req),
        getUserAgent(req),
        { email, displayName }
      )
    } catch (err) {
      logger.warn('[auth] Failed to log signup activity', { userId: user.id, error: err instanceof Error ? err.message : String(err) })
    }

    try {
      const ip = getClientIp(req)
      const location = await getLocationFromIp(ip)
      if (location) {
        userToReturn = await userRepo.update(user.id, { latitude: location.latitude, longitude: location.longitude })
        logger.debug('[auth] Set user location from IP (signup)', { userId: user.id, ip, ...location })
      }
    } catch (err) {
      logger.warn('[auth] Failed to update location on signup', { userId: user.id, error: err instanceof Error ? err.message : String(err) })
    }

    res.status(201).json({
      data: {
        user: userToReturn,
        token
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

    // Post-auth side-effects must not fail the login response.
    let userToReturn = user

    try {
      await activityService.logAuth(
        'login',
        user.id,
        getClientIp(req),
        getUserAgent(req),
        { email }
      )
    } catch (err) {
      logger.warn('[auth] Failed to log login activity', { userId: user.id, error: err instanceof Error ? err.message : String(err) })
    }

    try {
      const ip = getClientIp(req)
      const location = await getLocationFromIp(ip)
      if (location) {
        userToReturn = await userRepo.update(user.id, { latitude: location.latitude, longitude: location.longitude })
        logger.debug('[auth] Set user location from IP (login)', { userId: user.id, ip, ...location })
      }
    } catch (err) {
      logger.warn('[auth] Failed to update location on login', { userId: user.id, error: err instanceof Error ? err.message : String(err) })
    }

    res.json({
      data: {
        user: userToReturn,
        token
      }
    })
  },

  async logout(req: Request, res: Response) {
    const userId = (req as any).userId || null
    
    // Log logout activity (before clearing cookie)
    if (userId) {
      await activityService.logAuth(
        'logout',
        userId,
        getClientIp(req),
        getUserAgent(req)
      )
    }
    
    res.clearCookie('token')
    res.status(204).send()
  },

  async getMe(req: Request, res: Response) {
    try {
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
    } catch (error) {
      // Re-throw to let error middleware handle it
      throw error
    }
  },

  async updateProfile(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const { displayName } = req.body

    const updatedUser = await userRepo.update(userId, {
      displayName: displayName || undefined
    })

    // Log profile update activity
    await activityService.logActivity({
      userId,
      activityType: 'profile',
      resourceType: 'user',
      resourceId: userId,
      action: 'update',
      details: { displayName },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.json({ data: updatedUser })
  },

  /**
   * Refresh current user's location from request IP.
   * Useful when the user has moved (e.g. different network) without logging in again.
   */
  async refreshLocation(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const ip = getClientIp(req)
    const location = await getLocationFromIp(ip)
    if (!location) {
      return res.status(400).json({
        error: 'Could not determine location from your IP (e.g. private or local network)'
      })
    }

    const updatedUser = await userRepo.update(userId, {
      latitude: location.latitude,
      longitude: location.longitude
    })
    logger.debug('[auth] Refreshed user location from IP', { userId, ip: getClientIp(req), ...location })
    res.json({ data: updatedUser })
  }
}
