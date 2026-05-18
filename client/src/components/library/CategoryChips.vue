<template>
  <div v-if="categories.length" class="flex flex-wrap gap-1 items-center">
    <span
      v-for="c in shown"
      :key="c"
      class="chip"
    >{{ c }}</span>

    <button
      v-if="hidden > 0"
      type="button"
      :aria-expanded="expanded"
      :aria-label="expanded ? 'Show fewer categories' : `Show ${hidden} more categories`"
      @click.stop="expanded = !expanded"
      class="chip chip-toggle"
    >{{ expanded ? '− less' : `+${hidden}` }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  categories: string[]
  initialLimit?: number
}>(), {
  initialLimit: 2,
})

const expanded = ref(false)

const shown = computed(() =>
  expanded.value ? props.categories : props.categories.slice(0, props.initialLimit)
)

const hidden = computed(() =>
  Math.max(0, props.categories.length - props.initialLimit)
)
</script>

<style scoped>
.chip {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--color-line, #d6d3d1);
  color: var(--color-ink-light, #57534e);
  line-height: 1.4;
  white-space: nowrap;
}
.chip-toggle {
  cursor: pointer;
  color: var(--color-ink-lighter, #a8a29e);
  background: transparent;
  transition: color 0.2s, background-color 0.2s;
}
.chip-toggle:hover {
  color: var(--color-ink, #1c1917);
  background: var(--color-surface, #f5f5f4);
}
.chip-toggle:focus-visible {
  outline: 2px solid var(--color-ink, #1c1917);
  outline-offset: 1px;
}
</style>
