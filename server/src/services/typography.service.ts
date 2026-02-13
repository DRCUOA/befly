import { typographyRepo } from '../repositories/typography.repo.js'
import type {
  TypographyRuleRecord,
  CreateTypographyRuleRequest,
  UpdateTypographyRuleRequest
} from '@shared/TypographyRule'
import { ValidationError } from '../utils/errors.js'
import { sanitizeString, sanitizePattern, sanitizeReplacementInput } from '../utils/sanitize.js'

/**
 * Validate regex pattern compiles. Store as source; client adds 'g' flag.
 * Basic length limit for ReDoS mitigation.
 */
function validatePattern(pattern: string): void {
  if (!pattern || typeof pattern !== 'string') {
    throw new ValidationError('Pattern is required')
  }
  if (pattern.length > 2000) {
    throw new ValidationError('Pattern must be 2000 characters or less')
  }
  try {
    new RegExp(pattern, 'g')
  } catch {
    throw new ValidationError('Invalid regex pattern')
  }
}

/** Reject script-injection chars; use sanitizeReplacementInput (no trim) for the value. */
function sanitizeReplacement(replacement: string): string {
  const cleaned = sanitizeReplacementInput(replacement)
  if (/[<>]|<\/(script|iframe|object)/i.test(cleaned)) {
    throw new ValidationError('Replacement contains invalid characters')
  }
  return cleaned
}

export const typographyService = {
  async getEnabledRules(): Promise<TypographyRuleRecord[]> {
    return typographyRepo.findAll(true)
  },

  async getAllRules(): Promise<TypographyRuleRecord[]> {
    return typographyRepo.findAll(false)
  },

  async getById(id: string): Promise<TypographyRuleRecord> {
    const rule = await typographyRepo.findById(id)
    if (!rule) throw new ValidationError('Typography rule not found')
    return rule
  },

  async create(data: CreateTypographyRuleRequest): Promise<TypographyRuleRecord> {
    const ruleId = sanitizeString(data.ruleId || '')
    const description = sanitizeString(data.description || '')
    const pattern = sanitizePattern(data.pattern || '')
    const replacement = sanitizeReplacement(data.replacement ?? '')

    if (!ruleId) throw new ValidationError('Rule ID is required')
    if (ruleId.length > 100) throw new ValidationError('Rule ID must be 100 characters or less')
    if (!/^[a-z0-9_]+$/.test(ruleId)) {
      throw new ValidationError('Rule ID must be lowercase alphanumeric with underscores only')
    }
    if (!description) throw new ValidationError('Description is required')
    if (description.length > 500) throw new ValidationError('Description must be 500 characters or less')

    validatePattern(pattern)

    const maxOrder = await this.getMaxSortOrder()
    const sortOrder = data.sortOrder ?? maxOrder + 1

    return typographyRepo.create({
      ruleId,
      description,
      pattern,
      replacement,
      sortOrder
    })
  },

  async update(id: string, data: UpdateTypographyRuleRequest): Promise<TypographyRuleRecord> {
    const updates: Partial<{
      ruleId: string
      description: string
      pattern: string
      replacement: string
      sortOrder: number
      enabled: boolean
    }> = {}

    if (data.ruleId !== undefined) {
      const ruleId = sanitizeString(data.ruleId)
      if (!ruleId) throw new ValidationError('Rule ID cannot be empty')
      if (ruleId.length > 100) throw new ValidationError('Rule ID must be 100 characters or less')
      if (!/^[a-z0-9_]+$/.test(ruleId)) {
        throw new ValidationError('Rule ID must be lowercase alphanumeric with underscores only')
      }
      updates.ruleId = ruleId
    }
    if (data.description !== undefined) {
      const description = sanitizeString(data.description)
      if (!description) throw new ValidationError('Description cannot be empty')
      if (description.length > 500) throw new ValidationError('Description must be 500 characters or less')
      updates.description = description
    }
    if (data.pattern !== undefined) {
      const pattern = sanitizePattern(data.pattern)
      validatePattern(pattern)
      updates.pattern = pattern
    }
    if (data.replacement !== undefined) {
      updates.replacement = sanitizeReplacement(data.replacement)
    }
    if (data.sortOrder !== undefined) {
      updates.sortOrder = Number(data.sortOrder)
      if (!Number.isInteger(updates.sortOrder) || updates.sortOrder < 0) {
        throw new ValidationError('Sort order must be a non-negative integer')
      }
    }
    if (data.enabled !== undefined) {
      updates.enabled = Boolean(data.enabled)
    }

    return typographyRepo.update(id, updates)
  },

  async delete(id: string): Promise<void> {
    return typographyRepo.delete(id)
  },

  async reorder(id: string, direction: 'up' | 'down'): Promise<TypographyRuleRecord[]> {
    const rules = await typographyRepo.findAll(false)
    const idx = rules.findIndex((r) => r.id === id)
    if (idx < 0) throw new ValidationError('Typography rule not found')

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= rules.length) {
      return rules
    }

    const a = rules[idx]
    const b = rules[swapIdx]
    await typographyRepo.update(a.id, { sortOrder: b.sortOrder })
    await typographyRepo.update(b.id, { sortOrder: a.sortOrder })

    return typographyRepo.findAll(false)
  },

  async getMaxSortOrder(): Promise<number> {
    const result = await typographyRepo.findAll(false)
    if (result.length === 0) return 0
    return Math.max(...result.map((r) => r.sortOrder), 0)
  },

  async bulkImport(
    rules: Array<{ ruleId: string; description: string; pattern: string; replacement: string; sortOrder?: number }>
  ): Promise<{ created: number; failed: number; errors: Array<{ ruleId: string; message: string }> }> {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new ValidationError('rules array is required and must not be empty')
    }
    if (rules.length > 500) {
      throw new ValidationError('Cannot import more than 500 rules at once')
    }

    const validRules: Array<{ ruleId: string; description: string; pattern: string; replacement: string; sortOrder: number }> = []
    const errors: Array<{ ruleId: string; message: string }> = []

    let maxOrder = await this.getMaxSortOrder()

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]
      try {
        const ruleId = sanitizeString(r.ruleId || '')
        const description = sanitizeString(r.description || '')
        const pattern = sanitizePattern(r.pattern || '')
        const replacement = sanitizeReplacement(r.replacement ?? '')

        if (!ruleId) throw new ValidationError('Rule ID is required')
        if (ruleId.length > 100) throw new ValidationError('Rule ID must be 100 characters or less')
        if (!/^[a-z0-9_]+$/.test(ruleId)) {
          throw new ValidationError('Rule ID must be lowercase alphanumeric with underscores only')
        }
        if (!description) throw new ValidationError('Description is required')
        if (description.length > 500) throw new ValidationError('Description must be 500 characters or less')

        validatePattern(pattern)

        const sortOrder = r.sortOrder !== undefined ? Number(r.sortOrder) : ++maxOrder
        if (!Number.isInteger(sortOrder) || sortOrder < 0) {
          throw new ValidationError('Sort order must be a non-negative integer')
        }

        validRules.push({ ruleId, description, pattern, replacement, sortOrder })
      } catch (err) {
        errors.push({ ruleId: r.ruleId || `[${i}]`, message: err instanceof ValidationError ? err.message : String(err) })
      }
    }

    const { created, errors: dbErrors } = await typographyRepo.createMany(validRules)
    errors.push(...dbErrors)

    return { created, failed: errors.length, errors }
  }
}
