import { appreciationRepo } from '../repositories/appreciation.repo.js'
import { Appreciation, ReactionType, WritingReactionSummary } from '../models/Appreciation.js'

/**
 * Appreciation service - business logic layer
 */
export const appreciationService = {
  async getByWritingId(writingId: string): Promise<Appreciation[]> {
    return appreciationRepo.findByWritingId(writingId)
  },

  async getSummaries(writingIds: string[]): Promise<WritingReactionSummary[]> {
    return appreciationRepo.getSummariesForWritings(writingIds)
  },

  async create(writingId: string, userId: string, reactionType: ReactionType = 'like'): Promise<Appreciation> {
    return appreciationRepo.create({ writingId, userId, reactionType })
  },

  async remove(writingId: string, userId: string, reactionType?: ReactionType): Promise<void> {
    return appreciationRepo.delete(writingId, userId, reactionType)
  }
}
