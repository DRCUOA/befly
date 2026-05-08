<template>
  <Teleport to="body">
    <Transition name="frp">
      <aside
        v-if="open"
        class="frp-panel"
        role="dialog"
        aria-label="Find and replace"
        @keydown.esc.stop="onEsc"
      >
        <header class="frp-header">
          <h3 class="frp-title">Find &amp; replace</h3>
          <button
            type="button"
            class="frp-close"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15"/>
            </svg>
          </button>
        </header>

        <!-- Scope toggle: in essay vs in manuscript. Manuscript scope first
             requires the user to pick which manuscript — we don't infer
             from the URL because an essay can belong to several. -->
        <div class="frp-scope" role="tablist" aria-label="Search scope">
          <button
            type="button"
            role="tab"
            :aria-selected="scope === 'essay' ? 'true' : 'false'"
            :class="['frp-scope-btn', scope === 'essay' && 'is-on']"
            @click="setScope('essay')"
          >In essay</button>
          <button
            type="button"
            role="tab"
            :aria-selected="scope === 'manuscript' ? 'true' : 'false'"
            :class="['frp-scope-btn', scope === 'manuscript' && 'is-on']"
            @click="setScope('manuscript')"
          >In manuscript</button>
        </div>

        <!-- Manuscript picker. Only relevant for the manuscript scope. -->
        <div v-if="scope === 'manuscript'" class="frp-manuscript-picker">
          <p v-if="loadingManuscripts" class="frp-meta">Loading manuscripts…</p>
          <p v-else-if="manuscriptError" class="frp-error">{{ manuscriptError }}</p>
          <p v-else-if="!manuscripts.length" class="frp-meta">
            You don't have any manuscripts to search across.
          </p>
          <label v-else class="frp-field">
            <span class="frp-field-label">Manuscript</span>
            <select v-model="selectedManuscriptId" class="frp-input" :disabled="manuscriptBusy">
              <option v-for="m in manuscripts" :key="m.id" :value="m.id">{{ m.title || 'Untitled' }}</option>
            </select>
          </label>
        </div>

        <label class="frp-field">
          <span class="frp-field-label">Find</span>
          <input
            ref="queryInputRef"
            v-model="query"
            type="text"
            class="frp-input frp-mono"
            spellcheck="false"
            autocomplete="off"
            placeholder="Text to find"
            @keydown.enter.prevent.stop="onEnterInQuery($event)"
          />
        </label>

        <label class="frp-field">
          <span class="frp-field-label">Replace with</span>
          <input
            v-model="replacement"
            type="text"
            class="frp-input frp-mono"
            spellcheck="false"
            autocomplete="off"
            placeholder="Replacement"
            @keydown.enter.prevent.stop="replaceCurrent()"
          />
        </label>

        <div class="frp-options" role="group" aria-label="Search options">
          <label class="frp-option" title="Match case (Aa)">
            <input type="checkbox" v-model="options.caseSensitive" />
            <span>Aa</span>
          </label>
          <label class="frp-option" title="Whole words only">
            <input type="checkbox" v-model="options.wholeWord" />
            <span>\b</span>
          </label>
          <label class="frp-option" title="Regular expression">
            <input type="checkbox" v-model="options.regex" />
            <span>.*</span>
          </label>
        </div>

        <p v-if="regexInvalid" class="frp-error">Invalid regular expression.</p>

        <p class="frp-status" aria-live="polite">{{ statusLabel }}</p>

        <!-- Action row: split into navigate / replace groups. -->
        <div class="frp-actions">
          <button
            type="button"
            class="frp-btn"
            :disabled="!canFind || scope === 'manuscript'"
            @click="findPrev"
            :title="scope === 'manuscript' ? 'Available in essay scope only' : 'Find previous match'"
          >Prev</button>
          <button
            type="button"
            class="frp-btn"
            :disabled="!canFind || scope === 'manuscript'"
            @click="findNext"
            :title="scope === 'manuscript' ? 'Available in essay scope only' : 'Find next match'"
          >Next</button>
          <button
            type="button"
            class="frp-btn"
            :disabled="!canFind"
            @click="findAllNow"
            title="Count every match"
          >Find all</button>
        </div>
        <div class="frp-actions">
          <button
            type="button"
            class="frp-btn"
            :disabled="!canReplaceCurrent"
            @click="replaceCurrent"
            :title="scope === 'manuscript' ? 'Available in essay scope only' : 'Replace current match'"
          >Replace</button>
          <button
            type="button"
            class="frp-btn frp-btn-primary"
            :disabled="!canFind || manuscriptBusy"
            @click="replaceAllNow"
            title="Replace every match in scope"
          >Replace all</button>
        </div>

        <!-- Per-essay breakdown for manuscript scope. Acts as a "Find all"
             receipt and is also useful before pressing Replace all. -->
        <ul
          v-if="scope === 'manuscript' && lastManuscriptScan && lastManuscriptScan.essays.length"
          class="frp-essay-list"
        >
          <li v-for="e in lastManuscriptScan.essays" :key="e.writingBlockId" class="frp-essay">
            <span class="frp-essay-title">{{ e.title || 'Untitled' }}</span>
            <span class="frp-essay-count">{{ e.matchCount }}</span>
          </li>
        </ul>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { api } from '../../api/client'
import {
  findAll,
  replaceAll,
  replaceFirstFrom,
  buildRegex,
  type FindOptions,
  type Match,
} from '../../composables/useFindReplace'
import type { WritingBlock } from '../../domain/WritingBlock'
import type { ManuscriptProject, ManuscriptItem } from '@shared/Manuscript'
import type { ApiResponse } from '@shared/ApiResponses'

// ---- Props / emits ----
const props = defineProps<{
  /** Whether the panel is visible. */
  open: boolean
  /** Current essay body (controlled). */
  body: string
  /** ID of the currently-edited writing block, when editing. Allows the
   *  manuscript scope to default-select a manuscript that contains it. */
  writingBlockId?: string | null
  /** Reference to the body textarea so we can highlight matches by
   *  setting its selection range. */
  textareaRef?: HTMLTextAreaElement | null
}>()

const emit = defineEmits<{
  /** Close the panel. */
  close: []
  /** Update the essay body (essay scope only). */
  'update:body': [value: string]
  /** Status messages bubbled up to the host page (e.g. zenStatus pill). */
  status: [{ kind: 'info' | 'success' | 'error'; message: string }]
}>()

// ---- Find state ----
type Scope = 'essay' | 'manuscript'
const scope = ref<Scope>('essay')
const query = ref('')
const replacement = ref('')
const options = ref<FindOptions>({
  caseSensitive: false,
  wholeWord: false,
  regex: false,
})

const queryInputRef = ref<HTMLInputElement | null>(null)

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    queryInputRef.value?.focus()
    queryInputRef.value?.select()
  }
})

// ---- Essay-scope match navigation ----
const essayMatches = computed<Match[]>(() => {
  if (scope.value !== 'essay') return []
  return findAll(props.body, query.value, options.value)
})
const currentMatchIdx = ref(-1)

// Keep the cursor index in sync with the textarea so that when the user
// moves the caret manually, the next "Find next" picks up from there.
function caretIndex(): number {
  const el = props.textareaRef
  if (!el) return 0
  return Math.max(el.selectionStart || 0, el.selectionEnd || 0)
}

function selectInTextarea(start: number, end: number) {
  const el = props.textareaRef
  if (!el) return
  el.focus()
  el.setSelectionRange(start, end)
  // Scroll the selection into view. The textarea doesn't do this by default
  // when programmatically setting selectionRange.
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18
  const before = el.value.slice(0, start)
  const lineNo = (before.match(/\n/g) || []).length
  const targetTop = lineNo * lineHeight - el.clientHeight / 2
  if (targetTop > 0 && targetTop < el.scrollHeight) {
    el.scrollTop = targetTop
  }
}

const regexInvalid = computed(() => {
  if (!query.value || !options.value.regex) return false
  return buildRegex(query.value, options.value) === null
})

const canFind = computed(() => !!query.value && !regexInvalid.value)
const canReplaceCurrent = computed(() =>
  scope.value === 'essay' && canFind.value && currentMatchIdx.value >= 0,
)

const statusLabel = computed(() => {
  if (regexInvalid.value) return 'Invalid regular expression.'
  if (!query.value) return ''
  if (scope.value === 'essay') {
    const total = essayMatches.value.length
    if (total === 0) return 'No matches.'
    if (currentMatchIdx.value >= 0) return `${currentMatchIdx.value + 1} of ${total}`
    return `${total} match${total === 1 ? '' : 'es'}`
  }
  // Manuscript scope
  if (lastManuscriptScan.value) {
    const { totalMatches, essays } = lastManuscriptScan.value
    if (totalMatches === 0) return 'No matches.'
    return `${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${essays.length} ${essays.length === 1 ? 'essay' : 'essays'}.`
  }
  if (manuscriptBusy.value) return 'Searching…'
  return ''
})

// Reset the active index whenever the query/options/scope change.
watch([query, options, scope], () => {
  currentMatchIdx.value = -1
}, { deep: true })

function findNext() {
  if (scope.value !== 'essay') return
  const matches = essayMatches.value
  if (!matches.length) {
    emit('status', { kind: 'info', message: 'No matches.' })
    return
  }
  const cursor = caretIndex()
  // If we already have an active match, advance from it; otherwise find the
  // first match at or after the caret. Wrap to start when we run off the end.
  let nextIdx: number
  if (currentMatchIdx.value >= 0 && currentMatchIdx.value < matches.length - 1) {
    nextIdx = currentMatchIdx.value + 1
  } else if (currentMatchIdx.value === matches.length - 1) {
    nextIdx = 0
  } else {
    nextIdx = matches.findIndex(m => m.start >= cursor)
    if (nextIdx < 0) nextIdx = 0
  }
  currentMatchIdx.value = nextIdx
  const m = matches[nextIdx]
  selectInTextarea(m.start, m.end)
}

function findPrev() {
  if (scope.value !== 'essay') return
  const matches = essayMatches.value
  if (!matches.length) {
    emit('status', { kind: 'info', message: 'No matches.' })
    return
  }
  const cursor = caretIndex()
  let prevIdx: number
  if (currentMatchIdx.value > 0) {
    prevIdx = currentMatchIdx.value - 1
  } else if (currentMatchIdx.value === 0) {
    prevIdx = matches.length - 1
  } else {
    // No active match: find the last one before the caret, else wrap.
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].end <= cursor) { prevIdx = i; break }
    }
    prevIdx = prevIdx! ?? matches.length - 1
  }
  currentMatchIdx.value = prevIdx
  const m = matches[prevIdx]
  selectInTextarea(m.start, m.end)
}

async function findAllNow() {
  if (!canFind.value) return
  if (scope.value === 'essay') {
    const total = essayMatches.value.length
    emit('status', {
      kind: total === 0 ? 'info' : 'success',
      message: total === 0 ? 'No matches.' : `${total} match${total === 1 ? '' : 'es'}.`,
    })
    return
  }
  await runManuscriptScan()
}

function replaceCurrent() {
  if (scope.value !== 'essay') {
    // Replace + advance only makes sense in essay scope. For manuscript
    // scope, the user uses "Replace all" — there's no concept of a
    // "current match" across files until we add per-file navigation.
    return
  }
  if (!canFind.value) return
  const matches = essayMatches.value
  if (!matches.length) return

  // If the textarea's current selection already matches the active match,
  // perform the replacement; otherwise treat this click as "Find next".
  const idx = currentMatchIdx.value
  if (idx < 0 || idx >= matches.length) {
    findNext()
    return
  }
  const m = matches[idx]
  const replaced = replaceFirstFrom(props.body, query.value, replacement.value, options.value, m.start)
  if (replaced.replaced) {
    emit('update:body', replaced.result)
    // After replacement, the text shifts. Reset the index so the next
    // findNext call from the new cursor position lands on the next match.
    currentMatchIdx.value = -1
    nextTick(() => {
      const el = props.textareaRef
      if (el) {
        el.focus()
        el.setSelectionRange(replaced.nextIndex, replaced.nextIndex)
      }
      // Auto-advance to the next match for snappy "replace, replace, …" feel.
      findNext()
    })
  }
}

function replaceAllNow() {
  if (!canFind.value) return
  if (scope.value === 'essay') {
    const { result, count } = replaceAll(props.body, query.value, replacement.value, options.value)
    if (count === 0) {
      emit('status', { kind: 'info', message: 'No matches to replace.' })
      return
    }
    emit('update:body', result)
    currentMatchIdx.value = -1
    emit('status', {
      kind: 'success',
      message: `Replaced ${count} match${count === 1 ? '' : 'es'}.`,
    })
    return
  }
  void runManuscriptReplaceAll()
}

function onEnterInQuery(_ev: KeyboardEvent) {
  if (scope.value === 'manuscript') {
    findAllNow()
  } else {
    findNext()
  }
}

function onEsc() {
  emit('close')
}

// ---- Manuscript scope ----
const manuscripts = ref<ManuscriptProject[]>([])
const loadingManuscripts = ref(false)
const manuscriptError = ref<string | null>(null)
const selectedManuscriptId = ref<string>('')
const manuscriptBusy = ref(false)

interface ManuscriptScanResult {
  manuscriptId: string
  totalMatches: number
  essays: { writingBlockId: string; title: string; matchCount: number; body: string }[]
}
const lastManuscriptScan = ref<ManuscriptScanResult | null>(null)

async function setScope(s: Scope) {
  scope.value = s
  lastManuscriptScan.value = null
  if (s === 'manuscript' && !manuscripts.value.length && !loadingManuscripts.value) {
    await loadManuscripts()
  }
}

async function loadManuscripts() {
  loadingManuscripts.value = true
  manuscriptError.value = null
  try {
    const res = await api.get<ApiResponse<ManuscriptProject[]>>('/manuscripts')
    manuscripts.value = res.data || []
    if (manuscripts.value.length) {
      // Default-select a manuscript that contains the current essay if we
      // can find one. We need to fetch each manuscript's items to check;
      // skip that lookup when there's only one manuscript.
      if (manuscripts.value.length === 1) {
        selectedManuscriptId.value = manuscripts.value[0].id
      } else if (props.writingBlockId) {
        const containing = await findContainingManuscript(props.writingBlockId)
        selectedManuscriptId.value = containing || manuscripts.value[0].id
      } else {
        selectedManuscriptId.value = manuscripts.value[0].id
      }
    }
  } catch (err) {
    manuscriptError.value = err instanceof Error ? err.message : 'Failed to load manuscripts.'
  } finally {
    loadingManuscripts.value = false
  }
}

async function findContainingManuscript(writingBlockId: string): Promise<string | null> {
  // Cheap parallel scan of every manuscript's items, looking for the
  // writingBlockId. Caps at 8 manuscripts in flight to be a polite client.
  const ids = manuscripts.value.map(m => m.id)
  const found = await firstResolvedTruthy(ids, async (id) => {
    try {
      const r = await api.get<ApiResponse<ManuscriptItem[]>>(`/manuscripts/${id}/items`)
      const items = r.data || []
      return items.some(it => it.writingBlockId === writingBlockId) ? id : null
    } catch {
      return null
    }
  })
  return found
}

async function firstResolvedTruthy<T>(arr: string[], fn: (id: string) => Promise<T | null>): Promise<T | null> {
  for (const id of arr) {
    const v = await fn(id)
    if (v) return v
  }
  return null
}

async function runManuscriptScan(): Promise<ManuscriptScanResult | null> {
  if (!canFind.value) return null
  const mId = selectedManuscriptId.value
  if (!mId) return null
  manuscriptBusy.value = true
  try {
    const itemsRes = await api.get<ApiResponse<ManuscriptItem[]>>(`/manuscripts/${mId}/items`)
    const blockIds = (itemsRes.data || [])
      .filter(it => it.itemType === 'essay' && it.writingBlockId)
      .map(it => ({ id: it.writingBlockId as string, title: it.title }))
    // Fetch each block's body. We do these serially-by-default to keep the
    // server-side load small; if this becomes slow on long manuscripts we
    // can switch to a small parallel pool.
    const essays: ManuscriptScanResult['essays'] = []
    let total = 0
    for (const ref of blockIds) {
      const blockRes = await api.get<ApiResponse<WritingBlock>>(`/writing/${ref.id}`)
      const body = blockRes.data?.body || ''
      const matches = findAll(body, query.value, options.value)
      if (matches.length) {
        essays.push({ writingBlockId: ref.id, title: ref.title || blockRes.data?.title || 'Untitled', matchCount: matches.length, body })
        total += matches.length
      }
    }
    const result: ManuscriptScanResult = {
      manuscriptId: mId,
      totalMatches: total,
      essays,
    }
    lastManuscriptScan.value = result
    emit('status', {
      kind: total === 0 ? 'info' : 'success',
      message: total === 0
        ? 'No matches in manuscript.'
        : `${total} match${total === 1 ? '' : 'es'} in ${essays.length} ${essays.length === 1 ? 'essay' : 'essays'}.`,
    })
    return result
  } catch (err) {
    emit('status', { kind: 'error', message: err instanceof Error ? err.message : 'Manuscript search failed.' })
    return null
  } finally {
    manuscriptBusy.value = false
  }
}

async function runManuscriptReplaceAll() {
  if (!canFind.value) return
  const scan = lastManuscriptScan.value || await runManuscriptScan()
  if (!scan || !scan.totalMatches) {
    emit('status', { kind: 'info', message: 'No matches to replace.' })
    return
  }
  const verb = scan.totalMatches === 1 ? 'match' : 'matches'
  const essayWord = scan.essays.length === 1 ? 'essay' : 'essays'
  const ok = window.confirm(
    `Replace ${scan.totalMatches} ${verb} across ${scan.essays.length} ${essayWord} in this manuscript?\n\n` +
    `This updates each essay's saved body immediately. Cannot be undone in-app.`,
  )
  if (!ok) return

  manuscriptBusy.value = true
  try {
    let writtenEssays = 0
    let writtenMatches = 0
    for (const essay of scan.essays) {
      const { result, count } = replaceAll(essay.body, query.value, replacement.value, options.value)
      if (count === 0) continue
      // Persist via the existing PUT /writing/:id endpoint. We send only
      // the body field — the server merges the partial update with the
      // existing record so we don't need to forward title / themes / etc.
      await api.put<ApiResponse<WritingBlock>>(`/writing/${essay.writingBlockId}`, { body: result })
      writtenEssays++
      writtenMatches += count
      // If the user is currently editing one of these essays, also bubble
      // the update to the host so the textarea shows fresh content.
      if (props.writingBlockId && essay.writingBlockId === props.writingBlockId) {
        emit('update:body', result)
      }
    }
    emit('status', {
      kind: 'success',
      message: `Replaced ${writtenMatches} match${writtenMatches === 1 ? '' : 'es'} across ${writtenEssays} ${writtenEssays === 1 ? 'essay' : 'essays'}.`,
    })
    // Refresh the scan so the count rolls down to zero.
    await runManuscriptScan()
  } catch (err) {
    emit('status', { kind: 'error', message: err instanceof Error ? err.message : 'Replace failed.' })
  } finally {
    manuscriptBusy.value = false
  }
}

onBeforeUnmount(() => {
  // Nothing async to cancel, but keep the hook in case we add
  // long-running scans later.
})
</script>

<style scoped>
.frp-panel {
  position: fixed;
  top: 12vh;
  right: 1.5rem;
  width: min(360px, calc(100vw - 2rem));
  max-height: 76vh;
  overflow-y: auto;
  z-index: 70;
  background: rgb(var(--color-paper) / 0.98);
  color: rgb(var(--color-ink));
  border: 1px solid rgb(var(--color-line));
  border-radius: 4px;
  box-shadow: 0 18px 48px -16px rgba(0, 0, 0, 0.45);
  font-family: ui-sans-serif, system-ui, sans-serif;
  padding: 1rem 1.1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.frp-header { display: flex; align-items: center; justify-content: space-between; }
.frp-title { font-size: 0.95rem; font-weight: 500; margin: 0; letter-spacing: 0.02em; }
.frp-close {
  width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; background: transparent; color: rgb(var(--color-ink-light));
  border-radius: 2px; cursor: pointer;
}
.frp-close:hover { background: rgb(var(--color-line)); }

.frp-scope { display: inline-flex; border: 1px solid rgb(var(--color-line)); border-radius: 2px; }
.frp-scope-btn {
  flex: 1 1 0;
  padding: 0.35rem 0.75rem; font-size: 0.78rem;
  background: transparent; color: rgb(var(--color-ink-lighter)); border: 0; cursor: pointer;
}
.frp-scope-btn + .frp-scope-btn { border-left: 1px solid rgb(var(--color-line)); }
.frp-scope-btn.is-on { background: rgb(var(--color-ink)); color: rgb(var(--color-paper)); }

.frp-manuscript-picker { padding: 0; }

.frp-field { display: flex; flex-direction: column; gap: 0.25rem; }
.frp-field-label {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em;
  color: rgb(var(--color-ink-lighter));
}
.frp-input {
  width: 100%; padding: 0.4rem 0.55rem;
  background: rgb(var(--color-paper));
  color: rgb(var(--color-ink));
  border: 1px solid rgb(var(--color-line));
  border-radius: 2px; font-size: 0.85rem;
}
.frp-input:focus { outline: 2px solid rgb(var(--color-ink)); outline-offset: -1px; }
.frp-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.frp-options { display: flex; gap: 0.6rem; }
.frp-option {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.78rem; color: rgb(var(--color-ink-lighter));
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border: 1px solid rgb(var(--color-line));
  border-radius: 2px;
  user-select: none;
}
.frp-option input { margin: 0; accent-color: rgb(var(--color-ink)); }
.frp-option:hover { color: rgb(var(--color-ink)); }

.frp-status {
  font-size: 0.78rem; color: rgb(var(--color-ink-lighter));
  min-height: 1.2em;
  margin: 0;
}
.frp-error {
  font-size: 0.78rem; color: #a82424;
  margin: 0;
}
.frp-meta { font-size: 0.78rem; color: rgb(var(--color-ink-lighter)); margin: 0; }

.frp-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.frp-btn {
  flex: 1 1 auto;
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
  background: transparent;
  color: rgb(var(--color-ink));
  border: 1px solid rgb(var(--color-line));
  border-radius: 2px;
  cursor: pointer;
  font-family: inherit;
}
.frp-btn:hover:not(:disabled) { background: rgb(var(--color-line)); }
.frp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.frp-btn-primary { background: rgb(var(--color-ink)); color: rgb(var(--color-paper)); border-color: rgb(var(--color-ink)); }
.frp-btn-primary:hover:not(:disabled) { background: rgb(var(--color-ink-light)); }

.frp-essay-list {
  list-style: none;
  margin: 0.4rem 0 0; padding: 0;
  font-size: 0.8rem;
  border-top: 1px solid rgb(var(--color-line));
  padding-top: 0.5rem;
  max-height: 12rem; overflow-y: auto;
}
.frp-essay {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.6rem;
  padding: 0.18rem 0;
  color: rgb(var(--color-ink));
}
.frp-essay-title { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.frp-essay-count {
  font-variant-numeric: tabular-nums;
  font-size: 0.72rem;
  color: rgb(var(--color-ink-lighter));
  background: rgb(var(--color-line));
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
}

/* Slide-in animation */
.frp-enter-from { opacity: 0; transform: translateX(8px); }
.frp-enter-active { transition: opacity 160ms ease, transform 160ms ease; }
.frp-leave-to { opacity: 0; transform: translateX(8px); }
.frp-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
</style>
