/**
 * Activity Logger Utility
 * Helper functions for extracting request information for activity logging
 */

import type { Request } from 'express'

/**
 * Get client IP address from request
 */
export function getClientIp(req: Request): string | null {
  // Check various headers for IP (in case of proxies)
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded
    return ips.split(',')[0].trim()
  }
  
  const realIp = req.headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp
  }
  
  return req.socket.remoteAddress || null
}

/**
 * Get user agent from request
 */
export function getUserAgent(req: Request): string | null {
  return req.headers['user-agent'] || null
}

/**
 * Get user ID from request (set by auth middleware)
 */
export function getUserId(req: Request): string | null {
  return (req as any).userId || null
}
