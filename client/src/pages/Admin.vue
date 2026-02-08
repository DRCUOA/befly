<template>
  <div class="admin-page">
    <!-- Header -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-6xl mx-auto">
        <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter mb-4">
          Administration
        </p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4">
          User Management
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light">
          Manage users, roles, and account status
        </p>
      </div>
    </div>

    <!-- Content -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 bg-paper">
      <div class="max-w-6xl mx-auto">
        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <p class="text-sm text-ink-lighter uppercase tracking-wider">Total Users</p>
            <p class="text-2xl font-semibold mt-1">{{ totalUsers }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <p class="text-sm text-ink-lighter uppercase tracking-wider">Admins</p>
            <p class="text-2xl font-semibold mt-1">{{ adminCount }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <p class="text-sm text-ink-lighter uppercase tracking-wider">Active</p>
            <p class="text-2xl font-semibold mt-1 text-green-600">{{ activeCount }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <p class="text-sm text-ink-lighter uppercase tracking-wider">Suspended</p>
            <p class="text-2xl font-semibold mt-1 text-red-600">{{ suspendedCount }}</p>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading users...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
          <p class="text-red-800">{{ error }}</p>
          <button @click="loadUsers" class="mt-3 text-sm text-red-600 hover:text-red-800 underline">
            Try again
          </button>
        </div>

        <!-- User List -->
        <div v-else class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-gray-100 bg-gray-50/50">
                  <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-lighter">User</th>
                  <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-lighter">Role</th>
                  <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-lighter">Status</th>
                  <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-lighter">Joined</th>
                  <th class="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-lighter">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="u in users"
                  :key="u.id"
                  class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td class="px-4 py-3">
                    <div class="flex flex-col">
                      <span class="font-medium text-ink">{{ u.displayName }}</span>
                      <span class="text-sm text-ink-lighter">{{ u.email }}</span>
                      <span class="text-xs text-gray-400 font-mono">{{ u.id.substring(0, 8) }}...</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-block px-2 py-1 text-xs rounded font-medium"
                      :class="{
                        'bg-purple-100 text-purple-800': u.role === 'admin',
                        'bg-gray-100 text-gray-700': u.role === 'user'
                      }"
                    >
                      {{ u.role }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-block px-2 py-1 text-xs rounded font-medium"
                      :class="{
                        'bg-green-100 text-green-800': u.status === 'active',
                        'bg-yellow-100 text-yellow-800': u.status === 'inactive',
                        'bg-red-100 text-red-800': u.status === 'suspended'
                      }"
                    >
                      {{ u.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-ink-light">
                    {{ formatDate(u.createdAt) }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <!-- Self-indicator -->
                      <span v-if="u.id === currentUserId" class="text-xs text-ink-lighter italic self-center mr-2">
                        (you)
                      </span>

                      <!-- Role Toggle -->
                      <button
                        v-if="u.id !== currentUserId"
                        @click="toggleRole(u)"
                        :disabled="actionInProgress === u.id"
                        class="px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50"
                        :class="u.role === 'admin'
                          ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                          : 'border-purple-300 text-purple-700 hover:bg-purple-50'"
                        :title="u.role === 'admin' ? 'Demote to user' : 'Promote to admin'"
                      >
                        {{ u.role === 'admin' ? 'Demote' : 'Promote' }}
                      </button>

                      <!-- Status Toggle -->
                      <button
                        v-if="u.id !== currentUserId"
                        @click="toggleStatus(u)"
                        :disabled="actionInProgress === u.id"
                        class="px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50"
                        :class="u.status === 'active'
                          ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                          : 'border-green-300 text-green-700 hover:bg-green-50'"
                        :title="u.status === 'active' ? 'Suspend user' : 'Activate user'"
                      >
                        {{ u.status === 'active' ? 'Suspend' : 'Activate' }}
                      </button>

                      <!-- Delete -->
                      <button
                        v-if="u.id !== currentUserId"
                        @click="confirmDelete(u)"
                        :disabled="actionInProgress === u.id"
                        class="px-3 py-1.5 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete user"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Feedback Message -->
        <div
          v-if="feedbackMessage"
          class="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 transition-opacity"
          :class="feedbackType === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'"
        >
          {{ feedbackMessage }}
        </div>

        <!-- Delete Confirmation Modal -->
        <div v-if="userToDelete" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-semibold mb-2">Delete User</h3>
            <p class="text-ink-light mb-1">
              Are you sure you want to delete this user?
            </p>
            <p class="font-medium mb-1">{{ userToDelete.displayName }}</p>
            <p class="text-sm text-ink-lighter mb-4">{{ userToDelete.email }}</p>
            <p class="text-sm text-red-600 mb-6">
              This will permanently delete the user and all their associated data (writings, themes, comments, appreciations).
            </p>
            <div class="flex justify-end gap-3">
              <button
                @click="userToDelete = null"
                class="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                @click="deleteUser"
                :disabled="actionInProgress === userToDelete.id"
                class="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {{ actionInProgress === userToDelete?.id ? 'Deleting...' : 'Delete User' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { User } from '../domain/User'

interface UserListResponse {
  data: User[]
  meta: { total: number; limit: number; offset: number }
}

const { user: currentUser } = useAuth()
const currentUserId = computed(() => currentUser.value?.id)

const users = ref<User[]>([])
const totalUsers = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const actionInProgress = ref<string | null>(null)
const userToDelete = ref<User | null>(null)
const feedbackMessage = ref<string | null>(null)
const feedbackType = ref<'success' | 'error'>('success')

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const activeCount = computed(() => users.value.filter(u => u.status === 'active').length)
const suspendedCount = computed(() => users.value.filter(u => u.status === 'suspended').length)

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
  feedbackMessage.value = message
  feedbackType.value = type
  setTimeout(() => {
    feedbackMessage.value = null
  }, 3000)
}

const loadUsers = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await api.get<UserListResponse>('/admin/users')
    users.value = response.data
    totalUsers.value = response.meta.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load users'
  } finally {
    loading.value = false
  }
}

const toggleRole = async (u: User) => {
  try {
    actionInProgress.value = u.id
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    await api.put(`/admin/users/${u.id}`, { role: newRole })
    u.role = newRole
    showFeedback(`${u.displayName} is now ${newRole === 'admin' ? 'an admin' : 'a regular user'}`)
  } catch (err) {
    showFeedback(err instanceof Error ? err.message : 'Failed to update role', 'error')
  } finally {
    actionInProgress.value = null
  }
}

const toggleStatus = async (u: User) => {
  try {
    actionInProgress.value = u.id
    const newStatus = u.status === 'active' ? 'suspended' : 'active'
    await api.put(`/admin/users/${u.id}`, { status: newStatus })
    u.status = newStatus
    showFeedback(`${u.displayName} is now ${newStatus}`)
  } catch (err) {
    showFeedback(err instanceof Error ? err.message : 'Failed to update status', 'error')
  } finally {
    actionInProgress.value = null
  }
}

const confirmDelete = (u: User) => {
  userToDelete.value = u
}

const deleteUser = async () => {
  if (!userToDelete.value) return
  
  try {
    actionInProgress.value = userToDelete.value.id
    await api.delete(`/admin/users/${userToDelete.value.id}`)
    const deletedName = userToDelete.value.displayName
    users.value = users.value.filter(u => u.id !== userToDelete.value!.id)
    totalUsers.value--
    userToDelete.value = null
    showFeedback(`${deletedName} has been deleted`)
  } catch (err) {
    showFeedback(err instanceof Error ? err.message : 'Failed to delete user', 'error')
  } finally {
    actionInProgress.value = null
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
}
</style>
