<template>
  <div
    role="dialog"
    aria-label="Revision history"
    aria-modal="true"
    :aria-hidden="!modelValue"
    class="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-paper border-l border-line shadow-xl flex flex-col transform transition-transform duration-150 ease-out"
    :class="modelValue ? 'translate-x-0' : 'translate-x-full'"
    tabindex="-1"
    @keydown.escape="close"
  >
    <div class="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line shrink-0">
      <h2 class="text-lg font-sans font-medium text-ink">Revision history</h2>
      <button
        type="button"
        class="p-2 -m-2 text-ink-lighter hover:text-ink rounded focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        aria-label="Close history panel"
        @click="close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
      <p class="text-sm text-ink-lighter">
        Every checkpointed save creates a new revision. Restoring a
        revision creates a new entry — nothing is ever lost.
      </p>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p v-if="!loading && revisions.length === 0" class="text-sm text-ink-lighter">No revisions yet.</p>

      <ol class="space-y-2">
        <li
          v-for="rev in revisions"
          :key="rev.id"
          class="border border-line rounded px-3 py-2"
        >
          <div class="flex items-baseline justify-between gap-2">
            <div class="text-sm font-medium text-ink">
              v{{ rev.versionNumber }}
              <span
                v-if="rev.revisionKind !== 'edit'"
                class="ml-1 text-xs uppercase tracking-wide text-accent"
              >{{ rev.revisionKind }}</span>
              <span
                v-if="rev.restoredFromVersion"
                class="ml-1 text-xs text-ink-lighter"
              >from v{{ rev.restoredFromVersion }}</span>
            </div>
            <div class="text-xs text-ink-lighter">{{ formatDate(rev.editedAt) }}</div>
          </div>
          <div class="text-xs text-ink-lighter mt-0.5">
            by {{ rev.editorDisplayName || (rev.editedBy ? 'unknown user' : 'deleted user') }}
          </div>
          <p v-if="rev.note" class="text-xs italic text-ink mt-1">"{{ rev.note }}"</p>
          <div class="mt-2 flex items-center gap-3">
            <button
              type="button"
              class="text-xs text-ink hover:underline"
              :disabled="busy"
              @click="preview(rev.versionNumber)"
            >
              Preview
            </button>
            <button
              v-if="canRestore"
              type="button"
              class="text-xs text-accent hover:underline"
              :disabled="busy"
              @click="restore(rev.versionNumber)"
            >
              Restore
            </button>
          </div>
        </li>
      </ol>
    </div>

    <!-- Preview modal — shows the chosen revision with insertions and
         deletions vs. the immediately prior revision highlighted inline.
         For v1 (no prior) the whole body is shown as "ins" so the reader
         still gets a colour cue that this was the first state. -->
    <div
      v-if="previewRev"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="previewRev = null"
    >
      <div class="bg-paper rounded shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-line">
          <div class="text-sm font-medium text-ink">
            v{{ previewRev.versionNumber }} preview ·
            <span class="text-ink-lighter font-normal">
              {{ previewRev.editorDisplayName || 'unknown' }} ·
              {{ formatDate(previewRev.editedAt) }}
            </span>
            <span
              v-if="previewRev.versionNumber > 1"
              class="text-ink-lighter font-normal"
            >· diff vs v{{ previewRev.versionNumber - 1 }}</span>
          </div>
          <button
            type="button"
            class="text-ink-lighter hover:text-ink"
            @click="closePreview"
          >Close</button>
        </div>
        <div class="px-4 pt-2 pb-1 flex items-center gap-3 text-xs border-b border-line">
          <span class="inline-flex items-center gap-1 text-ink-lighter">
            <span class="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300"></span>
            added
          </span>
          <span class="inline-flex items-center gap-1 text-ink-lighter">
            <span class="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-300"></span>
            removed
          </span>
          <span v-if="previewLoading" class="ml-auto text-ink-lighter">Loading…</span>
        </div>
        <div class="overflow-y-auto px-4 py-3">
          <h3 class="font-serif text-lg text-ink mb-2">
            <template v-for="(seg, i) in titleDiff" :key="`t-${i}`">
              <span v-if="seg.type === 'ins'" class="bg-green-100 text-green-900 rounded px-0.5">{{ seg.text }}</span>
              <span v-else-if="seg.type === 'del'" class="bg-red-100 text-red-900 line-through rounded px-0.5">{{ seg.text }}</span>
              <span v-else>{{ seg.text }}</span>
            </template>
          </h3>
          <div class="whitespace-pre-wrap text-sm text-ink leading-relaxed">
            <template v-for="(seg, i) in bodyDiff" :key="`b-${i}`">
              <span v-if="seg.type === 'ins'" class="bg-green-100 text-green-900 rounded px-0.5">{{ seg.text }}</span>
              <span v-else-if="seg.type === 'del'" class="bg-red-100 text-red-900 line-through rounded px-0.5">{{ seg.text }}</span>
              <span v-else>{{ seg.text }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { writingApi } from '@/api/writing'
import { wordDiff, type DiffSegment } from '@/utils/word-diff'
import type {
  WritingBlockRevision,
  WritingBlockRevisionSummary,
} from '@shared/WritingBlockRevision'

const props = defineProps<{
  modelValue: boolean
  writingId: string
  canRestore: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'restored'): void
}>()

const revisions = ref<WritingBlockRevisionSummary[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const previewRev = ref<WritingBlockRevision | null>(null)
// The immediately prior revision (versionNumber - 1) loaded alongside
// the preview so we can render a word-level diff. Null when previewing
// v1 (treated as all-insertions) or while still fetching.
const previewPrev = ref<WritingBlockRevision | null>(null)
const previewLoading = ref(false)

const titleDiff = computed<DiffSegment[]>(() => {
  if (!previewRev.value) return []
  const before = previewPrev.value?.title ?? ''
  const after = previewRev.value.title
  if (!before) return [{ type: 'ins', text: after }]
  return wordDiff(before, after)
})

const bodyDiff = computed<DiffSegment[]>(() => {
  if (!previewRev.value) return []
  const before = previewPrev.value?.body ?? ''
  const after = previewRev.value.body
  if (!before) return [{ type: 'ins', text: after }]
  return wordDiff(before, after)
})

function close() {
  emit('update:modelValue', false)
}

async function refresh() {
  if (!props.writingId) return
  loading.value = true
  error.value = ''
  try {
    revisions.value = await writingApi.listRevisions(props.writingId)
  } catch (e: any) {
    error.value = e?.message || 'Failed to load history'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.writingId],
  ([open]) => {
    if (open) refresh()
  },
  { immediate: true }
)

async function preview(versionNumber: number) {
  busy.value = true
  previewLoading.value = true
  previewPrev.value = null
  try {
    const current = await writingApi.getRevision(props.writingId, versionNumber)
    previewRev.value = current
    // Fetch v(N-1) in parallel with rendering so the diff snaps in as
    // soon as it's available. If the prior fetch fails, fall back to
    // treating the whole body as an insertion (handled in the diff
    // computed).
    if (versionNumber > 1) {
      try {
        previewPrev.value = await writingApi.getRevision(props.writingId, versionNumber - 1)
      } catch {
        previewPrev.value = null
      }
    }
  } catch (e: any) {
    error.value = e?.message || 'Failed to load revision'
  } finally {
    busy.value = false
    previewLoading.value = false
  }
}

function closePreview() {
  previewRev.value = null
  previewPrev.value = null
}

async function restore(versionNumber: number) {
  if (!confirm(`Restore v${versionNumber}? The current state will be preserved as a new revision first.`)) return
  busy.value = true
  error.value = ''
  try {
    await writingApi.restore(props.writingId, versionNumber)
    await refresh()
    emit('restored')
  } catch (e: any) {
    error.value = e?.message || 'Failed to restore revision'
  } finally {
    busy.value = false
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>
