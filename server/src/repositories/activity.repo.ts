/**
 * Activity Log Repository
 * Handles database operations for user activity logs
 */

import { pool } from '../config/db.js'
import type { ActivityLog, CreateActivityLogParams } from '../models/ActivityLog.js'

export const activityRepo = {
  /**
   * Create a new activity log entry
   */
  async create(params: CreateActivityLogParams): Promise<ActivityLog> {
    const {
      userId = null,
      activityType,
      resourceType = null,
      resourceId = null,
      action,
      details = null,
      ipAddress = null,
      userAgent = null
    } = params

    const query = `
      INSERT INTO user_activity_logs (
        user_id,
        activity_type,
        resource_type,
        resource_id,
        action,
        details,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `

    const result = await pool.query(query, [
      userId,
      activityType,
      resourceType,
      resourceId,
      action,
      details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent
    ])

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    }
  },

  /**
   * Get activity logs for a user
   */
  async getByUserId(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ActivityLog[]> {
    const query = `
      SELECT *
      FROM user_activity_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `

    const result = await pool.query(query, [userId, limit, offset])
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    }))
  },

  /**
   * Get activity logs by activity type
   */
  async getByActivityType(
    activityType: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ActivityLog[]> {
    const query = `
      SELECT *
      FROM user_activity_logs
      WHERE activity_type = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `

    const result = await pool.query(query, [activityType, limit, offset])
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    }))
  },

  /**
   * Get activity logs for a specific resource
   */
  async getByResource(
    resourceType: string,
    resourceId: string,
    limit: number = 100
  ): Promise<ActivityLog[]> {
    const query = `
      SELECT *
      FROM user_activity_logs
      WHERE resource_type = $1 AND resource_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `

    const result = await pool.query(query, [resourceType, resourceId, limit])
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    }))
  },

  /**
   * Get recent activity logs (all users)
   */
  async getRecent(limit: number = 100): Promise<ActivityLog[]> {
    const query = `
      SELECT *
      FROM user_activity_logs
      ORDER BY created_at DESC
      LIMIT $1
    `

    const result = await pool.query(query, [limit])
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    }))
  },

  /**
   * Count activity logs for a user
   */
  async countByUserId(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM user_activity_logs
      WHERE user_id = $1
    `

    const result = await pool.query(query, [userId])
    return parseInt(result.rows[0].count, 10)
  }
}
