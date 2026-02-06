<template>
  <div
    v-if="show"
    ref="progressBar"
    class="reading-progress-bar"
    :style="progressStyle"
    :aria-label="`Reading progress: ${Math.round(displayProgress)}%`"
    role="progressbar"
    :aria-valuenow="Math.round(displayProgress)"
    aria-valuemin="0"
    aria-valuemax="100"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  progress: number // 0-100
  show?: boolean
  fadeOut?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  fadeOut: false,
})

const progressBar = ref<HTMLElement | null>(null)
const lastProgress = ref(0)

// Throttle progress updates to prevent excessive re-renders
const displayProgress = computed(() => {
  const current = Math.min(100, Math.max(0, props.progress))
  
  // Only update if change is significant (> 0.5%)
  if (Math.abs(current - lastProgress.value) > 0.5) {
    lastProgress.value = current
  }
  
  return lastProgress.value
})

const progressStyle = computed(() => {
  const baseStyle: Record<string, string> = {
    width: `${displayProgress.value}%`,
  }

  if (props.fadeOut) {
    baseStyle.opacity = '0'
  }

  return baseStyle
})

watch(() => props.progress, (newProgress) => {
  // Force update if progress jumps significantly (e.g., scroll restoration)
  if (Math.abs(newProgress - lastProgress.value) > 5) {
    lastProgress.value = Math.min(100, Math.max(0, newProgress))
  }
})

watch(() => props.fadeOut, (shouldFade) => {
  if (shouldFade && progressBar.value) {
    progressBar.value.style.opacity = '0'
  }
})
</script>

<style scoped>
.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background: #1A1A1A;
  z-index: 100;
}

.reading-progress-bar.hidden-progress {
  opacity: 0;
}
</style>
