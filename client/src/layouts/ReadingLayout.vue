<template>
  <div class="reading-layout min-h-screen bg-paper">
    <ReadingProgressBar
      :progress="progress"
      :show="progressBarVisible"
      :fade-out="progressBarFaded"
    />
    
    <header
      v-if="interfaceVisible"
      id="header"
      class="w-full bg-paper fixed top-0 z-50 transition-all duration-500"
      :class="{ 'border-b border-line': showBorder }"
      :style="headerStyle"
    >
      <div class="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
        <div class="flex items-center gap-12">
          <router-link
            to="/home"
            class="text-2xl font-light tracking-tight hover:text-ink-light transition-colors duration-500"
          >
            {{ siteName }}
          </router-link>
        </div>
        <button
          class="text-ink-lighter hover:text-ink transition-colors duration-500"
          aria-label="Menu"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </header>

    <div
      v-if="backButtonVisible"
      class="w-full px-8 pt-32 pb-6 bg-paper"
      :class="{ 'fade-out': backButtonFaded }"
    >
      <div class="max-w-4xl mx-auto">
        <BackNavigation
          :back-route="backRoute"
          :back-label="backLabel"
          :fade-out="backButtonFaded"
        />
      </div>
    </div>

    <main
      class="reading-content"
      :style="{ paddingTop: backButtonVisible ? '0' : '2rem' }"
    >
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ReadingProgressBar from '../components/reading/ReadingProgressBar.vue'
import BackNavigation from '../components/reading/BackNavigation.vue'

interface Props {
  progress?: number
  progressBarVisible?: boolean
  progressBarFaded?: boolean
  interfaceVisible?: boolean
  backButtonVisible?: boolean
  backButtonFaded?: boolean
  backRoute?: string
  backLabel?: string
  siteName?: string
}

const props = withDefaults(defineProps<Props>(), {
  progress: 0,
  progressBarVisible: true,
  progressBarFaded: false,
  interfaceVisible: true,
  backButtonVisible: true,
  backButtonFaded: false,
  backRoute: '/home',
  backLabel: 'Back to essays',
  siteName: 'Befly',
})

const showBorder = computed(() => {
  return props.progress > 5
})

const headerStyle = computed(() => {
  if (!props.interfaceVisible) {
    return {
      opacity: '0',
      transform: 'translateY(-100%)',
      pointerEvents: 'none',
    }
  }
  return {}
})
</script>

<style scoped>
.reading-layout {
  font-family: 'Crimson Pro', serif;
}

.reading-content {
  transition: padding-top 0.5s ease;
}

.fade-out {
  opacity: 0;
  pointer-events: none;
  transition: opacity 2s cubic-bezier(0.4, 0, 0.2, 1), transform 2s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
