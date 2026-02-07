<template>
  <div class="back-navigation">
    <router-link
      :to="backRoute"
      class="back-button group inline-flex items-center gap-3 text-sm font-sans text-ink-lighter hover:text-ink"
      :aria-label="`Back to ${backLabel}`"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      <span class="tracking-wide">{{ backLabel }}</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  backRoute?: string
  backLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  backLabel: 'Back to essays',
})

const backRoute = computed(() => {
  if (props.backRoute) return props.backRoute
  
  // Default: go back in history or to home
  return '/home'
})
</script>

<style scoped>
</style>
