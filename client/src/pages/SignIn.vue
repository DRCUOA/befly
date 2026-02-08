<template>
  <div class="max-w-md mx-auto px-4 sm:px-0">
    <h1 class="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Sign In</h1>
    
    <form @submit.prevent="handleSubmit" class="space-y-4 sm:space-y-6">
      <div>
        <label for="email" class="block text-sm font-medium text-ink mb-1">
          Email
        </label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          class="mt-1 block w-full rounded-md border-line bg-paper text-ink focus:border-[#717171] focus:ring-[#717171] focus:outline-none text-base sm:text-sm px-3 sm:px-4 py-2"
          placeholder="your@email.com"
        />
      </div>
      
      <div>
        <label for="password" class="block text-sm font-medium text-ink mb-1">
          Password
        </label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          required
          autocomplete="current-password"
          class="mt-1 block w-full rounded-md border-line bg-paper text-ink focus:border-[#717171] focus:ring-[#717171] focus:outline-none text-base sm:text-sm px-3 sm:px-4 py-2"
          placeholder="Enter your password"
        />
      </div>
      
      <div v-if="authError" class="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4">
        <p class="text-red-800 text-xs sm:text-sm">{{ authError }}</p>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-3 sm:space-x-4">
        <button
          type="submit"
          :disabled="submitting || isLoading"
          class="flex-1 px-6 py-2 border border-line bg-paper hover:bg-[#E5E5E5] text-[#717171] rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          {{ submitting ? 'Signing In...' : 'Sign In' }}
        </button>
        <router-link
          to="/signup"
          class="px-6 py-2 border border-line bg-paper hover:bg-[#E5E5E5] text-[#717171] rounded-md text-center text-sm sm:text-base"
        >
          Sign Up
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const { signin, isLoading, error: authError } = useAuth()

const form = ref({
  email: '',
  password: ''
})

const submitting = ref(false)

const handleSubmit = async () => {
  try {
    submitting.value = true
    await signin(form.value.email, form.value.password)
    router.push('/home')
  } catch (err) {
    // Error handled by auth store
  } finally {
    submitting.value = false
  }
}
</script>
