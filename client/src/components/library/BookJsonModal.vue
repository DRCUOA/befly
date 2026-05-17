<template>
  <div
    class="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div class="bg-paper border border-line p-4 sm:p-6 w-full max-w-2xl mt-8 sm:mt-0">
      <div class="flex items-start justify-between mb-3 gap-3">
        <div class="min-w-0">
          <h3 class="text-lg font-light tracking-tight truncate">{{ heading }}</h3>
          <p v-if="subhead" class="text-xs text-ink-lighter truncate">{{ subhead }}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            @click="copy"
            class="text-xs px-2 py-1 border border-line text-ink-light hover:text-ink"
            :title="copied ? 'Copied' : 'Copy JSON'"
          >
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
          <button @click="emit('close')" class="text-ink-lighter hover:text-ink p-1" aria-label="Close">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <pre class="json-pre">{{ pretty }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  data: unknown
  heading: string
  subhead?: string
}>()

const emit = defineEmits<{ close: [] }>()

const pretty = computed(() => {
  try {
    return JSON.stringify(props.data, null, 2)
  } catch {
    return String(props.data)
  }
})

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(pretty.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // Clipboard access can be blocked — silent fail is fine for a preview.
  }
}
</script>

<style scoped>
.json-pre {
  max-height: 60vh;
  overflow: auto;
  padding: 0.75rem;
  background: var(--color-surface, #f5f5f4);
  border: 1px solid var(--color-line, #d6d3d1);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--color-ink, #1c1917);
  white-space: pre;
}
</style>
