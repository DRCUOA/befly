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

        <!-- Beats tab — pick one, some, or all beats and grab them on their own. -->
        <div v-else-if="activeTab === 'beats' && envelope" class="space-y-6 text-sm">
          <!-- ─── Export selected beats ─────────────────────────── -->
          <section class="space-y-3">
            <h3 class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
              Export selected beats
            </h3>

            <div v-if="envelope.beats.length === 0" class="italic text-ink-light py-2">
              No beats yet on this manuscript. Add some on the Polyphonic or Plot Causality view, or import a JSON payload below.
            </div>
            <div v-else class="space-y-3">
              <!-- Toolbar: select all / clear / count / format toggle -->
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    class="text-ink-light hover:text-ink underline"
                    @click="selectAllBeats"
                  >Select all</button>
                  <span class="text-ink-lighter">·</span>
                  <button
                    type="button"
                    class="text-ink-light hover:text-ink underline"
                    @click="clearBeats"
                  >Clear</button>
                  <span class="text-ink-lighter">{{ selectedBeatIds.length }} of {{ envelope.beats.length }} selected</span>
                </div>

                <fieldset class="inline-flex border border-line rounded-sm overflow-hidden text-xs">
                  <legend class="sr-only">Beat output format</legend>
                  <button
                    v-for="f in beatsFormats"
                    :key="f.value"
                    type="button"
                    @click="beatsFormat = f.value"
                    :class="[
                      'px-3 py-1 transition-colors',
                      beatsFormat === f.value
                        ? 'bg-ink text-paper'
                        : 'bg-paper text-ink-light hover:text-ink',
                    ]"
                  >
                    {{ f.label }}
                  </button>
                </fieldset>
              </div>

              <!-- Beat checklist -->
              <ul class="border border-line rounded-sm divide-y divide-line max-h-60 overflow-y-auto bg-paper">
                <li v-for="b in sortedBeats" :key="b.id" class="px-3 py-2">
                  <label class="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="selectedBeatIds"
                      :value="b.id"
                      class="mt-1 rounded border-line text-ink focus:ring-ink"
                    />
                    <span class="flex-1 min-w-0">
                      <span class="font-medium block truncate">{{ beatHeading(b) }}</span>
                      <span class="text-xs text-ink-lighter">{{ beatMeta(b) }}</span>
                    </span>
                  </label>
                </li>
              </ul>

              <!-- Preview pane -->
              <div>
                <p class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">
                  Preview ({{ beatsFormat }})
                </p>
                <pre
                  class="text-xs font-mono whitespace-pre-wrap bg-surface/60 border border-line rounded p-3 overflow-x-auto max-h-72"
                >{{ beatsOutput || '(no beats selected)' }}</pre>
              </div>
            </div>
          </section>

          <!-- ─── Import beats from JSON ────────────────────────── -->
          <section class="space-y-3 border-t border-line pt-5">
            <div>
              <h3 class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
                Import beats from JSON
              </h3>
              <p class="text-xs text-ink-light mt-1">
                Accepts the same envelope shape produced by the JSON export above. Imported beats
                are appended after your existing ones &mdash; nothing is overwritten. Character
                and motif references resolve by name against this manuscript;
                names that don't match are reported below so you can create them and re-import.
              </p>
            </div>

            <!-- File picker + paste box -->
            <div class="grid sm:grid-cols-2 gap-3">
              <label class="block">
                <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
                  Choose a JSON file
                </span>
                <input
                  type="file"
                  accept="application/json,.json"
                  @change="onImportFile"
                  class="block text-xs mt-1"
                />
                <span v-if="importFilename" class="text-xs text-ink-lighter italic">
                  Loaded: {{ importFilename }}
                </span>
              </label>

              <label class="block">
                <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
                  Or paste below
                </span>
                <span class="text-xs text-ink-lighter italic block mt-1">
                  Either source updates the same buffer.
                </span>
              </label>
            </div>

            <textarea
              v-model="importText"
              placeholder='{ "beats": [ ... ], "causalLinks": [ ... ], "characterNamesById": { ... } }'
              rows="6"
              class="block w-full px-2 py-2 text-xs font-mono border border-line rounded-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink resize-y"
              spellcheck="false"
            ></textarea>

            <!-- Validation summary -->
            <p
              v-if="importValidation.kind === 'empty'"
              class="text-xs text-ink-lighter italic"
            >Paste a JSON envelope or pick a file to begin.</p>
            <p
              v-else-if="importValidation.kind === 'invalid'"
              class="text-xs text-rose-700"
            >Cannot parse: {{ importValidation.message }}</p>
            <p
              v-else-if="importValidation.kind === 'valid'"
              class="text-xs text-ink-light"
            >
              Ready to import {{ importValidation.beatCount }} beat(s){{
                importValidation.causalLinkCount
                  ? ` and ${importValidation.causalLinkCount} causal link(s)`
                  : ''
              }}.
            </p>

            <!-- Import action -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                :disabled="importValidation.kind !== 'valid' || importing"
                @click="runImport"
                class="px-3 py-1.5 text-xs tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {{ importing ? 'Importing…' : 'Import beats' }}
              </button>
              <button
                v-if="importText || importResult"
                type="button"
                @click="resetImport"
                class="px-3 py-1.5 text-xs tracking-wide font-sans text-ink-light hover:text-ink"
              >
                Reset
              </button>
            </div>

            <!-- Import result -->
            <div
              v-if="importError"
              class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-3"
            >
              {{ importError }}
            </div>

            <div
              v-if="importResult"
              class="text-xs space-y-2 border border-line rounded p-3 bg-surface/40"
            >
              <p>
                <span class="font-medium">Imported {{ importResult.created.length }}</span>
                of {{ importResult.total }} beat(s).
                <span v-if="importResult.errors.length" class="text-rose-700">
                  {{ importResult.errors.length }} failed.
                </span>
              </p>
              <p v-if="importResult.causalLinks.created || importResult.causalLinks.skipped">
                Causal links: {{ importResult.causalLinks.created }} created,
                {{ importResult.causalLinks.skipped }} skipped (endpoints didn't both map).
              </p>
              <div v-if="importResult.unmatched.characterNames.length">
                <span class="text-ink-light">Unmatched character names:</span>
                <span class="text-ink">{{ importResult.unmatched.characterNames.join(', ') }}</span>
                <p class="text-ink-lighter italic">
                  Pov / knowledge refs to these resolved to null. Create the character then re-import to wire them up.
                </p>
              </div>
              <div v-if="importResult.unmatched.motifNames.length">
                <span class="text-ink-light">Unmatched motif names:</span>
                <span class="text-ink">{{ importResult.unmatched.motifNames.join(', ') }}</span>
              </div>
              <div v-if="importResult.errors.length">
                <span class="text-ink-light">Per-beat errors:</span>
                <ul class="list-disc list-inside">
                  <li v-for="(e, i) in importResult.errors" :key="i">
                    <code class="text-ink-lighter">{{ e.sourceId }}</code>: {{ e.error }}
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>

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
          <button
            type="button"
            @click="handleDownload"
            :disabled="!canDownload"
            class="px-3 py-1.5 text-xs tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Download {{ downloadExt }}
          </button>
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
import type {
  ManuscriptBriefingEnvelope,
  BriefingBeat,
  ProseLevel,
  BeatsImportEnvelope,
  BeatsImportResult,
} from '@shared/ManuscriptBriefing'

const props = defineProps<{
  open: boolean
  manuscriptId: string
  manuscriptTitle: string
}>()

defineEmits<{ (e: 'close'): void }>()

type Tab = 'summary' | 'json' | 'markdown' | 'beats'
type BeatsFormat = 'json' | 'markdown'

const activeTab = ref<Tab>('summary')
const proseLevel = ref<ProseLevel>('digest')
const artifactLimit = ref<number>(10)

const envelope = ref<ManuscriptBriefingEnvelope | null>(null)
const markdownText = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const copyLabel = ref('Copy')

// ---- Beats tab state ----
const selectedBeatIds = ref<string[]>([])
const beatsFormat = ref<BeatsFormat>('markdown')

// ---- Beats-tab import state ----
// `importText` is the source-of-truth buffer the user is editing; the file
// picker just stuffs file contents into it. Validation runs reactively over
// this string so the user sees parse errors as they type.
const importText = ref<string>('')
const importFilename = ref<string | null>(null)
const importing = ref(false)
const importError = ref<string | null>(null)
const importResult = ref<BeatsImportResult | null>(null)

type ImportValidation =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | {
      kind: 'valid'
      payload: BeatsImportEnvelope
      beatCount: number
      causalLinkCount: number
    }

const tabs: { value: Tab; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'beats', label: 'Beats' },
]

const proseLevels: { value: ProseLevel; label: string; help: string }[] = [
  { value: 'none', label: 'None', help: 'Omit all prose. Smallest payload.' },
  { value: 'digest', label: 'Digest', help: 'First/last sentence per essay-backed item.' },
  { value: 'full', label: 'Full', help: 'Whole bodies on every essay. Heavy.' },
]

const beatsFormats: { value: BeatsFormat; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
]

/** Pretty-printed JSON of the envelope, recomputed when the envelope changes. */
const jsonText = computed(() => {
  if (!envelope.value) return ''
  return JSON.stringify(envelope.value, null, 2)
})

/** Beats sorted by orderIndex for stable list and output ordering. */
const sortedBeats = computed<BriefingBeat[]>(() => {
  if (!envelope.value) return []
  return [...envelope.value.beats].sort((a, b) => a.orderIndex - b.orderIndex)
})

const selectedBeats = computed<BriefingBeat[]>(() => {
  if (!envelope.value) return []
  const set = new Set(selectedBeatIds.value)
  return sortedBeats.value.filter(b => set.has(b.id))
})

/**
 * Filtered beats output in the user's chosen format. Pure over the in-memory
 * envelope — no extra round-trip required, since the envelope already carries
 * every beat. Empty string when nothing is selected.
 */
const beatsOutput = computed(() => {
  if (!envelope.value || selectedBeats.value.length === 0) return ''
  if (beatsFormat.value === 'json') return renderBeatsJson(envelope.value, selectedBeats.value)
  return renderBeatsMarkdown(envelope.value, selectedBeats.value)
})

/** What the active tab can copy / what the size readout describes. */
const canCopy = computed(() => {
  if (activeTab.value === 'json') return jsonText.value.length > 0
  if (activeTab.value === 'markdown') return (markdownText.value ?? '').length > 0
  if (activeTab.value === 'beats') return beatsOutput.value.length > 0
  return false
})

const canDownload = computed(() => {
  if (activeTab.value === 'summary') return false
  return canCopy.value
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
  if (activeTab.value === 'beats') {
    if (!envelope.value) return '—'
    if (selectedBeats.value.length === 0) return 'No beats selected'
    const total = envelope.value.beats.length
    const fmt = beatsFormat.value === 'json' ? 'JSON' : 'Markdown'
    return `${selectedBeats.value.length} of ${total} beat(s) · ${formatBytes(beatsOutput.value.length)} ${fmt}`
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

/**
 * What format the active tab will produce when the user clicks Download.
 * The Beats tab is special — it follows its own format toggle so the user
 * can grab beats as Markdown even though the parent envelope view is JSON.
 */
const activeFormat = computed<'json' | 'markdown'>(() => {
  if (activeTab.value === 'beats') return beatsFormat.value
  if (activeTab.value === 'markdown') return 'markdown'
  return 'json'
})

const downloadExt = computed(() => activeFormat.value === 'markdown' ? '.md' : '.json')

const downloadFilename = computed(() => {
  const slug = manuscriptSlug()
  if (activeTab.value === 'beats') {
    const all = envelope.value && selectedBeats.value.length === envelope.value.beats.length
    return `${slug}-beats${all ? '-all' : `-${selectedBeats.value.length}`}${downloadExt.value}`
  }
  return `${slug}-briefing${downloadExt.value}`
})

function manuscriptSlug(): string {
  return props.manuscriptTitle
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'manuscript'
}

/**
 * Text content the user is currently looking at — what Copy puts on the
 * clipboard and what Download writes into the file.
 */
function activeText(): string {
  if (activeTab.value === 'json') return jsonText.value
  if (activeTab.value === 'markdown') return markdownText.value ?? ''
  if (activeTab.value === 'beats') return beatsOutput.value
  return ''
}

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
    // Default the Beats tab to "everything selected" on each fresh load —
    // most users want all beats; deselecting from a full set is faster than
    // selecting from empty.
    selectedBeatIds.value = env.beats.map(b => b.id)
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
  const text = activeText()
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

/**
 * Trigger a client-side download of the active tab's text. Uses a Blob URL
 * so the same code path works for the Beats tab (filtered subset, computed
 * in the browser) as well as the JSON / Markdown tabs (full envelope).
 *
 * The URL is revoked shortly after the click to avoid leaking object URLs.
 */
function handleDownload() {
  const text = activeText()
  if (!text) return
  const mime = activeFormat.value === 'markdown'
    ? 'text/markdown; charset=utf-8'
    : 'application/json; charset=utf-8'
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadFilename.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/* ---- Beats tab helpers ---- */

function selectAllBeats() {
  if (!envelope.value) return
  selectedBeatIds.value = envelope.value.beats.map(b => b.id)
}
function clearBeats() {
  selectedBeatIds.value = []
}

/* ---- Beat import ---- */

/**
 * Reactive validation over the textarea buffer. We parse the JSON each time
 * the buffer changes; if parsing succeeds we shape-check the envelope at
 * the same level the server does (beats must be an array, etc.). Anything
 * stricter — enum values, character/motif ref resolution — happens
 * server-side so the importer remains the single source of truth.
 */
const importValidation = computed<ImportValidation>(() => {
  const text = importText.value.trim()
  if (!text) return { kind: 'empty' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { kind: 'invalid', message: err instanceof Error ? err.message : 'Not valid JSON' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'invalid', message: 'Payload must be a JSON object' }
  }
  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.beats)) {
    return { kind: 'invalid', message: 'Payload must contain a "beats" array' }
  }
  return {
    kind: 'valid',
    // The shape check above (object + beats array) is enough for the server
    // to accept; the cast through `unknown` tells TS we've handled the gap
    // between the broad runtime type (Record<string, unknown>) and the
    // narrower shared type. The server is the authority on full validation.
    payload: obj as unknown as BeatsImportEnvelope,
    beatCount: obj.beats.length,
    causalLinkCount: Array.isArray(obj.causalLinks) ? obj.causalLinks.length : 0,
  }
})

async function onImportFile(ev: Event) {
  const target = ev.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  importFilename.value = file.name
  try {
    importText.value = await file.text()
    // Reset any prior import result/error so the panel reflects the new buffer.
    importResult.value = null
    importError.value = null
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Failed to read file'
  } finally {
    // Allow re-selecting the same file (browsers don't fire change otherwise).
    target.value = ''
  }
}

async function runImport() {
  const v = importValidation.value
  if (v.kind !== 'valid') return

  importing.value = true
  importError.value = null
  importResult.value = null
  try {
    const res = await manuscriptsApi.importBeats(props.manuscriptId, v.payload)
    importResult.value = res
    // Refresh the envelope so the freshly imported beats appear in the
    // export checklist below — same fetch path used at modal open.
    await loadEnvelope()
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Import failed'
  } finally {
    importing.value = false
  }
}

function resetImport() {
  importText.value = ''
  importFilename.value = null
  importError.value = null
  importResult.value = null
}

/** Heading shown next to each beat's checkbox. */
function beatHeading(b: BriefingBeat): string {
  const head = [b.label, b.title].filter(Boolean).join(' · ')
  return head || `Beat ${b.orderIndex + 1}`
}

/** Sub-line under the heading: POV, scene function, etc. */
function beatMeta(b: BriefingBeat): string {
  if (!envelope.value) return ''
  const charNameById = new Map(envelope.value.characters.map(c => [c.id, c.name]))
  const bits: string[] = []
  if (b.povCharacterId) bits.push(`POV: ${charNameById.get(b.povCharacterId) ?? '—'}`)
  if (b.sceneFunctionType) bits.push(b.sceneFunctionType.replace(/_/g, ' '))
  if (b.withholdingLevel) bits.push(`withholding: ${b.withholdingLevel}`)
  if (b.timelinePoint) bits.push(`when: ${b.timelinePoint}`)
  return bits.join(' · ')
}

/**
 * Render the selected beats as a JSON document. Carries enough envelope
 * metadata that a downstream model knows what file it is looking at, plus a
 * tiny lookup of POV-character names so beat ids resolve to readable names
 * without the whole characters[] block.
 */
function renderBeatsJson(env: ManuscriptBriefingEnvelope, beats: BriefingBeat[]): string {
  const charNameById = Object.fromEntries(
    env.characters.map(c => [c.id, c.name])
  )
  const motifNameById = Object.fromEntries(
    env.motifs.map(m => [m.id, m.name])
  )
  const out = {
    version: env.version,
    type: 'manuscript_briefing_beats' as const,
    exportedAt: new Date().toISOString(),
    proseLevel: env.proseLevel,
    scopeLabel:
      `${beats.length} of ${env.beats.length} beat(s) from "${env.project.title}"`,
    _documentation: {
      purpose:
        'A subset of the manuscript briefing — selected beats only, with a ' +
        'small character-name and motif-name lookup so downstream readers ' +
        'don\'t need the full briefing to interpret the beat fields. For the ' +
        'full state snapshot, use the briefing endpoint without filtering.',
      knowledge:
        'beats[].knowledge entries with characterId null are the "reader" ' +
        'row — what the reader knows at this beat (the dramatic-irony spine).',
      causalLinks:
        'Only causal links whose endpoints are both in the selected set are ' +
        'included. Edges that point outside the selection are dropped on ' +
        'purpose so the file is internally consistent.',
    },
    project: {
      id: env.project.id,
      title: env.project.title,
      form: env.project.form,
      status: env.project.status,
    },
    characterNamesById: charNameById,
    motifNamesById: motifNameById,
    beats,
    causalLinks: env.causalLinks.filter(l => {
      const set = new Set(beats.map(b => b.id))
      return set.has(l.fromBeatId) && set.has(l.toBeatId)
    }),
  }
  return JSON.stringify(out, null, 2) + '\n'
}

/**
 * Placeholder for an empty value in the Markdown output. Rendered in italics
 * so a downstream reader (model or human) can immediately tell that the
 * field exists but has not been filled in — silence here is information,
 * not noise.
 */
const BLANK = '_(blank)_'

function or(v: string | null | undefined): string {
  return v && v.trim() ? v : BLANK
}

/**
 * Render the selected beats as Markdown. Every field on BriefingBeat is
 * included for every beat, regardless of whether it's filled in — blank
 * fields show as _(blank)_ so a consumer can see at a glance which beats
 * are partially developed.
 *
 * Mirrors the field set used by the server-side briefing Markdown renderer.
 */
function renderBeatsMarkdown(env: ManuscriptBriefingEnvelope, beats: BriefingBeat[]): string {
  const charNameById = new Map(env.characters.map(c => [c.id, c.name]))
  const motifNameById = new Map(env.motifs.map(m => [m.id, m.name]))
  const sceneFunctionLabels: Record<string, string> = {
    establishing_voice: 'Establishing voice',
    counterpoint: 'Counterpoint',
    correction: 'Correction',
    echo: 'Echo',
    withholding: 'Withholding',
    fragment: 'Fragment',
    reframing: 'Reframing',
    stretto: 'Stretto',
    other: 'Other',
  }
  const causalLinkLabels: Record<string, string> = {
    because: 'because',
    therefore: 'therefore',
    but_because: 'but because',
    until: 'until',
    reversal: 'reversal',
    recognition: 'recognition',
    crisis_choice: 'crisis choice',
    climax: 'climax',
    plant: 'plant',
    payoff: 'payoff',
    and_then: 'and then',
  }

  const lines: string[] = []
  lines.push(`# Beats — ${env.project.title}`)
  lines.push('')
  lines.push(`*${beats.length} of ${env.beats.length} beat(s) selected · exported ${new Date().toISOString()}*`)
  lines.push('')

  for (const b of beats) {
    const head = [b.label, b.title].filter(Boolean).join(' · ') || `Beat ${b.orderIndex + 1}`
    lines.push(`## ${head}`)
    lines.push('')

    // Identification + structural metadata
    lines.push(`**ID.** ${b.id}`)
    lines.push(`**Order index.** ${b.orderIndex}`)
    lines.push(`**Item ID.** ${b.itemId ?? BLANK}`)
    lines.push(`**Label.** ${or(b.label)}`)
    lines.push(`**Title.** ${or(b.title)}`)

    // Setting
    lines.push(`**POV character.** ${
      b.povCharacterId ? (charNameById.get(b.povCharacterId) ?? b.povCharacterId) : BLANK
    }`)
    lines.push(`**Timeline point.** ${or(b.timelinePoint)}`)
    lines.push(`**Movement.** ${or(b.movement)}`)
    lines.push(`**Scene function.** ${
      b.sceneFunctionType ? (sceneFunctionLabels[b.sceneFunctionType] ?? b.sceneFunctionType) : BLANK
    }`)
    lines.push(`**Withholding level.** ${b.withholdingLevel ?? BLANK}`)

    // Narrative content
    lines.push(`**Outer event.** ${or(b.outerEvent)}`)
    lines.push(`**Inner turn.** ${or(b.innerTurn)}`)
    lines.push(`**Voice constraint.** ${or(b.voiceConstraint)}`)
    lines.push(`**Final image.** ${or(b.finalImage)}`)

    // POV-perception fields
    lines.push(`**Unique perception.** ${or(b.uniquePerception)}`)
    lines.push(`**Blind spot.** ${or(b.blindSpot)}`)
    lines.push(`**Misreading.** ${or(b.misreading)}`)
    lines.push(`**Reader inference.** ${or(b.readerInference)}`)
    lines.push(`**Reason for next POV switch.** ${or(b.reasonForNextPovSwitch)}`)
    lines.push('')

    // Knowledge ledger — always present, even when empty.
    lines.push('**Knowledge ledger.**')
    if (b.knowledge.length === 0) {
      lines.push(`- ${BLANK}`)
    } else {
      for (const k of b.knowledge) {
        const who = k.characterId ? (charNameById.get(k.characterId) ?? k.characterId) : 'Reader'
        lines.push(`- _${who} (${k.knowledgeKind})_: ${k.text}`)
      }
    }
    lines.push('')

    // Motifs touched — always present, even when empty.
    lines.push('**Motifs touched.**')
    if (b.motifs.length === 0) {
      lines.push(`- ${BLANK}`)
    } else {
      for (const bm of b.motifs) {
        const name = motifNameById.get(bm.motifId) ?? bm.motifId
        lines.push(`- ${name}${bm.variantNote ? ` — ${bm.variantNote}` : ''}`)
      }
    }
    lines.push('')
  }

  // Causal links between the selected beats only. Always render the section
  // header so the file shape is consistent across selections; show a blank
  // placeholder when there are no internal links.
  const selectedSet = new Set(beats.map(b => b.id))
  const beatLabel = new Map<string, string>()
  for (const b of beats) {
    beatLabel.set(b.id, b.title || b.label || `Beat ${b.orderIndex + 1}`)
  }
  const internalLinks = env.causalLinks.filter(
    l => selectedSet.has(l.fromBeatId) && selectedSet.has(l.toBeatId)
  )
  lines.push('## Causality (within selection)', '')
  if (internalLinks.length === 0) {
    lines.push(BLANK, '')
  } else {
    for (const link of internalLinks) {
      const from = beatLabel.get(link.fromBeatId) ?? link.fromBeatId
      const to = beatLabel.get(link.toBeatId) ?? link.toBeatId
      const verb = causalLinkLabels[link.linkType] ?? link.linkType
      const note = link.note ? ` — ${link.note}` : ''
      lines.push(`- ${from} **${verb}** ${to}${note}`)
    }
    lines.push('')
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
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
