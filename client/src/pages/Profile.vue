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
      <div>
        <label class="block text-sm font-medium text-gray-700">Email</label>
        <p class="mt-1 text-gray-900">{{ user.email }}</p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700">Display Name</label>
        <p class="mt-1 text-gray-900">{{ user.displayName }}</p>
      </div>
      
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
      
      <div class="pt-4 border-t">
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
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const { user, signout } = useAuth()

const formattedDate = computed(() => {
  if (!user.value) return ''
  const date = new Date(user.value.createdAt)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const handleSignOut = async () => {
  try {
    await signout()
    router.push('/')
  } catch (err) {
    console.error('Sign out error:', err)
  }
}
</script>
