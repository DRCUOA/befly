import { themeRepo } from '../repositories/theme.repo.js'
import { Theme } from '../models/Theme.js'
import { sanitizeString } from '../utils/sanitize.js'

/**
 * Theme service - business logic layer
 */
export const themeService = {
  async getAll(): Promise<Theme[]> {
    return themeRepo.findAll()
  },

  async getById(id: string): Promise<Theme> {
    return themeRepo.findById(id)
  },

  async create(data: { name: string }): Promise<Theme> {
    const name = sanitizeString(data.name)
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    if (!name) {
      throw new Error('Theme name is required')
    }

    return themeRepo.create({ name, slug })
  }
}
