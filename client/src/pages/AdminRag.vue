<template>
  <div class="admin-rag-page">
    <!-- Header -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-6xl mx-auto">
        <router-link to="/admin" class="text-xs sm:text-sm text-ink-lighter hover:text-ink mb-2 inline-block">
          ← Back to Admin
        </router-link>
        <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter mb-4">
          Administration · Manuscript RAG
        </p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4">
          Manuscript context &amp; retrieval
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light">
          Index a manuscript so AI assist can retrieve from its compiled context.
          Every operation is scoped to one manuscript at a time —
          retrieval never crosses the boundary.
        </p>
      </div>
    </div>

    <!-- Content -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 bg-paper">
      <div class="max-w-6xl mx-auto">

        <!-- Manuscript picker -->
        <div class="mb-6 bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
          <div class="flex items-end gap-3 flex-wrap">
            <div class="flex-1 min-w-[280px]">
              <label class="block text-xs uppercase tracking-wider text-ink-lighter mb-1">Manuscript</label>
              <select
                v-model="selectedId"
                class="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                @change="onManuscriptChange"
              >
                <option value="">— Choose a manuscript —</option>
                <option v-for="m in manuscripts" :key="m.id" :value="m.id">
                  {{ m.title }} · {{ m.ownerDisplayName || m.ownerEmail || m.userId.slice(0, 8) }}
                  · sources {{ m.contextSources }} / chunks {{ m.contextChunks }} / vectors {{ m.contextEmbeddings }}
                </option>
              </select>
            </div>
            <button
              @click="loadManuscripts"
              :disabled="manuscriptsLoading"
              class="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {{ manuscriptsLoading ? 'Refreshing…' : 'Refresh list' }}
            </button>
          </div>
          <p v-if="selectedManuscript" class="text-xs text-ink-lighter mt-2">
            Manuscript ID: <code class="font-mono">{{ selectedManuscript.id }}</code> ·
            Form: {{ selectedManuscript.form }} ·
            Status: {{ selectedManuscript.status }} ·
            AI exchanges so far: {{ selectedManuscript.aiExchanges }}
          </p>
        </div>

        <div v-if="!selectedId" class="bg-white rounded-lg border border-gray-100 p-10 text-center">
          <p class="text-ink-lighter">Pick a manuscript above to begin.</p>
        </div>

        <template v-else>
          <!-- Stats + actions -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm text-center">
              <p class="text-xs uppercase tracking-wider text-ink-lighter">Context sources</p>
              <p class="text-2xl font-semibold mt-1">{{ stats?.sources ?? '—' }}</p>
            </div>
            <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm text-center">
              <p class="text-xs uppercase tracking-wider text-ink-lighter">Chunks</p>
              <p class="text-2xl font-semibold mt-1">{{ stats?.chunks ?? '—' }}</p>
            </div>
            <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm text-center">
              <p class="text-xs uppercase tracking-wider text-ink-lighter">Embeddings</p>
              <p class="text-2xl font-semibold mt-1">{{ stats?.embeddings ?? '—' }}</p>
            </div>
          </div>

          <!-- Pipeline controls -->
          <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm mb-6">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 class="text-lg font-medium">Pipeline</h2>
              <label class="text-xs flex items-center gap-1 text-ink-light">
                <input type="checkbox" v-model="forceFlag" />
                Force (rewrite even if hashes match)
              </label>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                @click="runStep('compile')"
                :disabled="busy"
                class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >Compile</button>
              <button
                @click="runStep('chunk')"
                :disabled="busy"
                class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >Chunk</button>
              <button
                @click="runStep('embed')"
                :disabled="busy"
                class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >Embed</button>
              <button
                @click="runStep('reindex')"
                :disabled="busy"
                class="px-3 py-1.5 text-sm border border-blue-500 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50"
              >Reindex (compile + chunk + embed)</button>
              <span v-if="busy" class="text-sm text-ink-lighter">{{ busyLabel }}…</span>
            </div>
            <div v-if="lastOutcome" class="mt-3 text-xs">
              <p class="text-ink-lighter mb-1">Last result:</p>
              <pre class="bg-gray-50 border border-gray-100 rounded p-2 overflow-x-auto">{{ lastOutcome }}</pre>
            </div>
            <p v-if="errorMessage" class="mt-3 text-sm text-red-600">{{ errorMessage }}</p>
            <p class="mt-3 text-xs text-ink-lighter">
              Embed makes outbound calls to OpenAI and may take many seconds for a large manuscript.
              The page is unresponsive while a step is running.
            </p>
          </div>

          <!-- Search -->
          <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm mb-6">
            <h2 class="text-lg font-medium mb-3">Search</h2>
            <form @submit.prevent="runSearch" class="flex flex-wrap gap-2 items-end">
              <div class="flex-1 min-w-[240px]">
                <label class="block text-xs uppercase tracking-wider text-ink-lighter mb-1">Query</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="e.g. voice guide for Marcus"
                  class="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label class="block text-xs uppercase tracking-wider text-ink-lighter mb-1">Top K</label>
                <input
                  v-model.number="searchTopK"
                  type="number"
                  min="1"
                  max="50"
                  class="w-20 text-sm border border-gray-200 rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label class="block text-xs uppercase tracking-wider text-ink-lighter mb-1">Max tokens</label>
                <input
                  v-model.number="searchMaxTokens"
                  type="number"
                  min="100"
                  max="20000"
                  class="w-28 text-sm border border-gray-200 rounded px-2 py-1.5"
                />
              </div>
              <label class="text-xs flex items-center gap-1 text-ink-light">
                <input type="checkbox" v-model="searchIncludeArchived" />
                Include archived
              </label>
              <button
                type="submit"
                :disabled="busy || !searchQuery.trim()"
                class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >Search</button>
            </form>

            <div v-if="searchResult" class="mt-4">
              <p class="text-xs text-ink-lighter mb-2">
                {{ searchResult.chunks.length }} chunk(s) returned for query
                <code class="font-mono">"{{ searchResult.query }}"</code>
              </p>
              <div v-if="searchResult.chunks.length === 0" class="text-sm text-ink-lighter">
                No matches. The manuscript may not be indexed yet — run Reindex first.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="c in searchResult.chunks"
                  :key="c.chunkId"
                  class="border border-gray-100 rounded p-3 bg-gray-50"
                >
                  <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <p class="text-sm font-medium">{{ c.title }}</p>
                    <p class="text-xs text-ink-lighter">
                      {{ c.sourceType }} · {{ c.contextRole }} · score {{ c.score.toFixed(3) }}
                    </p>
                  </div>
                  <p class="text-xs whitespace-pre-wrap text-ink-light">{{ c.text }}</p>
                </div>
              </div>

              <details v-if="searchResult.chunks.length > 0" class="mt-3">
                <summary class="text-xs text-ink-lighter cursor-pointer">Rendered context pack</summary>
                <pre class="text-xs bg-gray-50 border border-gray-100 rounded p-2 overflow-x-auto mt-1 whitespace-pre-wrap">{{ searchResult.contextPack }}</pre>
              </details>
            </div>
          </div>

          <!-- Context sources -->
          <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm mb-6">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 class="text-lg font-medium">Context sources</h2>
              <div class="flex items-center gap-3">
                <label class="text-xs flex items-center gap-1 text-ink-light">
                  <input type="checkbox" v-model="includeArchived" @change="loadSources" />
                  Show archived/superseded
                </label>
                <button
                  @click="loadSources"
                  :disabled="sourcesLoading"
                  class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >{{ sourcesLoading ? 'Loading…' : 'Refresh' }}</button>
              </div>
            </div>
            <div v-if="sources.length === 0" class="text-sm text-ink-lighter">
              No sources yet. Run Compile or Reindex.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-xs uppercase tracking-wider text-ink-lighter">
                  <tr class="border-b border-gray-100">
                    <th class="text-left py-2 pr-2">Title</th>
                    <th class="text-left py-2 pr-2">Type</th>
                    <th class="text-left py-2 pr-2">Role</th>
                    <th class="text-left py-2 pr-2">Status</th>
                    <th class="text-left py-2 pr-2">Canon</th>
                    <th class="text-left py-2 pr-2">Pri</th>
                    <th class="text-left py-2 pr-2">Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in sources" :key="s.id" class="border-b border-gray-50">
                    <td class="py-2 pr-2">
                      <div class="font-medium">{{ s.title }}</div>
                      <details>
                        <summary class="text-xs text-ink-lighter cursor-pointer">body ({{ (s.body?.length ?? 0).toLocaleString() }} chars)</summary>
                        <pre class="text-xs whitespace-pre-wrap mt-1">{{ s.body }}</pre>
                      </details>
                    </td>
                    <td class="py-2 pr-2 text-xs"><code class="font-mono">{{ s.sourceType }}</code></td>
                    <td class="py-2 pr-2 text-xs">{{ s.contextRole }}</td>
                    <td class="py-2 pr-2 text-xs">{{ s.status }}</td>
                    <td class="py-2 pr-2 text-xs">{{ s.canonical ? 'yes' : '—' }}</td>
                    <td class="py-2 pr-2 text-xs">{{ s.priority }}</td>
                    <td class="py-2 pr-2 text-xs">{{ formatRelativeTime(s.updatedAt) }}</td>
                    <td class="py-2">
                      <button
                        @click="confirmDeleteSource(s)"
                        class="text-xs text-red-600 hover:text-red-800"
                        title="Hard-delete this source row (chunks + embeddings cascade)"
                      >Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Uploaded files -->
          <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm mb-6">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 class="text-lg font-medium">Uploaded files</h2>
              <button
                @click="loadUploadedFiles"
                :disabled="uploadsLoading"
                class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >{{ uploadsLoading ? 'Loading…' : 'Refresh' }}</button>
            </div>
            <p class="text-xs text-ink-lighter mb-3">
              Files belong to the manuscript's owner. Attach them here so the compiler can include
              them in the manuscript's context. File body extraction (PDF, DOCX) is not yet
              implemented — attached files appear as metadata-only context sources.
            </p>
            <div v-if="uploadedFiles.length === 0" class="text-sm text-ink-lighter">
              The manuscript's owner has no uploaded files.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-xs uppercase tracking-wider text-ink-lighter">
                  <tr class="border-b border-gray-100">
                    <th class="text-left py-2 pr-2">Filename</th>
                    <th class="text-left py-2 pr-2">Type</th>
                    <th class="text-left py-2 pr-2">Size</th>
                    <th class="text-left py-2 pr-2">Attached?</th>
                    <th class="text-left py-2 pr-2">Role</th>
                    <th class="text-left py-2 pr-2">Include in AI</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="f in uploadedFiles" :key="f.id" class="border-b border-gray-50">
                    <td class="py-2 pr-2 font-mono text-xs">{{ f.filename }}</td>
                    <td class="py-2 pr-2 text-xs">{{ f.contentType }}</td>
                    <td class="py-2 pr-2 text-xs">{{ formatBytes(f.sizeBytes) }}</td>
                    <td class="py-2 pr-2 text-xs">{{ f.attached ? 'yes' : 'no' }}</td>
                    <td class="py-2 pr-2 text-xs">
                      <select
                        v-model="rolePerFile[f.id]"
                        class="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                        :disabled="!f.attached"
                      >
                        <option value="supporting">supporting</option>
                        <option value="research">research</option>
                        <option value="canon">canon</option>
                        <option value="draft">draft</option>
                        <option value="style">style</option>
                        <option value="voice">voice</option>
                        <option value="plot">plot</option>
                        <option value="character">character</option>
                        <option value="continuity">continuity</option>
                      </select>
                    </td>
                    <td class="py-2 pr-2 text-xs">
                      <input
                        type="checkbox"
                        v-model="includeAiPerFile[f.id]"
                        :disabled="!f.attached"
                      />
                    </td>
                    <td class="py-2 text-xs whitespace-nowrap">
                      <button
                        v-if="!f.attached"
                        @click="attachFile(f)"
                        class="px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50"
                      >Attach</button>
                      <template v-else>
                        <button
                          @click="updateAttachment(f)"
                          class="px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 mr-1"
                        >Save</button>
                        <button
                          @click="detachFile(f)"
                          class="px-2 py-0.5 border border-red-300 text-red-600 rounded hover:bg-red-50"
                        >Detach</button>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Recent AI exchanges for this manuscript -->
          <div v-if="stats?.recentExchanges?.length" class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
            <h2 class="text-lg font-medium mb-3">Recent AI exchanges for this manuscript</h2>
            <table class="w-full text-sm">
              <thead class="text-xs uppercase tracking-wider text-ink-lighter">
                <tr class="border-b border-gray-100">
                  <th class="text-left py-2 pr-2">When</th>
                  <th class="text-left py-2 pr-2">Feature</th>
                  <th class="text-left py-2 pr-2">Mode</th>
                  <th class="text-left py-2 pr-2">Model</th>
                  <th class="text-left py-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ex in stats.recentExchanges" :key="ex.id" class="border-b border-gray-50">
                  <td class="py-2 pr-2 text-xs">{{ formatRelativeTime(ex.createdAt) }}</td>
                  <td class="py-2 pr-2 text-xs">{{ ex.feature }}</td>
                  <td class="py-2 pr-2 text-xs">{{ ex.mode || '—' }}</td>
                  <td class="py-2 pr-2 text-xs font-mono">{{ ex.model }}</td>
                  <td class="py-2 pr-2 text-xs">
                    <span :class="ex.status === 'ok' ? 'text-green-700' : 'text-red-700'">{{ ex.status }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <router-link
              :to="`/admin/ai-exchanges?manuscriptId=${selectedId}`"
              class="text-xs text-blue-600 hover:text-blue-800 hover:underline mt-2 inline-block"
            >View all →</router-link>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  adminApi,
  type RagManuscriptRow,
  type RagStats,
  type RagContextSource,
  type RagSearchResult,
  type RagUploadedFileRow,
} from '../api/admin'

const manuscripts = ref<RagManuscriptRow[]>([])
const manuscriptsLoading = ref(false)
const selectedId = ref('')

const stats = ref<RagStats | null>(null)
const sources = ref<RagContextSource[]>([])
const sourcesLoading = ref(false)
const includeArchived = ref(false)

const uploadedFiles = ref<RagUploadedFileRow[]>([])
const uploadsLoading = ref(false)
const rolePerFile = ref<Record<string, string>>({})
const includeAiPerFile = ref<Record<string, boolean>>({})

const searchQuery = ref('')
const searchTopK = ref(8)
const searchMaxTokens = ref(4000)
const searchIncludeArchived = ref(false)
const searchResult = ref<RagSearchResult | null>(null)

const forceFlag = ref(false)
const busy = ref(false)
const busyLabel = ref('')
const lastOutcome = ref('')
const errorMessage = ref('')

const selectedManuscript = computed(() =>
  manuscripts.value.find(m => m.id === selectedId.value) ?? null
)

const loadManuscripts = async () => {
  manuscriptsLoading.value = true
  try {
    manuscripts.value = await adminApi.ragListManuscripts()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    manuscriptsLoading.value = false
  }
}

const loadStats = async () => {
  if (!selectedId.value) return
  try {
    stats.value = await adminApi.ragStats(selectedId.value)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const loadSources = async () => {
  if (!selectedId.value) return
  sourcesLoading.value = true
  try {
    sources.value = await adminApi.ragListSources(selectedId.value, includeArchived.value)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    sourcesLoading.value = false
  }
}

const loadUploadedFiles = async () => {
  if (!selectedId.value) return
  uploadsLoading.value = true
  try {
    const files = await adminApi.ragListUploadedFiles(selectedId.value)
    uploadedFiles.value = files
    // Seed per-row state from server values; default to 'supporting' / true.
    const role: Record<string, string> = {}
    const incl: Record<string, boolean> = {}
    for (const f of files) {
      role[f.id] = f.contextRole ?? 'supporting'
      incl[f.id] = f.includeInAi ?? true
    }
    rolePerFile.value = role
    includeAiPerFile.value = incl
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    uploadsLoading.value = false
  }
}

const onManuscriptChange = async () => {
  errorMessage.value = ''
  lastOutcome.value = ''
  searchResult.value = null
  if (!selectedId.value) return
  await Promise.all([loadStats(), loadSources(), loadUploadedFiles()])
}

const runStep = async (step: 'compile' | 'chunk' | 'embed' | 'reindex') => {
  if (!selectedId.value || busy.value) return
  busy.value = true
  busyLabel.value = step.charAt(0).toUpperCase() + step.slice(1)
  errorMessage.value = ''
  lastOutcome.value = ''
  try {
    let result: unknown
    if (step === 'compile') result = await adminApi.ragCompile(selectedId.value, forceFlag.value)
    else if (step === 'chunk') result = await adminApi.ragChunk(selectedId.value)
    else if (step === 'embed') result = await adminApi.ragEmbed(selectedId.value)
    else result = await adminApi.ragReindex(selectedId.value, forceFlag.value)
    lastOutcome.value = JSON.stringify(result, null, 2)
    await loadStats()
    if (step === 'compile' || step === 'reindex') await loadSources()
    // Refresh manuscript counts in the picker.
    await loadManuscripts()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    busyLabel.value = ''
  }
}

const runSearch = async () => {
  if (!selectedId.value || !searchQuery.value.trim()) return
  busy.value = true
  busyLabel.value = 'Searching'
  errorMessage.value = ''
  try {
    searchResult.value = await adminApi.ragSearch(selectedId.value, searchQuery.value.trim(), {
      topK: searchTopK.value,
      maxContextTokens: searchMaxTokens.value,
      includeArchived: searchIncludeArchived.value,
    })
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    busyLabel.value = ''
  }
}

const confirmDeleteSource = async (s: RagContextSource) => {
  if (!confirm(`Hard-delete the context source "${s.title}"?\nChunks + embeddings cascade. The compiler will recreate it on the next reindex if its origin row still exists.`)) return
  try {
    await adminApi.ragDeleteSource(s.id)
    await loadSources()
    await loadStats()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const attachFile = async (f: RagUploadedFileRow) => {
  if (!selectedId.value) return
  try {
    await adminApi.ragAttachUploadedFile(selectedId.value, f.id, {
      contextRole: rolePerFile.value[f.id] ?? 'supporting',
      includeInAi: includeAiPerFile.value[f.id] ?? true,
    })
    await loadUploadedFiles()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const updateAttachment = (f: RagUploadedFileRow) => attachFile(f)

const detachFile = async (f: RagUploadedFileRow) => {
  if (!selectedId.value) return
  try {
    await adminApi.ragDetachUploadedFile(selectedId.value, f.id)
    await loadUploadedFiles()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

onMounted(loadManuscripts)
</script>

<style scoped>
.admin-rag-page pre {
  font-size: 11px;
  line-height: 1.4;
}
</style>
