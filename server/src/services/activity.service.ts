/**
 * Activity Logging Service
 * Provides high-level interface for logging user activities
 */

import { activityRepo } from '../repositories/activity.repo.js'
import type { ActivityType, ResourceType, CreateActivityLogParams } from '../models/ActivityLog.js'
import { logger } from '../utils/logger.js'

export const activityService = {
  /**
   * Log a user activity
   */
  async logActivity(params: CreateActivityLogParams): Promise<void> {
    try {
      await activityRepo.create(params)
    } catch (error) {
      // Log error but don't fail the request
      logger.error('Failed to log activity:', error)
    }
  },

  /**
   * Log authentication activity
   */
  async logAuth(
    action: 'signup' | 'login' | 'logout' | 'token_refresh',
    userId: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logActivity({
      userId,
      activityType: 'auth',
      action,
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    })
  },

  /**
   * Log writing block activity
   */
  async logWriting(
    action: 'create' | 'update' | 'delete' | 'view',
    resourceId: string,
    userId: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logActivity({
      userId,
      activityType: 'writing',
      resourceType: 'writing_block',
      resourceId,
      action,
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    })
  },

  /**
   * Log theme activity
   */
  async logTheme(
    action: 'create' | 'update' | 'delete' | 'view',
    resourceId: string,
    userId: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logActivity({
      userId,
      activityType: 'theme',
      resourceType: 'theme',
      resourceId,
      action,
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    })
  },

  /**
   * Log appreciation activity
   */
  async logAppreciation(
    action: 'create' | 'remove',
    resourceId: string,
    userId: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logActivity({
      userId,
      activityType: 'appreciation',
      resourceType: 'appreciation',
      resourceId,
      action,
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    })
  },

  /**
   * Log comment activity
   */
  async logComment(
    action: 'create' | 'update' | 'delete',
    resourceId: string,
    userId: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logActivity({
      userId,
      activityType: 'comment',
      resourceType: 'comment',
      resourceId,
      action,
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    })
  },

  /**
   * Log view activity (page views, reading, etc.)
   */
  async logView(
    resourceType: ResourceType | null,
    resourceId: string | null,
    userId: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logActivity({
      userId,
      activityType: 'view',
      resourceType: resourceType || null,
      resourceId: resourceId || null,
      action: 'view',
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    })
  },

  /**
   * Get user's activity logs
   */
  async getUserLogs(userId: string, limit: number = 100, offset: number = 0) {
    return activityRepo.getByUserId(userId, limit, offset)
  },

  /**
   * Get activity logs for a resource
   */
  async getResourceLogs(resourceType: string, resourceId: string, limit: number = 100) {
    return activityRepo.getByResource(resourceType, resourceId, limit)
  },

  /**
   * Get recent activity logs
   */
  async getRecentLogs(limit: number = 100) {
    return activityRepo.getRecent(limit)
  }
}
