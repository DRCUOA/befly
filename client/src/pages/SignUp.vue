<template>
  <div class="max-w-md mx-auto">
    <h1 class="text-3xl font-bold mb-6">Sign Up</h1>
    
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
        <p v-if="errors.email" class="mt-1 text-sm text-red-600">{{ errors.email }}</p>
      </div>
      
      <div>
        <label for="displayName" class="block text-sm font-medium text-gray-700 mb-1">
          Display Name
        </label>
        <input
          id="displayName"
          v-model="form.displayName"
          type="text"
          required
          autocomplete="name"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Your Name"
        />
        <p v-if="errors.displayName" class="mt-1 text-sm text-red-600">{{ errors.displayName }}</p>
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
          autocomplete="new-password"
          minlength="8"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="At least 8 characters"
        />
        <p v-if="errors.password" class="mt-1 text-sm text-red-600">{{ errors.password }}</p>
        <p class="mt-1 text-sm text-gray-500">Must be at least 8 characters</p>
      </div>
      
      <div>
        <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          v-model="form.confirmPassword"
          type="password"
          required
          autocomplete="new-password"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Confirm your password"
        />
        <p v-if="errors.confirmPassword" class="mt-1 text-sm text-red-600">{{ errors.confirmPassword }}</p>
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
          {{ submitting ? 'Creating Account...' : 'Sign Up' }}
        </button>
        <router-link
          to="/signin"
          class="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Sign In
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const { signup, isLoading, error: authError } = useAuth()

const form = ref({
  email: '',
  displayName: '',
  password: '',
  confirmPassword: ''
})

const errors = ref<Record<string, string>>({})
const submitting = ref(false)

const validate = (): boolean => {
  errors.value = {}

  if (!form.value.email) {
    errors.value.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.value.email = 'Invalid email format'
  }

  if (!form.value.displayName) {
    errors.value.displayName = 'Display name is required'
  } else if (form.value.displayName.trim().length < 2) {
    errors.value.displayName = 'Display name must be at least 2 characters'
  }

  if (!form.value.password) {
    errors.value.password = 'Password is required'
  } else if (form.value.password.length < 8) {
    errors.value.password = 'Password must be at least 8 characters'
  }

  if (form.value.password !== form.value.confirmPassword) {
    errors.value.confirmPassword = 'Passwords do not match'
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = async () => {
  if (!validate()) {
    return
  }

  try {
    submitting.value = true
    await signup(form.value.email, form.value.password, form.value.displayName)
    router.push('/home')
  } catch (err) {
    // Error handled by auth store
  } finally {
    submitting.value = false
  }
}
</script>
