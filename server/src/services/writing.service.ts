import { writingRepo } from '../repositories/writing.repo.js'
import { WritingBlock } from '../models/WritingBlock.js'
import { sanitizeString, sanitizeMarkdown } from '../utils/sanitize.js'
import { ValidationError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/**
 * Writing service - business logic layer
 */
export const writingService = {
  async getAll(userId: string | null, limit?: number, offset?: number, isAdmin: boolean = false): Promise<WritingBlock[]> {
    return writingRepo.findAll(userId, limit || 50, offset || 0, isAdmin)
  },

  async getById(id: string, userId: string | null, isAdmin: boolean = false): Promise<WritingBlock> {
    return writingRepo.findById(id, userId, isAdmin)
  },

  async create(data: {
    userId: string
    title: string
    body: string
    themeIds?: string[]
    visibility?: 'private' | 'shared' | 'public'
  }): Promise<WritingBlock> {
    const title = sanitizeString(data.title)
    const body = sanitizeMarkdown(data.body)

    if (!title || !body) {
      logger.warn('Writing creation failed: missing title or body')
      throw new ValidationError('Title and body are required')
    }
    
    if (title.length > 500) {
      logger.warn('Writing creation failed: title too long')
      throw new ValidationError('Title must be 500 characters or less')
    }
    
    if (data.themeIds && !Array.isArray(data.themeIds)) {
      logger.warn('Writing creation failed: invalid themeIds')
      throw new ValidationError('themeIds must be an array')
    }
    
    if (data.visibility && !['private', 'shared', 'public'].includes(data.visibility)) {
      logger.warn('Writing creation failed: invalid visibility')
      throw new ValidationError('Visibility must be private, shared, or public')
    }

    return writingRepo.create({
      userId: data.userId,
      title,
      body,
      themeIds: data.themeIds || [],
      visibility: data.visibility || 'private'
    })
  },

  async update(
    id: string,
    userId: string,
    data: Partial<{
      title: string
      body: string
      themeIds?: string[]
      visibility?: 'private' | 'shared' | 'public'
    }>,
    isAdmin: boolean = false
  ): Promise<WritingBlock> {
    const updates: Partial<{
      title: string
      body: string
      themeIds?: string[]
      visibility?: 'private' | 'shared' | 'public'
    }> = {}
    if (data.title !== undefined) {
      updates.title = sanitizeString(data.title)
    }
    if (data.body !== undefined) {
      updates.body = sanitizeMarkdown(data.body)
    }
    if (data.themeIds !== undefined) {
      updates.themeIds = data.themeIds
    }
    if (data.visibility !== undefined) {
      updates.visibility = data.visibility
    }

    return writingRepo.update(id, userId, updates, isAdmin)
  },

  async delete(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    return writingRepo.delete(id, userId, isAdmin)
  }
}
