<template>
  <div class="min-h-screen bg-paper">
    <header
      class="w-full border-b border-line bg-paper sticky top-0 z-50 transition-all duration-500"
    >
      <div class="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
        <div class="flex items-center gap-12">
          <router-link
            :to="isAuthenticated ? '/home' : '/'"
            class="text-2xl font-light tracking-tight hover:text-ink-light transition-colors duration-500"
          >
            Befly
          </router-link>
          <nav class="hidden md:flex gap-8 text-sm tracking-wide font-sans">
            <router-link
              v-if="isAuthenticated"
              to="/home"
              class="text-ink-lighter hover:text-ink transition-colors duration-500"
            >
              Essays
            </router-link>
            <router-link
              v-if="isAuthenticated"
              to="/themes"
              class="text-ink-lighter hover:text-ink transition-colors duration-500"
            >
              Themes
            </router-link>
            <router-link
              to="/"
              class="text-ink-lighter hover:text-ink transition-colors duration-500"
            >
              About
            </router-link>
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <template v-if="isAuthenticated">
            <router-link
              to="/write"
              class="text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-500"
            >
              Write
            </router-link>
            <span class="text-sm text-ink-lighter font-sans">{{ user?.displayName }}</span>
            <router-link
              to="/profile"
              class="text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-500"
            >
              Profile
            </router-link>
            <button
              @click="handleSignOut"
              class="text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-500"
            >
              Sign Out
            </button>
          </template>
          <template v-else>
            <router-link
              to="/signin"
              class="text-sm tracking-wide font-sans text-ink-lighter hover:text-ink transition-colors duration-500"
            >
              Sign In
            </router-link>
            <router-link
              to="/signup"
              class="px-4 py-2 text-sm tracking-wide font-sans text-paper bg-ink hover:bg-ink-light transition-colors duration-500"
            >
              Sign Up
            </router-link>
          </template>
          <button
            class="md:hidden text-ink-lighter hover:text-ink transition-colors duration-500"
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
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-8 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const { user, isAuthenticated, signout } = useAuth()

const handleSignOut = async () => {
  try {
    await signout()
    router.push({ name: 'Landing' })
  } catch (err) {
    console.error('Sign out error:', err)
  }
}
</script>
