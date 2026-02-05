import { appreciationRepo } from '../repositories/appreciation.repo.js'
import { Appreciation, ReactionType } from '../models/Appreciation.js'

/**
 * Appreciation service - business logic layer
 */
export const appreciationService = {
  async getByWritingId(writingId: string): Promise<Appreciation[]> {
    return appreciationRepo.findByWritingId(writingId)
  },

  async create(writingId: string, userId: string, reactionType: ReactionType = 'like'): Promise<Appreciation> {
    return appreciationRepo.create({ writingId, userId, reactionType })
  },

  async remove(writingId: string, userId: string, reactionType?: ReactionType): Promise<void> {
    return appreciationRepo.delete(writingId, userId, reactionType)
  }
}
