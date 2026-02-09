/**
 * Geo service - resolves IP address to approximate location (lat/lng)
 * Uses fast-geoip (zero dependencies, no inflight) for IP-to-location lookup.
 */

import geoip from 'fast-geoip'
import { logger } from '../utils/logger.js'

export interface GeoLocation {
  latitude: number
  longitude: number
}

/**
 * Get approximate latitude/longitude from client IP.
 * Returns null for private/local IPs or when lookup fails.
 */
export async function getLocationFromIp(ip: string | null): Promise<GeoLocation | null> {
  logger.debug('[geo] getLocationFromIp called', { ip: ip ?? '(null)' })

  if (!ip || ip.trim() === '') {
    logger.debug('[geo] No IP provided or empty, skipping lookup')
    return null
  }

  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1 -> 192.168.1.1)
  const normalized = ip.replace(/^::ffff:/i, '').trim()
  logger.debug('[geo] Normalized IP for lookup', { raw: ip, normalized })

  const result = await geoip.lookup(normalized)
  logger.debug('[geo] Lookup result', { normalized, found: !!result, result: result ? { ll: result.ll, city: result.city, country: result.country } : null })

  if (!result || !Array.isArray(result.ll) || result.ll.length < 2) {
    logger.debug('[geo] No result or missing ll array', { hasResult: !!result, ll: result?.ll })
    return null
  }

  const [lat, lng] = result.ll
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    logger.debug('[geo] Invalid ll types or non-finite', { lat, lng })
    return null
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.debug('[geo] Lat/lng out of valid range', { lat, lng })
    return null
  }

  const location = { latitude: lat, longitude: lng }
  logger.debug('[geo] Resolved location', { ip: normalized, ...location })
  return location
}
