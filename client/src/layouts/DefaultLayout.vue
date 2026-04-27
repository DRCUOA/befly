<template>
  <div class="min-h-screen page-canvas">
    <header
      class="w-full border-b border-line bg-paper sticky top-0 z-50"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div class="flex items-center gap-4 md:gap-12">
          <router-link
            :to="isAuthenticated ? '/home' : '/'"
            class="flex items-center gap-2 text-xl sm:text-2xl font-light tracking-tight hover:text-ink-light"
          >
            <AppLogo size-class="h-8 w-8 sm:h-9 sm:w-9" />
            {{ appConfig.appName }}
          </router-link>
          <nav class="hidden md:flex gap-8 text-sm tracking-wide font-sans items-center">
            <router-link
              v-if="isAuthenticated"
              to="/home"
              class="pb-0.5 hover:text-ink transition-colors duration-300"
              :class="route.name === 'Home' ? 'text-ink border-b border-ink' : 'text-ink-lighter'"
            >
              Essays
            </router-link>
            <router-link
              v-if="isAuthenticated"
              to="/themes"
              class="pb-0.5 hover:text-ink transition-colors duration-300"
              :class="route.name === 'Themes' ? 'text-ink border-b border-ink' : 'text-ink-lighter'"
            >
              Themes
            </router-link>
            <router-link
              v-if="isAuthenticated"
              to="/manuscripts"
              class="pb-0.5 hover:text-ink transition-colors duration-300"
              :class="['Manuscripts', 'CreateManuscript', 'EditManuscript', 'ManuscriptDetail'].includes(String(route.name)) ? 'text-ink border-b border-ink' : 'text-ink-lighter'"
            >
              Manuscripts
            </router-link>
            <router-link
              to="/"
              class="pb-0.5 hover:text-ink transition-colors duration-300"
              :class="route.name === 'Landing' ? 'text-ink border-b border-ink' : 'text-ink-lighter'"
            >
              About
            </router-link>
            <router-link
              to="/help"
              class="pb-0.5 hover:text-ink transition-colors duration-300"
              :class="String(route.name).startsWith('Help') ? 'text-ink border-b border-ink' : 'text-ink-lighter'"
            >
              Help
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/admin"
              class="text-ink-whisper hover:text-ink-lighter text-xs transition-colors duration-300"
            >
              Admin
            </router-link>
          </nav>
        </div>
        <div class="flex items-center gap-2 md:gap-4">
          <template v-if="isAuthenticated">
            <router-link
              to="/write"
              class="hidden sm:block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
            >
              Write
            </router-link>
            <span class="hidden md:block text-sm text-ink-lighter font-sans">{{ user?.displayName }}</span>
            <router-link
              to="/profile"
              class="hidden sm:block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
            >
              Profile
            </router-link>
            <button
              @click="handleSignOut"
              class="hidden sm:block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
            >
              Sign Out
            </button>
          </template>
          <template v-else>
            <router-link
              to="/signin"
              class="hidden sm:block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
            >
              Sign In
            </router-link>
            <router-link
              to="/signup"
              class="hidden sm:block px-4 py-2 text-sm tracking-wide font-sans border border-line bg-paper hover:bg-line text-ink-lighter"
            >
              Sign Up
            </router-link>
          </template>
          <button
            @click="toggleTheme"
            class="text-ink-lighter hover:text-ink transition-colors duration-300 p-1"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          <button
            @click.stop="menuOpen = !menuOpen"
            class="md:hidden text-ink-lighter hover:text-ink"
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
      </div>
      
      <!-- Mobile Menu -->
      <div
        v-if="menuOpen"
        @click.stop
        class="md:hidden border-t border-line bg-paper"
      >
        <nav class="px-4 sm:px-6 md:px-8 py-6 space-y-4">
          <router-link
            v-if="isAuthenticated"
            to="/home"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans hover:text-ink transition-colors duration-300"
            :class="route.name === 'Home' ? 'text-ink' : 'text-ink-lighter'"
          >
            Essays
          </router-link>
          <router-link
            v-if="isAuthenticated"
            to="/themes"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans hover:text-ink transition-colors duration-300"
            :class="route.name === 'Themes' ? 'text-ink' : 'text-ink-lighter'"
          >
            Themes
          </router-link>
          <router-link
            v-if="isAuthenticated"
            to="/manuscripts"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans hover:text-ink transition-colors duration-300"
            :class="['Manuscripts', 'CreateManuscript', 'EditManuscript', 'ManuscriptDetail'].includes(String(route.name)) ? 'text-ink' : 'text-ink-lighter'"
          >
            Manuscripts
          </router-link>
          <router-link
            to="/"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans hover:text-ink transition-colors duration-300"
            :class="route.name === 'Landing' ? 'text-ink' : 'text-ink-lighter'"
          >
            About
          </router-link>
          <router-link
            to="/help"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans hover:text-ink transition-colors duration-300"
            :class="String(route.name).startsWith('Help') ? 'text-ink' : 'text-ink-lighter'"
          >
            Help
          </router-link>
          <template v-if="isAuthenticated">
            <router-link
              to="/write"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-300"
            >
              Write
            </router-link>
            <router-link
              to="/profile"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-300"
            >
              Profile
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/admin"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-ink-whisper hover:text-ink-lighter transition-colors duration-300"
            >
              Admin
            </router-link>
            <button
              @click="handleSignOut"
              class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink w-full text-left transition-colors duration-300"
            >
              Sign Out
            </button>
          </template>
          <template v-else>
            <router-link
              to="/signin"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-300"
            >
              Sign In
            </router-link>
            <router-link
              to="/signup"
              @click="menuOpen = false"
              class="block px-4 py-2 text-sm tracking-wide font-sans border border-line bg-paper hover:bg-line text-ink-lighter w-fit transition-colors duration-300"
            >
              Sign Up
            </router-link>
          </template>
          <div class="border-t border-line pt-4 mt-2">
            <button
              @click="toggleTheme"
              class="flex items-center gap-2 text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-300"
            >
              <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              {{ isDark ? 'Light Mode' : 'Dark Mode' }}
            </button>
          </div>
        </nav>
      </div>
    </header>
    <main :class="mainClasses">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../stores/auth'
import { appConfig } from '../config/app'
import AppFooter from '../components/ui/AppFooter.vue'
import AppLogo from '../components/ui/AppLogo.vue'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const route = useRoute()
const { user, isAuthenticated, isAdmin, signout } = useAuth()
const { isDark, toggle: toggleTheme } = useTheme()
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

// For Home and Themes pages, remove padding to allow full-width sections
const mainClasses = computed(() => {
  const fullBleedRoutes = new Set([
    'Home', 'Themes', 'ThemeDetail',
    'Manuscripts', 'ManuscriptDetail',
  ])
  return fullBleedRoutes.has(String(route.name)) ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8'
})

const handleSignOut = async () => {
  try {
    await signout()
    router.push({ name: 'Landing' })
  } catch (err) {
    console.error('Sign out error:', err)
  }
}
</script>
