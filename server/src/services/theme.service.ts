import { themeRepo } from '../repositories/theme.repo.js'
import { Theme } from '../models/Theme.js'
import { sanitizeString } from '../utils/sanitize.js'
import { ValidationError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/**
 * Theme service - business logic layer
 */
export const themeService = {
  async getAll(userId: string | null, isAdmin: boolean = false): Promise<Theme[]> {
    return themeRepo.findAll(userId, isAdmin)
  },

  async getById(id: string, userId: string | null, isAdmin: boolean = false): Promise<Theme> {
    return themeRepo.findById(id, userId, isAdmin)
  },

  async create(data: {
    userId: string
    name: string
    visibility?: 'private' | 'shared' | 'public'
  }): Promise<Theme> {
    const name = sanitizeString(data.name)
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    if (!name) {
      logger.warn('Theme creation failed: missing name')
      throw new ValidationError('Theme name is required')
    }
    
    if (name.length > 255) {
      logger.warn('Theme creation failed: name too long')
      throw new ValidationError('Theme name must be 255 characters or less')
    }
    
    if (data.visibility && !['private', 'shared', 'public'].includes(data.visibility)) {
      logger.warn('Theme creation failed: invalid visibility')
      throw new ValidationError('Visibility must be private, shared, or public')
    }

    return themeRepo.create({
      userId: data.userId,
      name,
      slug,
      visibility: data.visibility || 'private'
    })
  },

  async update(
    id: string,
    userId: string,
    data: Partial<{
      name: string
      visibility: 'private' | 'shared' | 'public'
    }>,
    isAdmin: boolean = false
  ): Promise<Theme> {
    const updates: Partial<{ name: string; visibility: 'private' | 'shared' | 'public' }> = {}
    if (data.name !== undefined) {
      updates.name = sanitizeString(data.name)
    }
    if (data.visibility !== undefined) {
      updates.visibility = data.visibility
    }

    return themeRepo.update(id, userId, updates, isAdmin)
  },

  async delete(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    return themeRepo.delete(id, userId, isAdmin)
  }
}
