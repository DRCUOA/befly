/**
 * Composable to fetch typography rules from API for Write page.
 * Falls back to bundled defaults if API fails or returns empty.
 *
 * @see documentation/EPICS/editorLayer/Atomics/cni-07-typography-rules-management.json
 */

import { ref, onMounted } from 'vue'
import { api } from '../api/client'
import type { TypographyRuleRecord } from '@shared/TypographyRule'
import {
  recordToRule,
  type TypographyRule,
  DEFAULT_TYPOGRAPHY_RULES
} from '../utils/typography-suggestions'

export function useTypographyRules() {
  const rules = ref<TypographyRule[]>(DEFAULT_TYPOGRAPHY_RULES)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function fetchRules() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get<{ data: TypographyRuleRecord[] }>('/typography-rules')
      const records = response.data ?? []
      if (Array.isArray(records) && records.length > 0) {
        rules.value = records.map(recordToRule)
      } else {
        rules.value = DEFAULT_TYPOGRAPHY_RULES
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load typography rules'
      rules.value = DEFAULT_TYPOGRAPHY_RULES
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    fetchRules()
  })

  return { rules, loading, error, refetch: fetchRules }
}
