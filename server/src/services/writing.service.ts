import { writingRepo } from '../repositories/writing.repo.js'
import { WritingBlock } from '../models/WritingBlock.js'
import { sanitizeString, sanitizeMarkdown } from '../utils/sanitize.js'

/**
 * Writing service - business logic layer
 */
export const writingService = {
  async getAll(limit?: number, offset?: number): Promise<WritingBlock[]> {
    return writingRepo.findAll(limit || 50, offset || 0)
  },

  async getById(id: string): Promise<WritingBlock> {
    return writingRepo.findById(id)
  },

  async create(data: { userId: string; title: string; body: string }): Promise<WritingBlock> {
    const title = sanitizeString(data.title)
    const body = sanitizeMarkdown(data.body)

    if (!title || !body) {
      throw new Error('Title and body are required')
    }

    return writingRepo.create({
      userId: data.userId,
      title,
      body
    })
  },

  async update(id: string, data: Partial<{ title: string; body: string }>): Promise<WritingBlock> {
    const updates: Partial<{ title: string; body: string }> = {}
    if (data.title !== undefined) {
      updates.title = sanitizeString(data.title)
    }
    if (data.body !== undefined) {
      updates.body = sanitizeMarkdown(data.body)
    }

    return writingRepo.update(id, updates)
  },

  async delete(id: string): Promise<void> {
    return writingRepo.delete(id)
  }
}
