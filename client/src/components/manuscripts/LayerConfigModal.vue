<!--
  LayerConfigModal — the user-facing surface for the Configurable Spine
  Depth refactor. Opened from the Book Room's "Configure layers" button
  (which itself is feature-flagged). Lists the current spine layers
  with their labels, lets the user add a new layer above the current
  top (wrap_above policy), and lets the user remove a layer with an
  affected-node confirmation step.

  Adds are reversible (you can remove the layer you just added) and
  destructive removes are gated behind a one-step confirmation pane
  showing exactly which sections will be affected — the plan calls for
  "explicit user confirmation modal listing the affected nodes" before
  any flatten happens.

  The modal does NOT mutate manuscript state directly; it asks the
  server via manuscriptsApi.addSpineLayer / removeSpineLayer and emits
  `updated` with the full ManuscriptWithSpine the server returns. The
  parent (ManuscriptDetail) reconciles its local state from the emit
  so we don't drift between optimistic local edits and the server's
  authoritative tree.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { manuscriptsApi } from '@/api/manuscripts'
import { ApiError } from '@/api/client'
import type {
  ManuscriptProject,
  ManuscriptSection,
  ManuscriptItem,
  ManuscriptWithSpine,
} from '@shared/Manuscript'
import { MAX_SPINE_DEPTH } from '@shared/Manuscript'

interface RemovalPreview {
  /** Level the user clicked Remove on. */
  level: number
  /** Sections that will be deleted (the layer's nodes themselves). */
  toDelete: ManuscriptSection[]
  /** Sections that will be promoted to the grandparent / shifted up a level. */
  toPromote: ManuscriptSection[]
  /** Items at risk of being orphaned (only set when removing the deepest layer with items). */
  orphanItems: ManuscriptItem[]
}

const props = defineProps<{
  /** Controls v-model:open from the parent. */
  modelValue: boolean
  manuscript: ManuscriptProject
  sections: ManuscriptSection[]
  items: ManuscriptItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  /** Fired when the server returns a successful add/remove; parent rehydrates. */
  (e: 'updated', payload: ManuscriptWithSpine): void
}>()

const newLayerLabel = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
/** Inline preview pane shown when the user clicks Remove on a row. */
const confirmingRemoval = ref<RemovalPreview | null>(null)

/** Reset transient state every time the modal opens. */
watch(() => props.modelValue, isOpen => {
  if (isOpen) {
    newLayerLabel.value = ''
    error.value = null
    confirmingRemoval.value = null
    submitting.value = false
  }
})

/**
 * The current labels list, indexed from outermost (level 1) inward.
 * spine_layer_labels in the DB is JSONB and the server returns a
 * string array, so this is a straightforward pass-through.
 */
const layerRows = computed(() =>
  props.manuscript.spineLayerLabels.map((label, idx) => ({
    level: idx + 1,
    label,
  }))
)

const atMaxDepth = computed(() => props.manuscript.spineDepth >= MAX_SPINE_DEPTH)

/** Suggested default for a brand-new layer: pull from a conventional sequence. */
const suggestedLabel = computed(() => {
  // Match the plan's "open question" suggestion: depth-2 default 'Chapter',
  // depth-3 default 'Part', depth-4 default 'Volume'. The user can rename
  // immediately after the add.
  const seq = ['Chapter', 'Part', 'Volume']
  // After add, the new layer will be at the new top (level 1) and depth
  // will be spineDepth+1. Pick the label that corresponds to that level
  // in the conventional sequence, capped at the last entry.
  const targetIdx = Math.min(props.manuscript.spineDepth - 1, seq.length - 1)
  return seq[Math.max(0, targetIdx)] ?? 'Layer'
})

/**
 * Build the affected-nodes preview when the user clicks Remove on a
 * row. We compute this client-side from the already-loaded sections /
 * items so the confirmation pane can show the user exactly what will
 * happen before any HTTP call goes out. The server reproduces the same
 * computation authoritatively in planFlattenLevel.
 */
function previewRemoval(level: number): RemovalPreview {
  const toDelete = props.sections.filter(s => s.level === level)
  const toPromote = props.sections.filter(s => s.level > level)
  // Only meaningful when removing the deepest layer; otherwise the
  // server allows the removal and items are unaffected (their parents
  // just shift up a level).
  const orphanItems = level === props.manuscript.spineDepth
    ? props.items.filter(i => i.sectionId && toDelete.some(s => s.id === i.sectionId))
    : []
  return { level, toDelete, toPromote, orphanItems }
}

async function onAdd() {
  const label = newLayerLabel.value.trim() || suggestedLabel.value
  if (!label) {
    error.value = 'Layer label is required'
    return
  }
  submitting.value = true
  error.value = null
  try {
    const result = await manuscriptsApi.addSpineLayer(props.manuscript.id, label)
    emit('updated', result)
    newLayerLabel.value = ''
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to add layer'
  } finally {
    submitting.value = false
  }
}

async function onConfirmRemoval() {
  if (!confirmingRemoval.value) return
  if (confirmingRemoval.value.orphanItems.length > 0) {
    error.value = 'Cannot remove the deepest layer while items are attached to it'
    return
  }
  submitting.value = true
  error.value = null
  try {
    const result = await manuscriptsApi.removeSpineLayer(
      props.manuscript.id,
      confirmingRemoval.value.level,
    )
    emit('updated', result)
    confirmingRemoval.value = null
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to remove layer'
  } finally {
    submitting.value = false
  }
}

function close() {
  if (submitting.value) return
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configure spine layers"
      @click.self="close"
      @keydown.escape="close"
      tabindex="-1"
    >
      <div class="bg-paper border border-line shadow-xl max-w-xl w-full max-h-[80vh] overflow-y-auto">
        <header class="px-6 py-4 border-b border-line flex items-center justify-between">
          <h2 class="text-lg font-light tracking-tight">Configure spine layers</h2>
          <button
            type="button"
            @click="close"
            class="p-1 text-ink-lighter hover:text-ink"
            aria-label="Close"
            :disabled="submitting"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="px-6 py-4 space-y-6">
          <!-- Current depth + labels -->
          <section>
            <p class="text-sm text-ink-light mb-3">
              This manuscript has
              <strong>{{ manuscript.spineDepth }}</strong>
              container {{ manuscript.spineDepth === 1 ? 'layer' : 'layers' }}.
              Items always attach to the deepest layer.
            </p>
            <ul class="border border-line divide-y divide-line">
              <li
                v-for="row in layerRows"
                :key="row.level"
                class="flex items-center justify-between px-4 py-2 text-sm"
              >
                <div class="flex items-center gap-3">
                  <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
                    Layer {{ row.level }}
                  </span>
                  <span class="font-medium">{{ row.label }}</span>
                </div>
                <button
                  v-if="manuscript.spineDepth > 1"
                  type="button"
                  class="text-xs text-red-700 hover:text-red-900 underline"
                  :disabled="submitting"
                  @click="confirmingRemoval = previewRemoval(row.level)"
                >
                  Remove this layer
                </button>
              </li>
            </ul>
          </section>

          <!-- Add layer above -->
          <section v-if="!confirmingRemoval">
            <h3 class="text-sm font-medium mb-2">Add a layer above</h3>
            <p class="text-xs text-ink-lighter mb-3">
              Every existing top-level section becomes a child of a single new container
              named below. You can rename it any time, or split it later.
            </p>
            <div class="flex gap-2">
              <input
                v-model="newLayerLabel"
                type="text"
                :placeholder="suggestedLabel"
                class="flex-1 px-3 py-2 border border-line bg-surface/30 text-sm font-light"
                :disabled="submitting || atMaxDepth"
                maxlength="120"
                @keydown.enter.prevent="onAdd"
              />
              <button
                type="button"
                class="px-3 py-2 text-sm font-sans bg-ink text-paper hover:bg-ink-light disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="submitting || atMaxDepth"
                @click="onAdd"
              >
                Add layer
              </button>
            </div>
            <p v-if="atMaxDepth" class="mt-2 text-xs text-ink-lighter italic">
              Maximum depth ({{ MAX_SPINE_DEPTH }}) reached.
            </p>
          </section>

          <!-- Confirmation pane for layer removal -->
          <section v-else class="border border-red-400/40 bg-red-50/40 p-4 space-y-3">
            <h3 class="text-sm font-medium text-red-900">
              Remove layer {{ confirmingRemoval.level }} ({{ layerRows[confirmingRemoval.level - 1]?.label }})?
            </h3>

            <div v-if="confirmingRemoval.orphanItems.length > 0">
              <p class="text-sm text-red-900">
                {{ confirmingRemoval.orphanItems.length }} item(s) are attached to sections at this layer.
                Removing it would leave them without a container. Move or delete them first.
              </p>
              <ul class="mt-2 text-xs text-ink-light list-disc pl-5 max-h-32 overflow-y-auto">
                <li v-for="i in confirmingRemoval.orphanItems" :key="i.id">{{ i.title }}</li>
              </ul>
            </div>

            <div v-else>
              <p class="text-sm">
                <strong>{{ confirmingRemoval.toDelete.length }}</strong>
                section(s) will be deleted:
              </p>
              <ul class="text-xs text-ink-light list-disc pl-5 max-h-24 overflow-y-auto mt-1">
                <li v-for="s in confirmingRemoval.toDelete" :key="s.id">{{ s.title }}</li>
              </ul>
              <p v-if="confirmingRemoval.toPromote.length > 0" class="text-sm mt-3">
                <strong>{{ confirmingRemoval.toPromote.length }}</strong>
                section(s) below it will shift up one layer:
              </p>
              <ul v-if="confirmingRemoval.toPromote.length > 0"
                  class="text-xs text-ink-light list-disc pl-5 max-h-24 overflow-y-auto mt-1">
                <li v-for="s in confirmingRemoval.toPromote" :key="s.id">{{ s.title }}</li>
              </ul>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                class="px-3 py-1.5 text-sm border border-line text-ink-light hover:text-ink"
                :disabled="submitting"
                @click="confirmingRemoval = null"
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-sm bg-red-700 text-paper hover:bg-red-800 disabled:opacity-50"
                :disabled="submitting || confirmingRemoval.orphanItems.length > 0"
                @click="onConfirmRemoval"
              >
                Remove layer
              </button>
            </div>
          </section>

          <p v-if="error" class="text-sm text-red-700">{{ error }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
