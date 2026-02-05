<template>
  <div
    class="back-navigation"
    :class="{ 'fade-out': fadeOut }"
  >
    <router-link
      :to="backRoute"
      class="back-button group inline-flex items-center gap-3 text-sm font-sans text-ink-lighter hover:text-ink transition-all duration-500"
      :aria-label="`Back to ${backLabel}`"
    >
      <svg
        class="w-4 h-4 transition-transform duration-500 group-hover:-translate-x-1"
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
import { useRoute, useRouter } from 'vue-router'

interface Props {
  backRoute?: string
  backLabel?: string
  fadeOut?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  backLabel: 'Back to essays',
  fadeOut: false,
})

const route = useRoute()
const router = useRouter()

const backRoute = computed(() => {
  if (props.backRoute) return props.backRoute
  
  // Default: go back in history or to home
  return '/home'
})
</script>

<style scoped>
.back-navigation {
  transition: opacity 2s cubic-bezier(0.4, 0, 0.2, 1), transform 2s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-navigation.fade-out {
  opacity: 0;
  pointer-events: none;
}

.back-button {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
