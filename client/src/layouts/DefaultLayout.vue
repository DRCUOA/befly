<template>
  <div class="min-h-screen bg-paper">
    <header
      class="w-full border-b border-line bg-paper sticky top-0 z-50"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div class="flex items-center gap-4 md:gap-12">
          <router-link
            :to="isAuthenticated ? '/home' : '/'"
            class="flex items-center gap-2 text-xl sm:text-2xl font-light tracking-tight hover:text-ink-light"
          >
            <img :src="logoUrl" alt="" class="h-8 w-8 sm:h-9 sm:w-9" />
            {{ appConfig.appName }}
          </router-link>
          <nav class="hidden md:flex gap-8 text-sm tracking-wide font-sans">
            <router-link
              v-if="isAuthenticated"
              to="/home"
              class="text-ink-lighter hover:text-ink"
            >
              Essays
            </router-link>
            <router-link
              v-if="isAuthenticated"
              to="/themes"
              class="text-ink-lighter hover:text-ink"
            >
              Themes
            </router-link>
            <router-link
              to="/"
              class="text-ink-lighter hover:text-ink"
            >
              About
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/admin"
              class="text-purple-600 hover:text-purple-800"
            >
              Admin
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/cv-enrichment"
              class="text-purple-600 hover:text-purple-800"
            >
              CV Form
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
              class="hidden sm:block px-4 py-2 text-sm tracking-wide font-sans border border-line bg-paper hover:bg-[#E5E5E5] text-[#717171]"
            >
              Sign Up
            </router-link>
          </template>
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
            class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
          >
            Essays
          </router-link>
          <router-link
            v-if="isAuthenticated"
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
          <template v-if="isAuthenticated">
            <router-link
              to="/write"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
            >
              Write
            </router-link>
            <router-link
              to="/profile"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
            >
              Profile
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/admin"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-purple-600 hover:text-purple-800"
            >
              Admin
            </router-link>
            <router-link
              v-if="isAdmin"
              to="/cv-enrichment"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-purple-600 hover:text-purple-800"
            >
              CV Form
            </router-link>
            <button
              @click="handleSignOut"
              class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink w-full text-left"
            >
              Sign Out
            </button>
          </template>
          <template v-else>
            <router-link
              to="/signin"
              @click="menuOpen = false"
              class="block text-sm tracking-wide font-sans text-ink-lighter hover:text-ink"
            >
              Sign In
            </router-link>
            <router-link
              to="/signup"
              @click="menuOpen = false"
              class="block px-4 py-2 text-sm tracking-wide font-sans border border-line bg-paper hover:bg-[#E5E5E5] text-[#717171] w-fit"
            >
              Sign Up
            </router-link>
          </template>
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
import logoUrl from '../assets/logo2.png'

const router = useRouter()
const route = useRoute()
const { user, isAuthenticated, isAdmin, signout } = useAuth()
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
  const isBrowsePage = route.name === 'Home' || route.name === 'Themes'
  return isBrowsePage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8'
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
