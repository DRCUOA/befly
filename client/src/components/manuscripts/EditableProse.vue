<template>
  <div class="editable-prose">
    <!-- Display mode -->
    <div v-if="!editing" class="group">
      <p
        v-if="modelValue"
        :class="['prose-content', readonly ? '' : 'cursor-text hover:bg-surface/60 rounded-sm px-1 -mx-1 transition-colors']"
        @click="readonly ? null : startEditing()"
      >
        {{ modelValue }}
      </p>
      <button
        v-else-if="!readonly"
        type="button"
        @click="startEditing()"
        class="text-sm font-light italic text-ink-lighter hover:text-ink transition-colors duration-300 text-left"
      >
        {{ placeholder }}
      </button>
      <p v-else class="text-sm font-light italic text-ink-lighter">
        Not set.
      </p>
    </div>

    <!-- Edit mode -->
    <div v-else class="space-y-2">
      <textarea
        ref="textareaRef"
        v-model="draft"
        :rows="rows"
        :placeholder="placeholder"
        class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink text-base font-light leading-relaxed"
        @keydown.esc.prevent="cancel"
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      />
      <div v-if="error" class="text-sm text-red-700">{{ error }}</div>
      <div class="flex items-center gap-3 text-xs text-ink-lighter font-sans">
        <button
          type="button"
          :disabled="saving"
          @click="save"
          class="px-3 py-1 bg-ink text-paper hover:bg-ink-light disabled:opacity-50 transition-colors text-xs tracking-wide"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          :disabled="saving"
          @click="cancel"
          class="px-3 py-1 border border-line hover:border-ink-lighter text-ink-light hover:text-ink transition-colors text-xs tracking-wide"
        >
          Cancel
        </button>
        <span class="ml-auto hidden sm:inline">
          ⌘/Ctrl + Enter to save · Esc to cancel
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Inline-edit a single string field.
 *
 * Click to expand into a textarea; cancel restores the original value;
 * save calls back to the parent which actually persists. The parent owns
 * the optimistic-vs-revert decision so this component stays untangled
 * from any specific API.
 *
 * Usage:
 *   <EditableProse
 *     :model-value="manuscript.centralQuestion"
 *     placeholder="Add a central question…"
 *     :rows="3"
 *     @save="onSaveCentralQuestion"
 *   />
 */
import { ref, nextTick, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | null | undefined
  /**
   * Parent's save handler. Resolve to commit (editor closes), throw or reject
   * to revert (error shown, editor stays open). Returning a Promise is what
   * lets the editor show a saving indicator while the network round-trip
   * happens. We use a prop callback rather than emit() because emit() returns
   * void in Vue 3 - it can't be awaited.
   */
  onSave: (value: string | null) => void | Promise<void>
  placeholder?: string
  rows?: number
  readonly?: boolean
}>(), {
  placeholder: 'Click to add…',
  rows: 3,
  readonly: false,
})

const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// If the parent's value changes while we're not editing (e.g. another tab,
// or a reload), keep the displayed value in sync.
watch(() => props.modelValue, () => {
  if (!editing.value) draft.value = props.modelValue ?? ''
}, { immediate: true })

async function startEditing() {
  if (props.readonly) return
  draft.value = props.modelValue ?? ''
  error.value = null
  editing.value = true
  await nextTick()
  textareaRef.value?.focus()
  // Put the cursor at the end so the user can keep typing.
  const el = textareaRef.value
  if (el) el.setSelectionRange(el.value.length, el.value.length)
}

function cancel() {
  if (saving.value) return
  draft.value = props.modelValue ?? ''
  error.value = null
  editing.value = false
}

async function save() {
  if (saving.value) return
  const next = draft.value.trim()
  const previous = (props.modelValue ?? '').trim()
  // No-op save: bail out without emitting, so we don't trigger a network round-trip.
  if (next === previous) {
    editing.value = false
    return
  }
  saving.value = true
  error.value = null
  try {
    // Convention: empty string clears the field by sending null.
    await props.onSave(next.length === 0 ? null : next)
    editing.value = false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Save failed'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.prose-content {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
