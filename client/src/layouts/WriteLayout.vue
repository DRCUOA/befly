<template>
  <div class="min-h-screen bg-paper flex flex-col">
    <!-- Minimal header: ≤5 controls per epic DoD -->
    <header class="w-full border-b border-line bg-paper sticky top-0 z-50">
      <div class="w-full px-4 sm:px-6 py-3 flex items-center justify-between">
        <router-link
          to="/home"
          class="flex items-center gap-2 text-lg font-light tracking-tight text-ink-lighter hover:text-ink"
        >
          <img :src="logoUrl" alt="" class="h-7 w-7" />
          {{ appConfig.appName }}
        </router-link>
        <div class="flex items-center gap-3 sm:gap-4 text-sm font-sans">
          <router-link to="/home" class="text-ink-lighter hover:text-ink">
            Essays
          </router-link>
          <span class="text-ink-lighter">{{ user?.displayName }}</span>
          <button
            @click="handleSignOut"
            class="text-ink-lighter hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
    <main class="flex-1 w-full">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { appConfig } from '../config/app'
import logoUrl from '../assets/logo2.png'

const router = useRouter()
const { user, signout } = useAuth()

const handleSignOut = async () => {
  try {
    await signout()
    router.push({ name: 'Landing' })
  } catch (err) {
    console.error('Sign out error:', err)
  }
}
</script>
