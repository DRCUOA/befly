import { writingRepo } from '../repositories/writing.repo.js'
import { WritingBlock } from '../models/WritingBlock.js'
import { sanitizeString, sanitizeMarkdown } from '../utils/sanitize.js'
import { ValidationError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/** Validate cover image path: must be internal /uploads/... path. Empty string clears. */
function validateCoverImagePath(pathOrUrl: string): void {
  if (typeof pathOrUrl !== 'string') return
  const trimmed = pathOrUrl.trim()
  if (!trimmed) return // empty = clear
  if (!trimmed.startsWith('/uploads/')) {
    throw new ValidationError('Cover image must be an uploaded file path (e.g. /uploads/cover/xxx.jpg)')
  }
  // Prevent path traversal
  if (trimmed.includes('..')) {
    throw new ValidationError('Invalid cover image path')
  }
}

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
    coverImageUrl?: string
    coverImagePosition?: string
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
    if (data.coverImageUrl) validateCoverImagePath(data.coverImageUrl)

    return writingRepo.create({
      userId: data.userId,
      title,
      body,
      themeIds: data.themeIds || [],
      visibility: data.visibility || 'private',
      coverImageUrl: data.coverImageUrl,
      coverImagePosition: data.coverImagePosition || '50% 50%'
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
      coverImageUrl?: string
      coverImagePosition?: string
    }>,
    isAdmin: boolean = false
  ): Promise<WritingBlock> {
    const updates: Partial<{
      title: string
      body: string
      themeIds?: string[]
      visibility?: 'private' | 'shared' | 'public'
      coverImageUrl?: string
      coverImagePosition?: string
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
    if (data.coverImageUrl !== undefined) {
      validateCoverImagePath(data.coverImageUrl)
      updates.coverImageUrl = (typeof data.coverImageUrl === 'string' && data.coverImageUrl.trim()) ? data.coverImageUrl.trim() : null
    }
    if (data.coverImagePosition !== undefined) {
      updates.coverImagePosition = (typeof data.coverImagePosition === 'string' && data.coverImagePosition.trim()) ? data.coverImagePosition.trim() : '50% 50%'
    }

    return writingRepo.update(id, userId, updates, isAdmin)
  },

  async delete(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    return writingRepo.delete(id, userId, isAdmin)
  }
}
