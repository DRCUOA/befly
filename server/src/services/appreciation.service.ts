import { appreciationRepo } from '../repositories/appreciation.repo.js'
import { Appreciation } from '../models/Appreciation.js'

/**
 * Appreciation service - business logic layer
 */
export const appreciationService = {
  async getByWritingId(writingId: string): Promise<Appreciation[]> {
    return appreciationRepo.findByWritingId(writingId)
  },

  async create(writingId: string, userId: string): Promise<Appreciation> {
    return appreciationRepo.create({ writingId, userId })
  },

  async remove(writingId: string, userId: string): Promise<void> {
    return appreciationRepo.delete(writingId, userId)
  }
}
