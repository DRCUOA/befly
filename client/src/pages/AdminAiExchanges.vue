<template>
  <div class="admin-ai-exchanges-page">
    <!-- Header -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-6xl mx-auto">
        <router-link to="/admin" class="text-xs sm:text-sm text-ink-lighter hover:text-ink mb-2 inline-block">
          ← Back to Admin
        </router-link>
        <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter mb-4">
          Administration · Diagnostic
        </p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4">
          AI exchanges
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light">
          The actual prompts the app sent to the LLM and the raw responses that came back.
          Temporary measure for triaging the AI layer.
        </p>
      </div>
    </div>

    <!-- Content -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 bg-paper">
      <div class="max-w-6xl mx-auto">

        <!-- Filters -->
        <div class="mb-6 flex flex-wrap items-end gap-3 bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
          <div class="flex flex-col">
            <label class="text-xs uppercase tracking-wider text-ink-lighter mb-1">Feature</label>
            <select
              v-model="filterFeature"
              class="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              @change="reload"
            >
              <option value="">All</option>
              <option value="writing-assist">writing-assist</option>
              <option value="manuscript-assist">manuscript-assist</option>
            </select>
          </div>
          <div class="flex flex-col">
            <label class="text-xs uppercase tracking-wider text-ink-lighter mb-1">Status</label>
            <select
              v-model="filterStatus"
              class="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              @change="reload"
            >
              <option value="">All</option>
              <option value="ok">ok</option>
              <option value="error">error</option>
            </select>
          </div>
          <div class="flex flex-col">
            <label class="text-xs uppercase tracking-wider text-ink-lighter mb-1">Page size</label>
            <select
              v-model.number="limit"
              class="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              @change="reload"
            >
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="200">200</option>
            </select>
          </div>
          <button
            @click="reload"
            :disabled="loading"
            class="ml-auto px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <!-- Loading / Error -->
        <div v-if="loading && exchanges.length === 0" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading exchanges...</p>
        </div>
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
          <p class="text-red-800">{{ error }}</p>
          <button @click="reload" class="mt-3 text-sm text-red-600 hover:text-red-800 underline">Try again</button>
        </div>

        <!-- Empty state -->
        <div v-else-if="exchanges.length === 0" class="bg-white rounded-lg border border-gray-100 p-10 text-center">
          <p class="text-ink-lighter">No exchanges recorded yet for this filter.</p>
          <p class="text-xs text-ink-lighter mt-2">
            Trigger an AI assist mode (Write or Manuscripts page) and refresh.
          </p>
        </div>

        <!-- List -->
        <template v-else>
          <p class="text-xs text-ink-lighter mb-3">
            Showing {{ exchanges.length }} of {{ total.toLocaleString() }}
            <span v-if="filterFeature || filterStatus">(filtered)</span>
          </p>

          <div class="space-y-3">
            <div
              v-for="ex in exchanges"
              :key="ex.id"
              class="bg-white rounded-lg shadow-sm border overflow-hidden"
              :class="ex.status === 'error' ? 'border-red-200' : 'border-gray-100'"
            >
              <!-- Summary row (always visible) -->
              <div
                class="px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                @click="toggleExpand(ex.id)"
              >
                <!-- Chevron + status -->
                <div class="flex items-center gap-2 flex-shrink-0">
                  <svg
                    class="w-4 h-4 text-ink-lighter transition-transform duration-200"
                    :class="{ 'rotate-90': expandedId === ex.id }"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <span
                    class="px-2 py-0.5 text-xs rounded font-medium uppercase tracking-wide"
                    :class="ex.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                  >
                    {{ ex.status }}
                  </span>
                </div>

                <!-- Feature + mode -->
                <div class="flex items-center gap-2 flex-shrink-0 min-w-0">
                  <span class="text-sm font-medium text-ink">{{ ex.feature }}</span>
                  <span v-if="ex.mode" class="text-xs text-ink-lighter px-1.5 py-0.5 bg-gray-100 rounded">
                    {{ ex.mode }}
                  </span>
                </div>

                <!-- Model -->
                <code class="text-xs text-ink-lighter px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded flex-shrink-0">
                  {{ ex.model }}
                </code>

                <!-- HTTP / tokens / time -->
                <div class="flex items-center gap-3 text-xs text-ink-lighter flex-wrap">
                  <span v-if="ex.httpStatus !== null">HTTP {{ ex.httpStatus }}</span>
                  <span>{{ ex.durationMs }}ms</span>
                  <span v-if="ex.totalTokens !== null">{{ ex.totalTokens }} tok</span>
                  <span v-if="ex.requestChars">{{ ex.requestChars.toLocaleString() }} → {{ ex.responseChars.toLocaleString() }} chars</span>
                </div>

                <!-- When -->
                <div class="ml-auto flex items-center gap-3 text-xs text-ink-lighter flex-shrink-0">
                  <span>{{ formatRelativeTime(ex.createdAt) }}</span>
                </div>
              </div>

              <!-- Error preview (always visible if error) -->
              <div
                v-if="ex.status === 'error' && ex.errorMessage && expandedId !== ex.id"
                class="px-4 pb-3 text-xs text-red-700 italic border-t border-red-100 bg-red-50/40"
              >
                <span class="font-mono">{{ ex.errorMessage }}</span>
              </div>

              <!-- Expanded payload -->
              <div v-if="expandedId === ex.id" class="border-t border-gray-100 px-4 py-4 space-y-5 bg-gray-50/40">
                <!-- Provenance -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div class="uppercase tracking-wider text-ink-lighter mb-0.5">Created at</div>
                    <div class="text-ink font-mono">{{ formatFullDate(ex.createdAt) }}</div>
                  </div>
                  <div>
                    <div class="uppercase tracking-wider text-ink-lighter mb-0.5">User</div>
                    <div class="text-ink font-mono break-all">{{ ex.userId || '—' }}</div>
                  </div>
                  <div>
                    <div class="uppercase tracking-wider text-ink-lighter mb-0.5">Resource</div>
                    <div class="text-ink font-mono break-all">
                      <span v-if="ex.resourceType">{{ ex.resourceType }}/</span>{{ ex.resourceId || '—' }}
                    </div>
                  </div>
                  <div>
                    <div class="uppercase tracking-wider text-ink-lighter mb-0.5">Knobs</div>
                    <div class="text-ink font-mono">
                      <span v-if="ex.temperature !== null">temp={{ ex.temperature }}</span>
                      <span v-else>temp=(reasoning)</span>
                      <span v-if="ex.maxOutputTokens !== null"> · max={{ ex.maxOutputTokens }}</span>
                    </div>
                  </div>
                </div>

                <!-- Tokens -->
                <div v-if="ex.promptTokens !== null || ex.completionTokens !== null || ex.totalTokens !== null"
                     class="text-xs text-ink-lighter flex flex-wrap gap-4">
                  <span>prompt tokens: <span class="text-ink font-mono">{{ ex.promptTokens ?? '—' }}</span></span>
                  <span>completion tokens: <span class="text-ink font-mono">{{ ex.completionTokens ?? '—' }}</span></span>
                  <span>total tokens: <span class="text-ink font-mono">{{ ex.totalTokens ?? '—' }}</span></span>
                </div>

                <!-- Error message -->
                <div v-if="ex.errorMessage" class="bg-red-50 border border-red-200 rounded p-3 text-xs">
                  <div class="uppercase tracking-wider text-red-700 mb-1">Error</div>
                  <pre class="text-red-800 whitespace-pre-wrap break-words font-mono">{{ ex.errorMessage }}</pre>
                </div>

                <!-- System prompt -->
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <h4 class="text-xs uppercase tracking-wider text-ink-lighter">System prompt</h4>
                    <button
                      class="text-xs text-blue-600 hover:text-blue-800"
                      @click="copyToClipboard(ex.systemPrompt, 'System prompt')"
                    >
                      Copy
                    </button>
                  </div>
                  <pre class="bg-white border border-gray-200 rounded p-3 text-xs text-ink whitespace-pre-wrap break-words max-h-64 overflow-auto font-mono">{{ ex.systemPrompt }}</pre>
                </div>

                <!-- User prompt -->
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <h4 class="text-xs uppercase tracking-wider text-ink-lighter">User prompt</h4>
                    <button
                      class="text-xs text-blue-600 hover:text-blue-800"
                      @click="copyToClipboard(ex.userPrompt, 'User prompt')"
                    >
                      Copy
                    </button>
                  </div>
                  <pre class="bg-white border border-gray-200 rounded p-3 text-xs text-ink whitespace-pre-wrap break-words max-h-96 overflow-auto font-mono">{{ ex.userPrompt }}</pre>
                </div>

                <!-- Raw response -->
                <div v-if="ex.responseRaw">
                  <div class="flex items-center justify-between mb-1">
                    <h4 class="text-xs uppercase tracking-wider text-ink-lighter">Raw response body</h4>
                    <button
                      class="text-xs text-blue-600 hover:text-blue-800"
                      @click="copyToClipboard(ex.responseRaw || '', 'Raw response')"
                    >
                      Copy
                    </button>
                  </div>
                  <pre class="bg-white border border-gray-200 rounded p-3 text-xs text-ink whitespace-pre-wrap break-words max-h-96 overflow-auto font-mono">{{ ex.responseRaw }}</pre>
                </div>

                <!-- Parsed JSON -->
                <div v-if="ex.responseJson">
                  <div class="flex items-center justify-between mb-1">
                    <h4 class="text-xs uppercase tracking-wider text-ink-lighter">Parsed JSON</h4>
                    <button
                      class="text-xs text-blue-600 hover:text-blue-800"
                      @click="copyToClipboard(prettyJson(ex.responseJson), 'Parsed JSON')"
                    >
                      Copy
                    </button>
                  </div>
                  <pre class="bg-white border border-gray-200 rounded p-3 text-xs text-ink whitespace-pre-wrap break-words max-h-96 overflow-auto font-mono">{{ prettyJson(ex.responseJson) }}</pre>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div class="mt-6 flex items-center justify-between">
            <button
              @click="prevPage"
              :disabled="offset === 0 || loading"
              class="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ← Newer
            </button>
            <span class="text-xs text-ink-lighter">
              Showing {{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}
            </span>
            <button
              @click="nextPage"
              :disabled="offset + limit >= total || loading"
              class="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Older →
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Toast -->
    <div
      v-if="toast"
      class="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 bg-gray-800 text-white"
    >
      {{ toast }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../api/client'

interface AiExchange {
  id: string
  userId: string | null
  feature: string
  mode: string | null
  resourceType: string | null
  resourceId: string | null
  provider: string
  model: string
  temperature: number | null
  maxOutputTokens: number | null
  systemPrompt: string
  userPrompt: string
  requestChars: number
  status: 'ok' | 'error'
  httpStatus: number | null
  responseRaw: string | null
  responseJson: unknown | null
  responseChars: number
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  durationMs: number
  errorMessage: string | null
  createdAt: string
}

interface ListResponse {
  data: AiExchange[]
  meta: { total: number; limit: number; offset: number }
}

const exchanges = ref<AiExchange[]>([])
const total = ref(0)
const limit = ref(25)
const offset = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const filterFeature = ref('')
const filterStatus = ref<'' | 'ok' | 'error'>('')

const expandedId = ref<string | null>(null)
const toast = ref<string | null>(null)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const params: Record<string, string> = {
      limit: String(limit.value),
      offset: String(offset.value),
    }
    if (filterFeature.value) params.feature = filterFeature.value
    if (filterStatus.value) params.status = filterStatus.value
    const res = await api.get<ListResponse>('/admin/ai-exchanges', { params })
    exchanges.value = res.data
    total.value = res.meta.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load AI exchanges'
  } finally {
    loading.value = false
  }
}

// Reset to page 0 when filters change.
const reload = () => {
  offset.value = 0
  load()
}

const nextPage = () => {
  offset.value += limit.value
  load()
}

const prevPage = () => {
  offset.value = Math.max(0, offset.value - limit.value)
  load()
}

const toggleExpand = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id
}

const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const formatFullDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString()
}

const prettyJson = (val: unknown): string => {
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

const showToast = (message: string) => {
  toast.value = message
  setTimeout(() => { toast.value = null }, 1800)
}

const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showToast(`${label} copied`)
  } catch {
    showToast('Copy failed')
  }
}

onMounted(load)
</script>

<style scoped>
.admin-ai-exchanges-page {
  min-height: 100vh;
}
</style>
