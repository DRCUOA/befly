<template>
  <div class="admin-rules-page">
    <!-- Header -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-6xl mx-auto">
        <router-link to="/admin" class="text-xs sm:text-sm text-ink-lighter hover:text-ink mb-2 inline-block">
          ← Back to Admin
        </router-link>
        <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter mb-4">
          Administration
        </p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4">
          Typography Rules
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light">
          Manage typography suggestion rules for the Write page
        </p>
      </div>
    </div>

    <!-- Content -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 bg-paper">
      <div class="max-w-4xl mx-auto">
        <!-- Create and Import buttons -->
        <div class="mb-6 flex flex-wrap gap-3">
          <button
            @click="openCreateForm"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + Add rule
          </button>
          <button
            @click="showImportPanel = !showImportPanel"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
          >
            {{ showImportPanel ? 'Hide import' : 'Import from JSON' }}
          </button>
          <button
            @click="downloadRules"
            :disabled="rules.length === 0"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download rules
          </button>
          <a
            href="/typography-rules-schema.json"
            download="typography-rules-schema.json"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm inline-flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download JSON schema
          </a>
        </div>

        <!-- Import panel -->
        <div v-if="showImportPanel" class="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <h3 class="text-sm font-semibold text-ink mb-2">Import rules from JSON</h3>
          <p class="text-xs text-ink-lighter mb-4">
            Paste a single rule object or an array of rules. Use the schema above for the correct format.
          </p>
          <textarea
            v-model="importJson"
            placeholder='{"ruleId":"teh_to_the","description":"teh > the","pattern":"teh","replacement":"the"}'
            rows="6"
            class="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
          />
          <div v-if="importError" class="mt-2 text-sm text-red-600">{{ importError }}</div>
          <div class="mt-3 flex gap-3">
            <button
              @click="importRules"
              :disabled="importSubmitting || !importJson.trim()"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {{ importSubmitting ? 'Importing...' : 'Import' }}
            </button>
            <button
              @click="importJson = ''; importError = ''"
              class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading rules...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
          <p class="text-red-800">{{ error }}</p>
          <button @click="loadRules" class="mt-3 text-sm text-red-600 hover:text-red-800 underline">
            Try again
          </button>
        </div>

        <!-- Empty state -->
        <div v-else-if="rules.length === 0" class="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center">
          <p class="text-ink-light mb-4">No typography rules yet.</p>
          <p class="text-sm text-ink-lighter mb-4">
            Create rules to suggest typography improvements (smart quotes, em dash, ellipsis, etc.) on the Write page.
          </p>
          <button
            @click="openCreateForm"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + Add rule
          </button>
        </div>

        <!-- Rule list -->
        <div v-else class="space-y-3">
          <div
            v-for="(rule, idx) in rules"
            :key="rule.id"
            class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <!-- Reorder buttons -->
                <div class="flex flex-col gap-0.5 shrink-0">
                  <button
                    @click="moveUp(idx)"
                    :disabled="idx === 0"
                    class="p-1 text-ink-lighter hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    @click="moveDown(idx)"
                    :disabled="idx === rules.length - 1"
                    class="p-1 text-ink-lighter hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-ink">{{ rule.ruleId }}</span>
                    <span
                      v-if="!rule.enabled"
                      class="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600"
                    >
                      disabled
                    </span>
                  </div>
                  <span class="text-sm text-ink-lighter">{{ rule.description }}</span>
                  <div class="flex gap-2 mt-1 text-xs font-mono text-ink-lighter">
                    <span>Pattern: {{ rule.pattern }}</span>
                    <span>→ {{ rule.replacement }}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <!-- Enable/disable toggle -->
                <button
                  @click="toggleEnabled(rule)"
                  class="px-2.5 py-1 text-xs rounded border transition-colors"
                  :class="rule.enabled
                    ? 'border-green-300 text-green-700 hover:bg-green-50'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                >
                  {{ rule.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button
                  @click="openEditForm(rule)"
                  class="px-2.5 py-1 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Edit
                </button>
                <button
                  @click="confirmDelete(rule)"
                  class="px-2.5 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit modal -->
    <div v-if="formModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">{{ formModal.isEdit ? 'Edit rule' : 'Create rule' }}</h3>
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rule ID</label>
            <input
              v-model="formModal.ruleId"
              type="text"
              required
              placeholder="e.g. ellipsis"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              :disabled="formModal.isEdit"
            />
            <p class="text-xs text-ink-lighter mt-0.5">Lowercase, alphanumeric, underscores only</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              v-model="formModal.description"
              type="text"
              required
              placeholder="e.g. Use ellipsis character"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Pattern (regex)</label>
            <input
              v-model="formModal.pattern"
              type="text"
              required
              placeholder="e.g. \\.{3}"
              class="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
            />
            <p class="text-xs text-ink-lighter mt-0.5">JavaScript regex. Use $1, $2 for capture groups in replacement.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Replacement</label>
            <input
              v-model="formModal.replacement"
              type="text"
              required
              placeholder="e.g. … or $1"
              class="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
            />
          </div>
          <div v-if="formError" class="text-sm text-red-600">{{ formError }}</div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              @click="formModal = null"
              class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="formSubmitting"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {{ formSubmitting ? 'Saving...' : (formModal.isEdit ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div v-if="deleteModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-2">Delete rule</h3>
        <p class="text-ink-light mb-1">Are you sure you want to delete this rule?</p>
        <p class="font-medium mb-4">{{ deleteModal.ruleId }}</p>
        <p class="text-sm text-red-600 mb-6">This action cannot be undone.</p>
        <div class="flex justify-end gap-3">
          <button
            @click="deleteModal = null"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            @click="executeDelete"
            :disabled="deleteModal.inProgress"
            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm disabled:opacity-50"
          >
            {{ deleteModal.inProgress ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Success feedback -->
    <div
      v-if="feedbackMessage"
      class="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 bg-green-600 text-white"
    >
      {{ feedbackMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../api/client'
import type { TypographyRuleRecord } from '@shared/TypographyRule'

interface FormModal {
  isEdit: boolean
  id?: string
  ruleId: string
  description: string
  pattern: string
  replacement: string
}

interface DeleteModal {
  id: string
  ruleId: string
  onConfirm: () => Promise<void>
  inProgress: boolean
}

const rules = ref<TypographyRuleRecord[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const formModal = ref<FormModal | null>(null)
const formSubmitting = ref(false)
const formError = ref<string | null>(null)
const deleteModal = ref<DeleteModal | null>(null)
const feedbackMessage = ref<string | null>(null)

// Import
const showImportPanel = ref(false)
const importJson = ref('')
const importError = ref<string | null>(null)
const importSubmitting = ref(false)

interface ImportRuleShape {
  ruleId: string
  description: string
  pattern: string
  replacement: string
  sortOrder?: number
}

function normalizeToRulesArray(input: unknown): ImportRuleShape[] {
  if (Array.isArray(input)) {
    return input.filter((r): r is ImportRuleShape =>
      r && typeof r === 'object' && typeof (r as ImportRuleShape).ruleId === 'string' &&
      typeof (r as ImportRuleShape).description === 'string' &&
      typeof (r as ImportRuleShape).pattern === 'string' &&
      typeof (r as ImportRuleShape).replacement === 'string'
    )
  }
  if (input && typeof input === 'object' && 'ruleId' in input && 'description' in input && 'pattern' in input && 'replacement' in input) {
    return [input as ImportRuleShape]
  }
  return []
}

async function importRules() {
  const raw = importJson.value.trim()
  if (!raw) return

  importError.value = null
  importSubmitting.value = true

  try {
    const parsed = JSON.parse(raw) as unknown
    const toImport = normalizeToRulesArray(parsed)

    if (toImport.length === 0) {
      importError.value = 'Invalid JSON: expected a single rule object or an array of rules with ruleId, description, pattern, replacement'
      return
    }

    const response = await api.post<{ data: { created: number; failed: number; errors?: Array<{ ruleId: string; message: string }> } }>(
      '/admin/typography-rules/import',
      {
        rules: toImport.map((r) => ({
          ruleId: r.ruleId,
          description: r.description,
          pattern: r.pattern,
          replacement: r.replacement,
          ...(r.sortOrder !== undefined && { sortOrder: r.sortOrder })
        }))
      }
    )

    const { created, failed, errors } = response.data ?? { created: 0, failed: 0 }

    if (created > 0) {
      await loadRules()
      showFeedback(`Imported ${created} rule${created === 1 ? '' : 's'}${failed > 0 ? ` (${failed} failed)` : ''}`)
      importJson.value = ''
    }
    if (failed > 0 && created === 0 && errors?.length) {
      importError.value = `All ${failed} rule(s) failed to import. First error: ${errors[0].message}`
    } else if (failed > 0 && created === 0) {
      importError.value = `All ${failed} rule(s) failed to import. Check ruleId format (lowercase, alphanumeric, underscores).`
    }
  } catch (e) {
    importError.value = e instanceof SyntaxError ? 'Invalid JSON syntax' : (e instanceof Error ? e.message : 'Import failed')
  } finally {
    importSubmitting.value = false
  }
}

const loadRules = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await api.get<{ data: TypographyRuleRecord[] }>('/admin/typography-rules')
    rules.value = response.data ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load rules'
  } finally {
    loading.value = false
  }
}

function downloadRules() {
  if (rules.value.length === 0) return
  const exportData = rules.value.map((r) => ({
    ruleId: r.ruleId,
    description: r.description,
    pattern: r.pattern,
    replacement: r.replacement,
    sortOrder: r.sortOrder,
    enabled: r.enabled
  }))
  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'typography-rules.json'
  a.click()
  URL.revokeObjectURL(url)
}

function showFeedback(message: string) {
  feedbackMessage.value = message
  setTimeout(() => {
    feedbackMessage.value = null
  }, 3000)
}

function openCreateForm() {
  formModal.value = {
    isEdit: false,
    ruleId: '',
    description: '',
    pattern: '',
    replacement: ''
  }
  formError.value = null
}

function openEditForm(rule: TypographyRuleRecord) {
  formModal.value = {
    isEdit: true,
    id: rule.id,
    ruleId: rule.ruleId,
    description: rule.description,
    pattern: rule.pattern,
    replacement: rule.replacement
  }
  formError.value = null
}

async function submitForm() {
  if (!formModal.value) return
  formSubmitting.value = true
  formError.value = null
  try {
    if (formModal.value.isEdit && formModal.value.id) {
      await api.put(`/admin/typography-rules/${formModal.value.id}`, {
        ruleId: formModal.value.ruleId,
        description: formModal.value.description,
        pattern: formModal.value.pattern,
        replacement: formModal.value.replacement
      })
      showFeedback('Rule updated')
    } else {
      await api.post('/admin/typography-rules', {
        ruleId: formModal.value.ruleId,
        description: formModal.value.description,
        pattern: formModal.value.pattern,
        replacement: formModal.value.replacement
      })
      showFeedback('Rule created')
    }
    formModal.value = null
    await loadRules()
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Failed to save'
  } finally {
    formSubmitting.value = false
  }
}

async function toggleEnabled(rule: TypographyRuleRecord) {
  try {
    await api.put(`/admin/typography-rules/${rule.id}`, { enabled: !rule.enabled })
    rule.enabled = !rule.enabled
    showFeedback(rule.enabled ? 'Rule enabled' : 'Rule disabled')
  } catch (err) {
    showFeedback(err instanceof Error ? err.message : 'Failed to update')
  }
}

function moveUp(idx: number) {
  if (idx <= 0) return
  const rule = rules.value[idx]
  api
    .post(`/admin/typography-rules/${rule.id}/reorder`, { direction: 'up' })
    .then(() => loadRules())
    .catch((err) => showFeedback(err instanceof Error ? err.message : 'Failed to reorder'))
}

function moveDown(idx: number) {
  if (idx >= rules.value.length - 1) return
  const rule = rules.value[idx]
  api
    .post(`/admin/typography-rules/${rule.id}/reorder`, { direction: 'down' })
    .then(() => loadRules())
    .catch((err) => showFeedback(err instanceof Error ? err.message : 'Failed to reorder'))
}

function confirmDelete(rule: TypographyRuleRecord) {
  deleteModal.value = {
    id: rule.id,
    ruleId: rule.ruleId,
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/typography-rules/${rule.id}`)
        rules.value = rules.value.filter((r) => r.id !== rule.id)
        deleteModal.value = null
        showFeedback('Rule deleted')
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete')
      }
    }
  }
}

async function executeDelete() {
  if (deleteModal.value?.onConfirm) {
    await deleteModal.value.onConfirm()
  }
}

onMounted(() => {
  loadRules()
})
</script>
