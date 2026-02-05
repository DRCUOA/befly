<template>
  <div class="max-w-md mx-auto">
    <h1 class="text-3xl font-bold mb-6">Sign In</h1>
    
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="your@email.com"
        />
      </div>
      
      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          required
          autocomplete="current-password"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter your password"
        />
      </div>
      
      <div v-if="authError" class="bg-red-50 border border-red-200 rounded-md p-4">
        <p class="text-red-800 text-sm">{{ authError }}</p>
      </div>
      
      <div class="flex space-x-4">
        <button
          type="submit"
          :disabled="submitting || isLoading"
          class="flex-1 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ submitting ? 'Signing In...' : 'Sign In' }}
        </button>
        <router-link
          to="/signup"
          class="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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
    router.push('/')
  } catch (err) {
    // Error handled by auth store
  } finally {
    submitting.value = false
  }
}
</script>
