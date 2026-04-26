<template>
  <div
    class="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
    @click.self="emit('close')"
  >
    <div class="bg-paper w-full sm:max-w-3xl sm:rounded-lg shadow-lg max-h-[92vh] flex flex-col overflow-hidden">
      <header class="px-6 py-4 border-b border-line flex items-center justify-between">
        <div>
          <h2 class="text-lg font-light tracking-tight">Import &middot; Export Essays</h2>
          <p class="text-xs text-ink-lighter mt-1">
            JSON envelope format. Downloadable template included.
          </p>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="p-2 text-ink-lighter hover:text-ink"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </header>

      <!-- Tabs -->
      <nav class="px-6 border-b border-line flex gap-6 text-sm font-sans">
        <button
          v-for="t in tabs"
          :key="t.value"
          type="button"
          @click="activeTab = t.value"
          class="py-3 -mb-px border-b-2 transition-colors"
          :class="activeTab === t.value
            ? 'border-ink text-ink'
            : 'border-transparent text-ink-lighter hover:text-ink'"
        >
          {{ t.label }}
        </button>
      </nav>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        <!-- ─── EXPORT TAB ─── -->
        <section v-if="activeTab === 'export'" class="space-y-5">
          <div>
            <h3 class="text-base font-medium mb-2">Choose scope</h3>
            <div class="space-y-2">
              <label class="flex items-start gap-3 cursor-pointer">
                <input v-model="exportScope" type="radio" value="all" class="mt-1" />
                <span class="text-sm">
                  <span class="font-medium block">All users, all essays</span>
                  <span class="text-ink-light">Every essay in the database. Use carefully on large data.</span>
                </span>
              </label>
              <label class="flex items-start gap-3 cursor-pointer">
                <input v-model="exportScope" type="radio" value="user" class="mt-1" />
                <span class="text-sm flex-1">
                  <span class="font-medium block">A specific user's essays</span>
                  <select
                    v-model="exportUserId"
                    :disabled="exportScope !== 'user'"
                    class="mt-2 block w-full max-w-md rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink disabled:opacity-50"
                  >
                    <option value="">— pick a user —</option>
                    <option v-for="u in users" :key="u.id" :value="u.id">
                      {{ u.displayName || u.email }}
                    </option>
                  </select>
                </span>
              </label>
            </div>
          </div>

          <div v-if="exportScope === 'user' && exportUserId">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-base font-medium">Pick essays (optional)</h3>
              <button
                v-if="userEssays.length > 0"
                type="button"
                class="text-xs text-ink-lighter hover:text-ink"
                @click="toggleSelectAllEssays"
              >
                {{ allEssaysSelected ? 'Clear all' : 'Select all' }}
              </button>
            </div>
            <p class="text-xs text-ink-lighter mb-2">
              Leave none selected to export every essay this user owns.
            </p>
            <div v-if="loadingEssays" class="text-sm text-ink-light italic">Loading essays&hellip;</div>
            <div v-else-if="userEssays.length === 0" class="text-sm text-ink-lighter italic">
              This user has no essays.
            </div>
            <ul v-else class="border border-line rounded max-h-64 overflow-y-auto divide-y divide-line">
              <li v-for="e in userEssays" :key="e.id" class="px-3 py-2">
                <label class="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    :value="e.id"
                    v-model="selectedEssayIds"
                    class="mt-1"
                  />
                  <span class="text-sm flex-1 min-w-0">
                    <span class="font-medium truncate block">{{ e.title }}</span>
                    <span class="text-xs text-ink-lighter">{{ e.bodyLength }} chars · {{ e.visibility }}</span>
                  </span>
                </label>
              </li>
            </ul>
          </div>

          <div class="flex justify-end items-center gap-3 pt-2 border-t border-line">
            <span class="text-xs text-ink-lighter mr-auto">{{ exportSummaryLabel }}</span>
            <a
              :href="exportUrl"
              :download="exportFilename"
              :class="['px-4 py-2 text-sm tracking-wide font-sans transition-colors',
                exportEnabled
                  ? 'bg-ink text-paper hover:bg-ink-light'
                  : 'bg-gray-300 text-gray-500 pointer-events-none']"
              :aria-disabled="!exportEnabled"
              @click="onExportClicked"
            >
              Download .json
            </a>
          </div>
        </section>

        <!-- ─── IMPORT TAB ─── -->
        <section v-if="activeTab === 'import'" class="space-y-5">
          <div>
            <h3 class="text-base font-medium mb-2">Pick a JSON file</h3>
            <input
              type="file"
              accept="application/json,.json"
              @change="onFileChosen"
              class="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-ink file:text-paper file:rounded file:cursor-pointer hover:file:bg-ink-light"
            />
            <p v-if="parseError" class="mt-2 text-sm text-red-700">{{ parseError }}</p>
          </div>

          <div v-if="parsedEnvelope" class="space-y-4">
            <div class="bg-surface/50 border border-line rounded p-4 text-sm">
              <p class="font-medium">{{ parsedEnvelope.scopeLabel || 'Imported envelope' }}</p>
              <p class="text-ink-light mt-1">
                {{ parsedEnvelope.essays.length }} essay(s),
                {{ parsedEnvelope.themes.length }} theme(s)
                · version {{ parsedEnvelope.version }}
                · exported {{ formatDate(parsedEnvelope.exportedAt) }}
              </p>
            </div>

            <div>
              <h3 class="text-base font-medium mb-2">Who should own these essays?</h3>
              <div class="space-y-2">
                <label class="flex items-start gap-3 cursor-pointer">
                  <input v-model="importOwnership" type="radio" value="self" class="mt-1" />
                  <span class="text-sm">
                    <span class="font-medium block">Me ({{ adminDisplayName }})</span>
                    <span class="text-ink-light">All imported essays will be created on my account.</span>
                  </span>
                </label>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input v-model="importOwnership" type="radio" value="target" class="mt-1" />
                  <span class="text-sm flex-1">
                    <span class="font-medium block">Another user</span>
                    <select
                      v-model="importTargetUserId"
                      :disabled="importOwnership !== 'target'"
                      class="mt-2 block w-full max-w-md rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink disabled:opacity-50"
                    >
                      <option value="">— pick a user —</option>
                      <option v-for="u in users" :key="u.id" :value="u.id">
                        {{ u.displayName || u.email }}
                      </option>
                    </select>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <h3 class="text-base font-medium mb-2">Pick essays to import (optional)</h3>
              <p class="text-xs text-ink-lighter mb-2">
                Leave none selected to import everything in the file.
              </p>
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-ink-lighter">{{ selectedImportIds.length }} of {{ parsedEnvelope.essays.length }} selected</span>
                <button
                  type="button"
                  class="text-xs text-ink-lighter hover:text-ink"
                  @click="toggleSelectAllImport"
                >
                  {{ allImportSelected ? 'Clear all' : 'Select all' }}
                </button>
              </div>
              <ul class="border border-line rounded max-h-56 overflow-y-auto divide-y divide-line">
                <li v-for="e in parsedEnvelope.essays" :key="e.id" class="px-3 py-2">
                  <label class="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      :value="e.id"
                      v-model="selectedImportIds"
                      class="mt-1"
                    />
                    <span class="text-sm flex-1 min-w-0">
                      <span class="font-medium truncate block">{{ e.title }}</span>
                      <span class="text-xs text-ink-lighter">
                        {{ e.body.length }} chars · {{ e.visibility }}
                        <span v-if="e.themeIds.length > 0">· {{ e.themeIds.length }} theme(s)</span>
                      </span>
                    </span>
                  </label>
                </li>
              </ul>
            </div>

            <div v-if="importError" class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              {{ importError }}
            </div>

            <div v-if="importResult" class="space-y-3">
              <div class="bg-green-50 border border-green-200 rounded p-3 text-sm">
                <p class="font-medium text-green-900">Import complete</p>
                <p class="text-green-800 mt-1">
                  {{ importResult.created.length }} of {{ importResult.total }} essays created.
                  {{ importResult.themes.filter(t => t.created).length }} new theme(s).
                  {{ importResult.errors.length }} error(s).
                </p>
              </div>
              <details v-if="importResult.errors.length > 0">
                <summary class="text-xs text-red-700 cursor-pointer">Show {{ importResult.errors.length }} error(s)</summary>
                <ul class="mt-2 text-xs text-red-700 space-y-1">
                  <li v-for="(e, idx) in importResult.errors" :key="idx">
                    <span class="font-medium">{{ e.title || e.sourceId }}</span>: {{ e.error }}
                  </li>
                </ul>
              </details>
            </div>

            <div class="flex justify-end items-center gap-3 pt-2 border-t border-line">
              <button
                type="button"
                @click="resetImport"
                class="px-3 py-2 text-sm tracking-wide font-sans text-ink-light hover:text-ink"
              >
                Reset
              </button>
              <button
                type="button"
                :disabled="!importEnabled || importing"
                @click="runImport"
                class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light disabled:opacity-50 transition-colors"
              >
                {{ importing ? 'Importing…' : 'Import' }}
              </button>
            </div>
          </div>
        </section>

        <!-- ─── TEMPLATE TAB ─── -->
        <section v-if="activeTab === 'template'" class="space-y-4">
          <div class="prose prose-sm">
            <p>
              The export and import use a single JSON envelope. Download the template to see
              the exact shape the importer expects, with realistic example data and an inline
              <code>_documentation</code> block that explains every field.
            </p>
            <p>
              The template is the same shape produced by the export tool. You can drop a
              real export file straight into the import tab without modification.
            </p>
            <ul class="list-disc pl-6 text-ink-light text-sm space-y-1">
              <li>Themes travel inline; the importer finds-or-creates them by name on the target account.</li>
              <li>Essay IDs are advisory; the importer always assigns fresh UUIDs.</li>
              <li>Cover image URLs are preserved as references. The actual image files are not embedded.</li>
            </ul>
          </div>
          <div class="flex">
            <a
              :href="templateUrl"
              download="essays-import-template.json"
              class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
            >
              Download template
            </a>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../../api/client'
import { adminApi } from '../../api/admin'
import { useAuth } from '../../stores/auth'
import type { User } from '../../domain/User'
import type {
  EssayExportEnvelope,
  EssayImportOptions,
  EssayImportResult,
} from '@shared/EssayExport'

const emit = defineEmits<{ (e: 'close'): void }>()

const { user: authUser } = useAuth()
const adminDisplayName = computed(() => authUser.value?.displayName || authUser.value?.email || 'me')

const tabs = [
  { value: 'export',   label: 'Export' },
  { value: 'import',   label: 'Import' },
  { value: 'template', label: 'Template' },
] as const
type TabValue = typeof tabs[number]['value']
const activeTab = ref<TabValue>('export')

/* ───────── Users (used by both Export and Import for user pickers) ───────── */
interface AdminUserListResponse { data: User[] }
const users = ref<User[]>([])
async function loadUsers() {
  try {
    const r = await api.get<AdminUserListResponse>('/admin/users', { params: { limit: '500' } })
    users.value = r.data
  } catch {
    users.value = []
  }
}

/* ───────── EXPORT state ───────── */
const exportScope = ref<'all' | 'user'>('all')
const exportUserId = ref<string>('')
const userEssays = ref<{ id: string; title: string; visibility: string; bodyLength: number }[]>([])
const loadingEssays = ref(false)
const selectedEssayIds = ref<string[]>([])

watch([exportScope, exportUserId], async () => {
  selectedEssayIds.value = []
  userEssays.value = []
  if (exportScope.value === 'user' && exportUserId.value) {
    loadingEssays.value = true
    try {
      const r = await api.get<{ data: { writings: { id: string; title: string; visibility: string; bodyLength: number }[] } }>(
        `/admin/users/${exportUserId.value}/content`
      )
      userEssays.value = r.data.writings.map(w => ({
        id: w.id, title: w.title, visibility: w.visibility, bodyLength: w.bodyLength,
      }))
    } catch {
      userEssays.value = []
    } finally {
      loadingEssays.value = false
    }
  }
})

const allEssaysSelected = computed(() =>
  userEssays.value.length > 0 && selectedEssayIds.value.length === userEssays.value.length
)
function toggleSelectAllEssays() {
  selectedEssayIds.value = allEssaysSelected.value
    ? []
    : userEssays.value.map(e => e.id)
}

const exportEnabled = computed(() => {
  if (exportScope.value === 'all') return true
  if (exportScope.value === 'user' && exportUserId.value) return true
  return false
})
const exportUrl = computed(() => {
  if (!exportEnabled.value) return '#'
  const opts: { userId?: string; ids?: string[] } = {}
  if (exportScope.value === 'user') opts.userId = exportUserId.value
  if (selectedEssayIds.value.length > 0) opts.ids = selectedEssayIds.value
  return adminApi.buildEssayExportUrl(opts)
})
const exportFilename = computed(() => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  if (exportScope.value === 'all') return `essays-export-all-${stamp}.json`
  const u = users.value.find(u => u.id === exportUserId.value)
  const slug = (u?.displayName || u?.email || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)
  if (selectedEssayIds.value.length > 0) return `essays-export-${slug}-subset-${stamp}.json`
  return `essays-export-${slug}-${stamp}.json`
})
const exportSummaryLabel = computed(() => {
  if (!exportEnabled.value) return 'Choose a scope to enable'
  if (exportScope.value === 'all') return 'Will export every essay from every user'
  if (selectedEssayIds.value.length > 0) {
    return `Will export ${selectedEssayIds.value.length} selected essay(s)`
  }
  return `Will export every essay from this user (${userEssays.value.length})`
})
function onExportClicked(e: MouseEvent) {
  if (!exportEnabled.value) e.preventDefault()
}

/* ───────── IMPORT state ───────── */
const parsedEnvelope = ref<EssayExportEnvelope | null>(null)
const parseError = ref<string | null>(null)
const importOwnership = ref<'self' | 'target'>('self')
const importTargetUserId = ref<string>('')
const selectedImportIds = ref<string[]>([])
const importing = ref(false)
const importError = ref<string | null>(null)
const importResult = ref<EssayImportResult | null>(null)

function resetImport() {
  parsedEnvelope.value = null
  parseError.value = null
  selectedImportIds.value = []
  importResult.value = null
  importError.value = null
}

function onFileChosen(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  resetImport()
  if (!file) return
  const reader = new FileReader()
  reader.onerror = () => { parseError.value = 'Could not read file' }
  reader.onload = () => {
    const text = String(reader.result ?? '')
    try {
      const parsed = JSON.parse(text)
      // Quick shape check before handing to the server.
      if (!parsed || parsed.type !== 'essays' || !Array.isArray(parsed.essays)) {
        parseError.value = 'This file is not a valid essays export envelope.'
        return
      }
      parsedEnvelope.value = parsed as EssayExportEnvelope
    } catch (err) {
      parseError.value = err instanceof Error ? `Could not parse JSON: ${err.message}` : 'Could not parse JSON'
    }
  }
  reader.readAsText(file)
}

const allImportSelected = computed(() =>
  parsedEnvelope.value !== null
  && selectedImportIds.value.length === parsedEnvelope.value.essays.length
  && parsedEnvelope.value.essays.length > 0
)
function toggleSelectAllImport() {
  if (!parsedEnvelope.value) return
  selectedImportIds.value = allImportSelected.value
    ? []
    : parsedEnvelope.value.essays.map(e => e.id)
}

const importEnabled = computed(() => {
  if (!parsedEnvelope.value) return false
  if (importOwnership.value === 'target' && !importTargetUserId.value) return false
  return true
})

async function runImport() {
  if (!parsedEnvelope.value) return
  importing.value = true
  importError.value = null
  importResult.value = null
  try {
    const options: EssayImportOptions = { ownership: importOwnership.value }
    if (importOwnership.value === 'target') options.targetUserId = importTargetUserId.value
    if (selectedImportIds.value.length > 0) options.onlyEssayIds = selectedImportIds.value
    importResult.value = await adminApi.importEssays(parsedEnvelope.value, options)
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Import failed'
  } finally {
    importing.value = false
  }
}

/* ───────── TEMPLATE ───────── */
const templateUrl = adminApi.essayImportTemplateUrl()

/* ───────── helpers ───────── */
function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

onMounted(loadUsers)
</script>
