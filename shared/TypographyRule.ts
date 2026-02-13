/**
 * Typography rule types — shared between client and server
 *
 * API format: pattern and replacement as strings (serializable).
 * Replacement can use $1, $2 for capture groups.
 *
 * @see documentation/EPICS/editorLayer/Atomics/cni-07-typography-rules-management.json
 */

/** API response / DB record for typography rules */
export interface TypographyRuleRecord {
  id: string
  sortOrder: number
  enabled: boolean
  ruleId: string
  description: string
  pattern: string
  replacement: string
  createdAt: string
  updatedAt: string
}

/** Request body for creating a typography rule */
export interface CreateTypographyRuleRequest {
  ruleId: string
  description: string
  pattern: string
  replacement: string
  sortOrder?: number
}

/** Request body for updating a typography rule */
export interface UpdateTypographyRuleRequest {
  ruleId?: string
  description?: string
  pattern?: string
  replacement?: string
  sortOrder?: number
  enabled?: boolean
}

/** Request body for bulk import (array of rules) */
export interface BulkImportTypographyRequest {
  rules: CreateTypographyRuleRequest[]
}
