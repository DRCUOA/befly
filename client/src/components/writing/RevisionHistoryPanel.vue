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

    <!-- Preview modal -->
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
          </div>
          <button
            type="button"
            class="text-ink-lighter hover:text-ink"
            @click="previewRev = null"
          >Close</button>
        </div>
        <div class="overflow-y-auto px-4 py-3">
          <h3 class="font-serif text-lg text-ink mb-2">{{ previewRev.title }}</h3>
          <div class="whitespace-pre-wrap text-sm text-ink">{{ previewRev.body }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { writingApi } from '@/api/writing'
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
  try {
    previewRev.value = await writingApi.getRevision(props.writingId, versionNumber)
  } catch (e: any) {
    error.value = e?.message || 'Failed to load revision'
  } finally {
    busy.value = false
  }
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
