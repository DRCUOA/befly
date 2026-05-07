<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
    @click.self="$emit('close')"
  >
    <div class="bg-paper w-full sm:max-w-4xl sm:rounded-lg shadow-lg max-h-[92vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="px-6 py-4 border-b border-line flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h2 class="text-lg font-light tracking-tight">AI briefing</h2>
          <p class="text-xs text-ink-lighter mt-1">
            A structured snapshot of literary direction, spine, beats, characters, and recent
            artifacts &mdash; intended for another model (or a human collaborator) to review the
            current state without reading every word. Complements the manuscript Markdown export.
          </p>
        </div>
        <button
          type="button"
          @click="$emit('close')"
          class="p-2 text-ink-lighter hover:text-ink"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <!-- Options bar -->
      <div class="px-6 py-3 border-b border-line flex flex-wrap items-center gap-4 bg-surface/50">
        <fieldset class="flex items-center gap-2 text-sm">
          <legend class="sr-only">Prose level</legend>
          <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Prose</span>
          <div class="inline-flex border border-line rounded-sm overflow-hidden">
            <button
              v-for="p in proseLevels"
              :key="p.value"
              type="button"
              @click="proseLevel = p.value"
              :class="[
                'px-3 py-1 text-xs transition-colors',
                proseLevel === p.value
                  ? 'bg-ink text-paper'
                  : 'bg-paper text-ink-light hover:text-ink',
              ]"
              :title="p.help"
            >
              {{ p.label }}
            </button>
          </div>
        </fieldset>

        <fieldset class="flex items-center gap-2 text-sm">
          <legend class="sr-only">Recent artifacts</legend>
          <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Artifacts</span>
          <input
            v-model.number="artifactLimit"
            type="number"
            min="0"
            max="200"
            step="1"
            class="w-16 px-2 py-1 text-xs border border-line rounded-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink"
            title="Cap on most-recent AI artifacts. 0 to exclude entirely."
          />
        </fieldset>

        <!-- View tabs -->
        <nav class="ml-auto inline-flex border border-line rounded-sm overflow-hidden text-sm">
          <button
            v-for="t in tabs"
            :key="t.value"
            type="button"
            @click="activeTab = t.value"
            :class="[
              'px-3 py-1 transition-colors',
              activeTab === t.value
                ? 'bg-ink text-paper'
                : 'bg-paper text-ink-light hover:text-ink',
            ]"
          >
            {{ t.label }}
          </button>
        </nav>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-6 py-5">
        <div v-if="loading" class="text-sm font-light text-ink-light italic py-12 text-center">
          Assembling briefing&hellip;
        </div>

        <div v-else-if="error" class="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
          {{ error }}
        </div>

        <!-- Summary tab — counts + freshness -->
        <div v-else-if="activeTab === 'summary' && envelope" class="space-y-4 text-sm">
          <section>
            <h3 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">Scope</h3>
            <p class="text-ink-light">{{ envelope.scopeLabel }}</p>
            <p class="text-xs text-ink-lighter mt-1">
              v{{ envelope.version }} &middot; exported {{ formatDate(envelope.exportedAt) }} &middot;
              prose: {{ envelope.proseLevel }}
            </p>
          </section>

          <section>
            <h3 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">Counts</h3>
            <dl class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div v-for="row in countRows" :key="row.label" class="border border-line rounded-sm p-2 bg-paper">
                <dt class="text-xs text-ink-lighter">{{ row.label }}</dt>
                <dd class="text-base font-light tracking-tight">{{ row.value }}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">Freshness</h3>
            <ul class="space-y-1">
              <li
                v-for="row in freshnessRows"
                :key="row.label"
                class="flex items-baseline gap-3 border-b border-line/60 pb-1"
              >
                <span class="font-medium w-32 shrink-0 capitalize">{{ row.label }}</span>
                <span class="text-ink-light text-xs">
                  {{ row.value ? formatDate(row.value) : '—' }}
                </span>
              </li>
            </ul>
          </section>
        </div>

        <!-- JSON tab -->
        <pre
          v-else-if="activeTab === 'json' && jsonText"
          class="text-xs font-mono whitespace-pre-wrap break-all bg-surface/60 border border-line rounded p-3 overflow-x-auto"
        >{{ jsonText }}</pre>

        <!-- Markdown tab -->
        <pre
          v-else-if="activeTab === 'markdown' && markdownText !== null"
          class="text-xs font-mono whitespace-pre-wrap bg-surface/60 border border-line rounded p-3 overflow-x-auto"
        >{{ markdownText }}</pre>

        <div v-else class="text-sm font-light text-ink-light italic py-12 text-center">
          Loading&hellip;
        </div>
      </div>

      <!-- Footer actions -->
      <footer class="px-6 py-3 border-t border-line flex flex-wrap items-center justify-between gap-3 bg-surface/50">
        <p class="text-xs text-ink-lighter">
          {{ sizeLabel }}
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="copyActive"
            :disabled="!canCopy"
            class="px-3 py-1.5 text-xs tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {{ copyLabel }}
          </button>
          <a
            :href="downloadUrl"
            :download="downloadFilename"
            class="px-3 py-1.5 text-xs tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
          >
            Download {{ downloadExt }}
          </a>
          <button
            type="button"
            @click="$emit('close')"
            class="px-3 py-1.5 text-xs tracking-wide font-sans text-ink-light hover:text-ink"
          >
            Close
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { manuscriptsApi } from '../../api/manuscripts'
import type { ManuscriptBriefingEnvelope, ProseLevel } from '@shared/ManuscriptBriefing'

const props = defineProps<{
  open: boolean
  manuscriptId: string
  manuscriptTitle: string
}>()

defineEmits<{ (e: 'close'): void }>()

type Tab = 'summary' | 'json' | 'markdown'

const activeTab = ref<Tab>('summary')
const proseLevel = ref<ProseLevel>('digest')
const artifactLimit = ref<number>(10)

const envelope = ref<ManuscriptBriefingEnvelope | null>(null)
const markdownText = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const copyLabel = ref('Copy')

const tabs: { value: Tab; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
]

const proseLevels: { value: ProseLevel; label: string; help: string }[] = [
  { value: 'none', label: 'None', help: 'Omit all prose. Smallest payload.' },
  { value: 'digest', label: 'Digest', help: 'First/last sentence per essay-backed item.' },
  { value: 'full', label: 'Full', help: 'Whole bodies on every essay. Heavy.' },
]

/** Pretty-printed JSON of the envelope, recomputed when the envelope changes. */
const jsonText = computed(() => {
  if (!envelope.value) return ''
  return JSON.stringify(envelope.value, null, 2)
})

/** What the active tab can copy / what the size readout describes. */
const canCopy = computed(() => {
  if (activeTab.value === 'json') return jsonText.value.length > 0
  if (activeTab.value === 'markdown') return (markdownText.value ?? '').length > 0
  return false
})

const sizeLabel = computed(() => {
  if (activeTab.value === 'json') {
    if (!jsonText.value) return '—'
    return `${formatBytes(jsonText.value.length)} JSON`
  }
  if (activeTab.value === 'markdown') {
    if (!markdownText.value) return '—'
    return `${formatBytes(markdownText.value.length)} Markdown`
  }
  if (envelope.value) {
    const c = envelope.value.counts
    return `${c.items} item(s), ${c.beats} beat(s), ${c.characters} character(s)`
  }
  return ''
})

const countRows = computed(() => {
  if (!envelope.value) return []
  const c = envelope.value.counts
  return [
    { label: 'Sections', value: c.sections },
    { label: 'Items', value: c.items },
    { label: 'Words', value: c.totalWordCount.toLocaleString() },
    { label: 'Beats', value: c.beats },
    { label: 'Characters', value: c.characters },
    { label: 'Motifs', value: c.motifs },
    { label: 'Causal links', value: c.causalLinks },
    { label: 'Silences', value: c.silences },
  ]
})

const freshnessRows = computed(() => {
  if (!envelope.value) return []
  const f = envelope.value.freshness
  return [
    { label: 'project', value: f.project },
    { label: 'spine', value: f.spine },
    { label: 'beats', value: f.beats },
    { label: 'characters', value: f.characters },
    { label: 'motifs', value: f.motifs },
    { label: 'causal links', value: f.causalLinks },
    { label: 'silences', value: f.silences },
    { label: 'artifacts', value: f.artifacts },
  ]
})

const downloadExt = computed(() =>
  activeTab.value === 'markdown' ? '.md' : '.json'
)
const downloadFormat = computed<'json' | 'markdown'>(() =>
  activeTab.value === 'markdown' ? 'markdown' : 'json'
)
const downloadUrl = computed(() =>
  manuscriptsApi.briefingDownloadUrl(props.manuscriptId, downloadFormat.value, {
    proseLevel: proseLevel.value,
    artifactLimit: artifactLimit.value,
  })
)
const downloadFilename = computed(() => {
  const slug = props.manuscriptTitle
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'manuscript'
  return `${slug}-briefing${downloadExt.value}`
})

/** Refetch the envelope (and clear the markdown cache) whenever inputs change. */
async function loadEnvelope() {
  loading.value = true
  error.value = null
  envelope.value = null
  markdownText.value = null
  try {
    const env = await manuscriptsApi.getBriefing(props.manuscriptId, {
      proseLevel: proseLevel.value,
      artifactLimit: Number.isFinite(artifactLimit.value) ? Math.max(0, artifactLimit.value) : 10,
    })
    envelope.value = env
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load briefing'
  } finally {
    loading.value = false
  }
}

/** Lazy-fetch the markdown rendering the first time the user clicks that tab. */
async function ensureMarkdown() {
  if (markdownText.value !== null) return
  try {
    markdownText.value = await manuscriptsApi.getBriefingMarkdown(props.manuscriptId, {
      proseLevel: proseLevel.value,
      artifactLimit: Number.isFinite(artifactLimit.value) ? Math.max(0, artifactLimit.value) : 10,
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load Markdown rendering'
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      activeTab.value = 'summary'
      copyLabel.value = 'Copy'
      loadEnvelope()
    }
  },
  { immediate: true }
)

// Re-fetch when the user changes prose level or artifact cap.
watch([proseLevel, artifactLimit], () => {
  if (props.open) loadEnvelope()
})

watch(activeTab, (tab) => {
  if (tab === 'markdown') ensureMarkdown()
})

async function copyActive() {
  const text =
    activeTab.value === 'json' ? jsonText.value :
    activeTab.value === 'markdown' ? (markdownText.value ?? '') :
    ''
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copyLabel.value = 'Copied'
    setTimeout(() => { copyLabel.value = 'Copy' }, 1400)
  } catch {
    copyLabel.value = 'Copy failed'
    setTimeout(() => { copyLabel.value = 'Copy' }, 1400)
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}
</script>
