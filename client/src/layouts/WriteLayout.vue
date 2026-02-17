<template>
  <div class="min-h-screen bg-paper flex flex-col">
    <!-- Minimal header: ≤5 controls per epic DoD -->
    <header class="w-full border-b border-line bg-paper sticky top-0 z-50">
      <div class="w-full px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6 flex items-center justify-between min-h-[44px]">
        <router-link
          to="/home"
          class="flex items-center gap-2 text-lg font-light tracking-tight text-ink-lighter hover:text-ink"
        >
          <img :src="logoUrl" alt="" class="h-7 w-7" />
          {{ appConfig.appName }}
        </router-link>

        <!-- Desktop nav: visible at sm (≥640px) -->
        <div class="hidden sm:flex items-center gap-4 text-sm font-sans">
          <router-link to="/home" class="text-ink-lighter hover:text-ink">
            Essays
          </router-link>
          <span class="border-l border-line pl-4 text-xs text-ink-whisper italic tracking-wide">{{ user?.displayName }}</span>
          <button
            @click="handleSignOut"
            class="text-ink-lighter hover:text-ink"
          >
            Sign out
          </button>
        </div>

        <!-- Hamburger toggle: visible below sm (<640px) -->
        <button
          class="sm:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-ink-lighter hover:text-ink"
          aria-label="Toggle navigation menu"
          :aria-expanded="mobileMenuOpen"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg
            class="w-6 h-6 transition-transform duration-200 ease-out"
            :class="mobileMenuOpen ? 'rotate-90' : 'rotate-0'"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
          >
            <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mobile dropdown menu: below sm (<640px), animated slide -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-[200px]"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 max-h-[200px]"
        leave-to-class="opacity-0 max-h-0"
      >
      <div
        v-if="mobileMenuOpen"
        class="sm:hidden border-t border-line bg-paper px-4 py-4 space-y-1 text-sm font-sans overflow-hidden"
      >
        <router-link
          to="/home"
          class="block min-h-[44px] flex items-center px-2 rounded text-ink-lighter hover:text-ink hover:bg-line"
          @click="mobileMenuOpen = false"
        >
          Essays
        </router-link>
        <div class="min-h-[44px] flex items-center px-2 text-xs text-ink-whisper italic tracking-wide border-l-2 border-line ml-1 pl-3">
          {{ user?.displayName }}
        </div>
        <button
          @click="handleSignOut(); mobileMenuOpen = false"
          class="w-full min-h-[44px] flex items-center px-2 rounded text-ink-lighter hover:text-ink hover:bg-line text-left"
        >
          Sign out
        </button>
      </div>
      </Transition>
    </header>
    <main class="flex-1 w-full">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { appConfig } from '../config/app'
import logoUrl from '../assets/logo2.png'

const router = useRouter()
const { user, signout } = useAuth()
const mobileMenuOpen = ref(false)

const handleSignOut = async () => {
  try {
    await signout()
    router.push({ name: 'Landing' })
  } catch (err) {
    console.error('Sign out error:', err)
  }
}
</script>
