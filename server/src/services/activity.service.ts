/**
 * Activity Logging Service
 * Provides high-level interface for logging user activities
 */

import { activityRepo } from '../repositories/activity.repo.js'
import type { ActivityType, ResourceType, CreateActivityLogParams } from '../models/ActivityLog.js'
import { getOffendingLocation, logger } from '../utils/logger.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export const activityService = {
  /**
   * Log a user activity
   */
  async logActivity(params: CreateActivityLogParams): Promise<void> {
    try {
      await activityRepo.create(params)
    } catch (error) {
      const at = error instanceof Error ? getOffendingLocation(error) : null
      logger.error('Failed to log activity:', { message: error instanceof Error ? error.message : String(error), ...(at && { at }) })
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
  },

  /**
   * Read and format userlog.json file
   */
  getUserLogFromFile() {
    try {
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      const userLogPath = path.resolve(__dirname, '../../../userlog.json')
      
      if (!fs.existsSync(userLogPath)) {
        return null
      }

      const fileContent = fs.readFileSync(userLogPath, 'utf-8')
      const data = JSON.parse(fileContent)
      
      // Format the logs with focus on user activity
      const formattedLogs = data.userlogs.map((log: any) => {
        const timestamp = new Date(log.created_at).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        })

        let description = ''
        if (log.activity_type === 'auth' && log.action === 'login') {
          description = `User logged in${log.details?.email ? ` (${log.details.email})` : ''}`
        } else if (log.activity_type === 'writing') {
          if (log.action === 'create') {
            description = `Created writing: "${log.details?.title || 'Untitled'}"`
          } else if (log.action === 'update') {
            description = `Updated writing: "${log.details?.title || 'Untitled'}"`
          } else if (log.action === 'view') {
            description = `Viewed writing: "${log.details?.title || 'Untitled'}"`
          }
        } else if (log.activity_type === 'appreciation' && log.action === 'create') {
          description = `Reacted with ${log.details?.reactionType || 'appreciation'}`
        } else if (log.activity_type === 'comment' && log.action === 'create') {
          description = `Added a comment (${log.details?.contentLength || 0} chars)`
        } else if (log.activity_type === 'view') {
          description = log.details?.action === 'list' ? 'Browsed writings list' : 'Viewed content'
        } else {
          description = `${log.activity_type} - ${log.action}`
        }

        return {
          timestamp,
          activityType: log.activity_type,
          action: log.action,
          userId: log.user_id,
          description,
          details: log.details
        }
      })

      // Calculate summary statistics
      const summary = {
        totalActivities: data.count || formattedLogs.length,
        byActivityType: {} as Record<string, number>,
        byAction: {} as Record<string, number>,
        authenticatedUsers: new Set<string>(),
        anonymousActivities: 0,
        recentActivity: formattedLogs.slice(0, 10) // Most recent 10 activities
      }

      formattedLogs.forEach((log: any) => {
        // Count by activity type
        summary.byActivityType[log.activityType] = (summary.byActivityType[log.activityType] || 0) + 1
        
        // Count by action
        summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1
        
        // Track authenticated users
        if (log.userId) {
          summary.authenticatedUsers.add(log.userId)
        } else {
          summary.anonymousActivities++
        }
      })

      return {
        summary: {
          totalActivities: summary.totalActivities,
          uniqueUsers: summary.authenticatedUsers.size,
          anonymousActivities: summary.anonymousActivities,
          activityBreakdown: summary.byActivityType,
          actionBreakdown: summary.byAction
        },
        recentActivity: summary.recentActivity,
        allActivities: formattedLogs
      }
    } catch (error) {
      const at = error instanceof Error ? getOffendingLocation(error) : null
      logger.error('Failed to read userlog.json:', { message: error instanceof Error ? error.message : String(error), ...(at && { at }) })
      return null
    }
  }
}
