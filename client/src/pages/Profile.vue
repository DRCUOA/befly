<template>
  <div>
    <h1 class="text-3xl font-bold mb-6">Profile</h1>
    
    <div v-if="!user" class="text-center py-8">
      <p class="text-gray-500">Not authenticated</p>
      <router-link
        to="/signin"
        class="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Sign In
      </router-link>
    </div>
    
    <div v-else class="bg-white rounded-lg shadow p-6 space-y-4">
      <div v-if="!isEditing">
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <p class="mt-1 text-gray-900">{{ user.email }}</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700">Display Name</label>
          <p class="mt-1 text-gray-900">{{ user.displayName }}</p>
        </div>
      </div>
      
      <form v-else @submit.prevent="handleUpdate" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <p class="mt-1 text-gray-500 text-sm">{{ user.email }}</p>
          <p class="mt-1 text-xs text-gray-400">Email cannot be changed</p>
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
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter display name..."
          />
        </div>
        
        <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-4">
          <p class="text-red-800 text-sm">{{ error }}</p>
        </div>
        
        <div class="flex space-x-4">
          <button
            type="submit"
            :disabled="submitting"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ submitting ? 'Updating...' : 'Update Profile' }}
          </button>
          <button
            type="button"
            @click="cancelEdit"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
      
      <div>
        <label class="block text-sm font-medium text-gray-700">Role</label>
        <p class="mt-1">
          <span
            class="inline-block px-2 py-1 text-xs rounded"
            :class="{
              'bg-purple-100 text-purple-800': user.role === 'admin',
              'bg-gray-100 text-gray-800': user.role === 'user'
            }"
          >
            {{ user.role === 'admin' ? 'Admin' : 'User' }}
          </span>
        </p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700">Status</label>
        <p class="mt-1">
          <span
            class="inline-block px-2 py-1 text-xs rounded"
            :class="{
              'bg-green-100 text-green-800': user.status === 'active',
              'bg-yellow-100 text-yellow-800': user.status === 'inactive',
              'bg-red-100 text-red-800': user.status === 'suspended'
            }"
          >
            {{ user.status }}
          </span>
        </p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700">Member Since</label>
        <p class="mt-1 text-gray-900">{{ formattedDate }}</p>
      </div>
      
      <div class="pt-4 border-t flex justify-between items-center">
        <button
          v-if="!isEditing"
          @click="isEditing = true"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Edit Profile
        </button>
        <button
          @click="handleSignOut"
          class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { api } from '../api/client'
import type { ApiResponse } from '@shared/ApiResponses'
import type { User } from '../domain/User'

const router = useRouter()
const { user, signout, fetchCurrentUser } = useAuth()

const isEditing = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)

const form = ref({
  displayName: ''
})

const formattedDate = computed(() => {
  if (!user.value) return ''
  const date = new Date(user.value.createdAt)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

// Initialize form when user data is available or changes
watch(user, (newUser) => {
  if (newUser) {
    form.value.displayName = newUser.displayName || ''
  }
}, { immediate: true })

const cancelEdit = () => {
  isEditing.value = false
  error.value = null
  if (user.value) {
    form.value.displayName = user.value.displayName || ''
  }
}

const handleUpdate = async () => {
  if (!form.value.displayName.trim()) {
    error.value = 'Display name is required'
    return
  }

  try {
    submitting.value = true
    error.value = null
    
    await api.put<ApiResponse<User>>('/auth/me', {
      displayName: form.value.displayName
    })
    
    // Refresh user data
    await fetchCurrentUser()
    isEditing.value = false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update profile'
  } finally {
    submitting.value = false
  }
}

const handleSignOut = async () => {
  try {
    await signout()
    router.push({ name: 'Landing' })
  } catch (err) {
    console.error('Sign out error:', err)
  }
}
</script>
