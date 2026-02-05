<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="auto-continue-button fixed bottom-8 right-8 z-50"
      :style="buttonStyle"
    >
      <button
        @click="handleContinue"
        class="group bg-ink text-paper px-6 py-3 rounded-sm shadow-lg hover:bg-ink-light transition-all duration-500 flex items-center gap-3"
        :aria-label="buttonText"
      >
        <span class="text-sm tracking-wide font-sans">{{ buttonText }}</span>
        <svg
          class="w-3 h-3 transition-transform duration-500 group-hover:translate-x-1"
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
  </Transition>
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

const showButton = ref(false)
let hideTimeout: ReturnType<typeof setTimeout> | null = null

const buttonStyle = computed(() => {
  return {
    opacity: showButton.value ? '1' : '0',
    transition: 'opacity 1s ease-in',
  }
})

watch(() => props.show, (newValue) => {
  if (newValue) {
    showButton.value = true
    
    // Auto-hide after delay
    if (hideTimeout) clearTimeout(hideTimeout)
    hideTimeout = setTimeout(() => {
      showButton.value = false
      setTimeout(() => {
        emit('hide')
      }, 1000)
    }, props.autoHideDelay)
  } else {
    showButton.value = false
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
  }
})

const handleContinue = () => {
  emit('continue')
  showButton.value = false
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s ease-in;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
