<template>
  <div
    v-if="show"
    class="auto-continue-button fixed bottom-8 right-8 z-50"
  >
    <button
      @click="handleContinue"
      class="group bg-ink text-paper px-6 py-3 rounded-sm shadow-lg hover:bg-ink-light flex items-center gap-3"
      :aria-label="buttonText"
    >
      <span class="text-sm tracking-wide font-sans">{{ buttonText }}</span>
      <svg
        class="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

interface Props {
  show: boolean
  buttonText?: string
  targetRoute?: string
  autoHideDelay?: number // milliseconds
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: 'Continue Reading',
  autoHideDelay: 15000, // 15 seconds
})

const emit = defineEmits<{
  continue: []
  hide: []
}>()

let hideTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => props.show, (newValue) => {
  if (newValue) {
    // Auto-hide after delay
    if (hideTimeout) clearTimeout(hideTimeout)
    hideTimeout = setTimeout(() => {
      emit('hide')
    }, props.autoHideDelay)
  } else {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
  }
})

const handleContinue = () => {
  emit('continue')
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
}

onUnmounted(() => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
  }
})
</script>

<style scoped>
</style>
