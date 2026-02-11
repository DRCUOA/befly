<template>
  <div class="reading-layout min-h-screen bg-paper">
    <header
      id="header"
      class="w-full bg-paper fixed top-0 z-50 border-b border-line"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div class="flex items-center gap-4 md:gap-12">
          <router-link
            to="/home"
            class="flex items-center gap-2 text-xl sm:text-2xl font-light tracking-tight hover:text-ink-light"
          >
            <img :src="logoUrl" alt="" class="h-8 w-8 sm:h-9 sm:w-9" />
            {{ siteName }}
          </router-link>
        </div>
        <button
          @click.stop="menuOpen = !menuOpen"
          class="text-ink-lighter hover:text-ink"
          aria-label="Menu"
        >
          <svg
            v-if="!menuOpen"
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
          <svg
            v-else
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      
      <!-- Mobile Menu -->
      <div
        v-if="menuOpen"
        @click.stop
        class="border-t border-line bg-paper"
      >
        <nav class="px-4 sm:px-6 md:px-8 py-6 space-y-4">
          <router-link
            to="/home"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
          >
            Essays
          </router-link>
          <router-link
            to="/themes"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
          >
            Themes
          </router-link>
          <router-link
            to="/"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
          >
            About
          </router-link>
        </nav>
      </div>
    </header>

    <div class="w-full px-4 sm:px-6 md:px-8 pt-20 sm:pt-24 md:pt-32 pb-6 bg-paper">
      <div class="max-w-4xl mx-auto">
        <BackNavigation
          :back-route="backRoute"
          :back-label="backLabel"
        />
      </div>
    </div>

    <main class="reading-content">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import BackNavigation from '../components/reading/BackNavigation.vue'
import { appConfig } from '../config/app'
import AppFooter from '../components/ui/AppFooter.vue'
import logoUrl from '../assets/logo2.png'

interface Props {
  backRoute?: string
  backLabel?: string
  siteName?: string
}

const props = withDefaults(defineProps<Props>(), {
  backRoute: '/home',
  backLabel: 'Back to essays',
  siteName: appConfig.appName,
})

// Access props for TypeScript (used in template)
const { backRoute, backLabel, siteName } = props

const menuOpen = ref(false)

// Close menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('header')) {
    menuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.reading-layout {
  font-family: 'Crimson Pro', serif;
}
</style>
