<template>
  <div class="min-h-screen page-canvas">
    <header
      class="w-full border-b border-line bg-paper sticky top-0 z-50"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 h-16 md:h-[4.5rem] flex items-center justify-between gap-4">
        <!-- LEFT: Logo + primary nav -->
        <div class="flex items-center gap-4 md:gap-10 min-w-0">
          <router-link
            :to="isAuthenticated ? '/home' : '/'"
            class="flex items-center gap-2 text-lg sm:text-xl font-light tracking-tight hover:text-ink-light shrink-0"
          >
            <AppLogo size-class="h-8 w-8 sm:h-9 sm:w-9" />
            <span class="hidden sm:inline">{{ appConfig.appName }}</span>
          </router-link>
          <nav class="hidden md:flex gap-7 text-sm tracking-wide font-sans items-center">
            <template v-if="isAuthenticated">
              <router-link
                to="/home"
                class="pb-0.5 hover:text-ink transition-colors duration-300"
                :class="route.name === 'Home' ? 'text-ink border-b border-ink' : 'text-ink-lighter'"
              >
                Frags
              </router-link>
              <router-link
                to="/themes"
                class="pb-0.5 hover:text-ink transition-colors duration-300"
                :class="route.name === 'Themes' ? 'text-ink border-b border-ink' : 'text-ink-lighter'"
              >
                Themes
              </router-link>
              <router-link
                to="/manuscripts"
                class="pb-0.5 hover:text-ink transition-colors duration-300"
                :class="['Manuscripts', 'CreateManuscript', 'EditManuscript', 'ManuscriptDetail'].includes(String(route.name)) ? 'text-ink border-b border-ink' : 'text-ink-lighter'"
              >
                Manuscripts
              </router-link>
            </template>
            <template v-else>
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
            </template>
          </nav>
        </div>

        <!-- RIGHT: Actions + account -->
        <div class="flex items-center gap-2 sm:gap-3">
          <template v-if="isAuthenticated">
            <!-- Write: primary CTA -->
            <router-link
              to="/write"
              class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm tracking-wide font-sans border border-line text-ink hover:bg-line transition-colors duration-200"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Write</span>
            </router-link>

            <!-- Theme toggle -->
            <button
              @click="toggleTheme"
              class="text-ink-lighter hover:text-ink transition-colors duration-300 p-1.5"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>

            <!-- Account dropdown -->
            <div class="relative hidden md:block" data-account-menu>
              <button
                @click.stop="userMenuOpen = !userMenuOpen"
                class="flex items-center gap-2 px-2 py-1.5 text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-200"
                aria-haspopup="menu"
                :aria-expanded="userMenuOpen"
              >
                <span
                  class="inline-flex items-center justify-center w-7 h-7 rounded-full border border-line bg-paper text-ink-light text-xs font-medium"
                  aria-hidden="true"
                >{{ userInitials }}</span>
                <span class="max-w-[10rem] truncate">{{ user?.displayName }}</span>
                <svg class="w-3.5 h-3.5 transition-transform duration-200" :class="userMenuOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                v-if="userMenuOpen"
                role="menu"
                class="absolute right-0 mt-2 w-60 border border-line bg-paper shadow-lg z-50"
                @click.stop
              >
                <div class="px-4 py-3 border-b border-line">
                  <p class="text-sm font-medium text-ink truncate">{{ user?.displayName }}</p>
                  <p v-if="user?.email" class="text-xs text-ink-lighter truncate">{{ user.email }}</p>
                </div>
                <div class="py-1">
                  <router-link
                    to="/profile"
                    @click="userMenuOpen = false"
                    class="block px-4 py-2 text-sm font-sans text-ink-light hover:bg-line hover:text-ink"
                    role="menuitem"
                  >
                    Profile
                  </router-link>
                  <router-link
                    to="/help"
                    @click="userMenuOpen = false"
                    class="block px-4 py-2 text-sm font-sans text-ink-light hover:bg-line hover:text-ink"
                    role="menuitem"
                  >
                    Help
                  </router-link>
                  <router-link
                    to="/"
                    @click="userMenuOpen = false"
                    class="block px-4 py-2 text-sm font-sans text-ink-light hover:bg-line hover:text-ink"
                    role="menuitem"
                  >
                    About
                  </router-link>
                  <router-link
                    v-if="isAdmin"
                    to="/admin"
                    @click="userMenuOpen = false"
                    class="block px-4 py-2 text-sm font-sans text-ink-lighter hover:bg-line hover:text-ink"
                    role="menuitem"
                  >
                    Admin
                  </router-link>
                </div>
                <div class="border-t border-line py-1">
                  <button
                    @click="handleSignOut"
                    class="block w-full text-left px-4 py-2 text-sm font-sans text-ink-light hover:bg-line hover:text-ink"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <!-- Theme toggle (unauth) -->
            <button
              @click="toggleTheme"
              class="text-ink-lighter hover:text-ink transition-colors duration-300 p-1.5"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
            <router-link
              to="/signin"
              class="hidden sm:block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
            >
              Sign in
            </router-link>
            <router-link
              to="/signup"
              class="hidden sm:block px-3 py-1.5 text-sm tracking-wide font-sans border border-line bg-paper hover:bg-line text-ink-lighter"
            >
              Sign up
            </router-link>
          </template>

          <!-- Mobile menu toggle -->
          <button
            @click.stop="menuOpen = !menuOpen"
            class="md:hidden text-ink-lighter hover:text-ink p-1"
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
            Frags
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
            v-if="isAuthenticated"
            to="/write"
            @click="menuOpen = false"
            class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-300"
          >
            Write
          </router-link>
          <div class="border-t border-line pt-4 mt-2 space-y-4">
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
          </div>
          <template v-if="isAuthenticated">
            <div class="border-t border-line pt-4 mt-2 space-y-4">
              <p class="text-xs uppercase tracking-widest text-ink-whisper">{{ user?.displayName }}</p>
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
                Sign out
              </button>
            </div>
          </template>
          <template v-else>
            <div class="border-t border-line pt-4 mt-2 space-y-4">
              <router-link
                to="/signin"
                @click="menuOpen = false"
                class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-300"
              >
                Sign in
              </router-link>
              <router-link
                to="/signup"
                @click="menuOpen = false"
                class="block px-4 py-2 text-sm tracking-wide font-sans border border-line bg-paper hover:bg-line text-ink-lighter w-fit transition-colors duration-300"
              >
                Sign up
              </router-link>
            </div>
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
              {{ isDark ? 'Light mode' : 'Dark mode' }}
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
const userMenuOpen = ref(false)

// Initials shown in the account avatar circle. Falls back to first char of email.
const userInitials = computed(() => {
  const name = user.value?.displayName?.trim() || ''
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  const email = user.value?.email || ''
  return email ? email[0].toUpperCase() : '?'
})

// Close menus when clicking outside the header.
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('header')) {
    menuOpen.value = false
    userMenuOpen.value = false
  } else if (!target.closest('[data-account-menu]')) {
    // clicked elsewhere in the header — close just the account dropdown
    userMenuOpen.value = false
  }
}

// Close the account dropdown on Escape.
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    userMenuOpen.value = false
    menuOpen.value = false
  }
}

// Close menus on route change so clicks inside the dropdown don't leave it lingering.
watch(() => route.fullPath, () => {
  userMenuOpen.value = false
  menuOpen.value = false
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
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
    userMenuOpen.value = false
    menuOpen.value = false
    await signout()
    router.push({ name: 'Landing' })
  } catch (err) {
    console.error('Sign out error:', err)
  }
}
</script>
