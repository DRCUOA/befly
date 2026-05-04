<template>
  <div class="border border-line p-2 bg-paper">
    <p class="text-[10px] uppercase tracking-widest text-ink-lighter font-sans mb-1">{{ kindLabel }}</p>
    <textarea
      v-model="draft"
      rows="2"
      :readonly="readOnly"
      :placeholder="readOnly ? '—' : `What is ${kindLabel.toLowerCase()} here…`"
      @blur="onBlur"
      class="block w-full text-xs rounded border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink resize-none"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { KnowledgeKind } from '@shared/StoryCraft'

const props = defineProps<{
  kind: KnowledgeKind
  value: string
  readOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', text: string | null): void
}>()

const draft = ref(props.value || '')
watch(() => props.value, (v) => { draft.value = v || '' })

const kindLabel = computed(() => ({
  known: 'Knows',
  suspected: 'Suspects',
  misread: 'Misreads',
  hidden: 'Hidden',
  silent: 'Silent on',
}[props.kind]))

function onBlur() {
  if (props.readOnly) return
  const cleaned = draft.value.trim()
  if (cleaned === (props.value || '').trim()) return
  emit('save', cleaned === '' ? null : cleaned)
}
</script>
