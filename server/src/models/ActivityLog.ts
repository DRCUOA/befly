/**
 * ActivityLog model
 * Represents a user activity log entry
 */

export interface ActivityLog {
  id: string
  userId: string | null
  activityType: ActivityType
  resourceType: ResourceType | null
  resourceId: string | null
  action: string
  details: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export type ActivityType =
  | 'auth'
  | 'writing'
  | 'theme'
  | 'appreciation'
  | 'comment'
  | 'view'
  | 'profile'

export type ResourceType =
  | 'writing_block'
  | 'theme'
  | 'appreciation'
  | 'comment'
  | 'user'

export interface CreateActivityLogParams {
  userId?: string | null
  activityType: ActivityType
  resourceType?: ResourceType | null
  resourceId?: string | null
  action: string
  details?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}
