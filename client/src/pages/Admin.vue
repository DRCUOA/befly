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
          Manage users, roles, and all content
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
        <div v-else class="space-y-4">
          <div
            v-for="u in users"
            :key="u.id"
            class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
          >
            <!-- User Row (always visible) -->
            <div
              class="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
              @click="toggleExpand(u.id)"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <!-- Expand chevron -->
                <svg
                  class="w-4 h-4 text-ink-lighter flex-shrink-0 transition-transform duration-200"
                  :class="{ 'rotate-90': expandedUserId === u.id }"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>

                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-ink truncate">{{ u.displayName }}</span>
                    <span v-if="u.id === currentUserId" class="text-xs text-ink-lighter italic">(you)</span>
                  </div>
                  <span class="text-sm text-ink-lighter truncate">{{ u.email }}</span>
                </div>
              </div>

              <div class="flex items-center gap-2 sm:gap-3 flex-wrap" @click.stop>
                <!-- Role badge -->
                <span
                  class="inline-block px-2 py-1 text-xs rounded font-medium"
                  :class="{
                    'bg-purple-100 text-purple-800': u.role === 'admin',
                    'bg-gray-100 text-gray-700': u.role === 'user'
                  }"
                >
                  {{ u.role }}
                </span>

                <!-- Status badge -->
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

                <span class="text-xs text-ink-lighter hidden sm:inline">{{ formatDate(u.createdAt) }}</span>

                <!-- Role Toggle -->
                <button
                  v-if="u.id !== currentUserId"
                  @click="toggleRole(u)"
                  :disabled="actionInProgress === u.id"
                  class="px-2.5 py-1 text-xs rounded border transition-colors disabled:opacity-50"
                  :class="u.role === 'admin'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    : 'border-purple-300 text-purple-700 hover:bg-purple-50'"
                >
                  {{ u.role === 'admin' ? 'Demote' : 'Promote' }}
                </button>

                <!-- Status Toggle -->
                <button
                  v-if="u.id !== currentUserId"
                  @click="toggleStatus(u)"
                  :disabled="actionInProgress === u.id"
                  class="px-2.5 py-1 text-xs rounded border transition-colors disabled:opacity-50"
                  :class="u.status === 'active'
                    ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                    : 'border-green-300 text-green-700 hover:bg-green-50'"
                >
                  {{ u.status === 'active' ? 'Suspend' : 'Activate' }}
                </button>

                <!-- Delete User -->
                <button
                  v-if="u.id !== currentUserId"
                  @click="confirmDeleteUser(u)"
                  :disabled="actionInProgress === u.id"
                  class="px-2.5 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>

            <!-- Expanded Content Panel -->
            <div v-if="expandedUserId === u.id" class="border-t border-gray-100">
              <!-- Loading content -->
              <div v-if="contentLoading" class="text-center py-8">
                <p class="text-sm text-ink-lighter">Loading content...</p>
              </div>

              <div v-else-if="userContent" class="p-4 space-y-6">
                <!-- ── Writings ── -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-3">
                    Essays ({{ userContent.writings.length }})
                  </h3>
                  <div v-if="userContent.writings.length === 0" class="text-sm text-ink-lighter italic py-2">
                    No essays
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-gray-100">
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Title</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Visibility</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Created</th>
                          <th class="text-right px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="w in userContent.writings"
                          :key="w.id"
                          class="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          <td class="px-3 py-2">
                            <router-link
                              :to="`/read/${w.id}`"
                              class="text-ink hover:text-blue-600 font-medium"
                              target="_blank"
                            >
                              {{ w.title }}
                            </router-link>
                            <p class="text-xs text-ink-lighter mt-0.5 line-clamp-1">{{ w.bodyPreview }}</p>
                          </td>
                          <td class="px-3 py-2">
                            <select
                              :value="w.visibility"
                              @change="changeWritingVisibility(w, ($event.target as HTMLSelectElement).value)"
                              class="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="private">private</option>
                              <option value="shared">shared</option>
                              <option value="public">public</option>
                            </select>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs whitespace-nowrap">
                            {{ formatDate(w.createdAt) }}
                          </td>
                          <td class="px-3 py-2 text-right">
                            <button
                              @click="confirmDeleteWriting(w)"
                              :disabled="actionInProgress === w.id"
                              class="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- ── Comments ── -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-3">
                    Comments ({{ userContent.comments.length }})
                  </h3>
                  <div v-if="userContent.comments.length === 0" class="text-sm text-ink-lighter italic py-2">
                    No comments
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-gray-100">
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Comment</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">On Essay</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Date</th>
                          <th class="text-right px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="c in userContent.comments"
                          :key="c.id"
                          class="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          <td class="px-3 py-2 max-w-xs">
                            <p class="text-ink line-clamp-2">{{ c.content }}</p>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs">
                            <router-link
                              v-if="c.writingTitle"
                              :to="`/read/${c.writingId}`"
                              class="hover:text-blue-600"
                              target="_blank"
                            >
                              {{ c.writingTitle }}
                            </router-link>
                            <span v-else class="italic">deleted essay</span>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs whitespace-nowrap">
                            {{ formatDate(c.createdAt) }}
                          </td>
                          <td class="px-3 py-2 text-right">
                            <button
                              @click="confirmDeleteComment(c)"
                              :disabled="actionInProgress === c.id"
                              class="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- ── Appreciations ── -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-3">
                    Appreciations ({{ userContent.appreciations.length }})
                  </h3>
                  <div v-if="userContent.appreciations.length === 0" class="text-sm text-ink-lighter italic py-2">
                    No appreciations
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-gray-100">
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Reaction</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">On Essay</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Date</th>
                          <th class="text-right px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="a in userContent.appreciations"
                          :key="a.id"
                          class="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          <td class="px-3 py-2">
                            <span class="inline-flex items-center gap-1.5">
                              <span>{{ reactionEmoji(a.reactionType) }}</span>
                              <span class="text-ink-lighter text-xs">{{ a.reactionType }}</span>
                            </span>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs">
                            <router-link
                              v-if="a.writingTitle"
                              :to="`/read/${a.writingId}`"
                              class="hover:text-blue-600"
                              target="_blank"
                            >
                              {{ a.writingTitle }}
                            </router-link>
                            <span v-else class="italic">deleted essay</span>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs whitespace-nowrap">
                            {{ formatDate(a.createdAt) }}
                          </td>
                          <td class="px-3 py-2 text-right">
                            <button
                              @click="confirmDeleteAppreciation(a)"
                              :disabled="actionInProgress === a.id"
                              class="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
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
        <div v-if="deleteModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-semibold mb-2">{{ deleteModal.title }}</h3>
            <p class="text-ink-light mb-1">{{ deleteModal.message }}</p>
            <p v-if="deleteModal.detail" class="font-medium mb-1">{{ deleteModal.detail }}</p>
            <p v-if="deleteModal.subDetail" class="text-sm text-ink-lighter mb-4">{{ deleteModal.subDetail }}</p>
            <p class="text-sm text-red-600 mb-6">{{ deleteModal.warning }}</p>
            <div class="flex justify-end gap-3">
              <button
                @click="deleteModal = null"
                class="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                @click="executeDelete"
                :disabled="deleteModal.inProgress"
                class="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {{ deleteModal.inProgress ? 'Deleting...' : 'Delete' }}
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

// ─── Types ───

interface AdminWriting {
  id: string
  userId: string
  title: string
  bodyPreview: string
  visibility: 'private' | 'shared' | 'public'
  createdAt: string
  updatedAt: string
}

interface AdminComment {
  id: string
  writingId: string
  userId: string
  contentPreview: string
  content: string
  createdAt: string
  updatedAt: string
  writingTitle: string | null
}

interface AdminAppreciation {
  id: string
  writingId: string
  userId: string
  reactionType: string
  createdAt: string
  writingTitle: string | null
}

interface UserContent {
  writings: AdminWriting[]
  comments: AdminComment[]
  appreciations: AdminAppreciation[]
}

interface DeleteModalState {
  title: string
  message: string
  detail?: string
  subDetail?: string
  warning: string
  onConfirm: () => Promise<void>
  inProgress: boolean
}

interface UserListResponse {
  data: User[]
  meta: { total: number; limit: number; offset: number }
}

// ─── State ───

const { user: currentUser } = useAuth()
const currentUserId = computed(() => currentUser.value?.id)

const users = ref<User[]>([])
const totalUsers = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const actionInProgress = ref<string | null>(null)
const feedbackMessage = ref<string | null>(null)
const feedbackType = ref<'success' | 'error'>('success')

// Expanded user state
const expandedUserId = ref<string | null>(null)
const contentLoading = ref(false)
const userContent = ref<UserContent | null>(null)

// Delete modal
const deleteModal = ref<DeleteModalState | null>(null)

// ─── Computed ───

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const activeCount = computed(() => users.value.filter(u => u.status === 'active').length)
const suspendedCount = computed(() => users.value.filter(u => u.status === 'suspended').length)

// ─── Helpers ───

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const reactionEmoji = (type: string): string => {
  const map: Record<string, string> = {
    like: '\u{1F44D}',
    love: '\u{2764}\u{FE0F}',
    laugh: '\u{1F602}',
    wow: '\u{1F62E}',
    sad: '\u{1F622}',
    angry: '\u{1F621}'
  }
  return map[type] || '\u{1F44D}'
}

const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
  feedbackMessage.value = message
  feedbackType.value = type
  setTimeout(() => {
    feedbackMessage.value = null
  }, 3000)
}

// ─── Data loading ───

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

const loadUserContent = async (userId: string) => {
  try {
    contentLoading.value = true
    const response = await api.get<{ data: UserContent }>(`/admin/users/${userId}/content`)
    userContent.value = response.data
  } catch (err) {
    showFeedback(err instanceof Error ? err.message : 'Failed to load user content', 'error')
    userContent.value = null
  } finally {
    contentLoading.value = false
  }
}

const toggleExpand = (userId: string) => {
  if (expandedUserId.value === userId) {
    expandedUserId.value = null
    userContent.value = null
  } else {
    expandedUserId.value = userId
    userContent.value = null
    loadUserContent(userId)
  }
}

// ─── User actions ───

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

// ─── Writing actions ───

const changeWritingVisibility = async (w: AdminWriting, newVisibility: string) => {
  const oldVisibility = w.visibility
  try {
    actionInProgress.value = w.id
    await api.put(`/admin/writings/${w.id}/visibility`, { visibility: newVisibility })
    w.visibility = newVisibility as AdminWriting['visibility']
    showFeedback(`"${w.title}" visibility changed to ${newVisibility}`)
  } catch (err) {
    w.visibility = oldVisibility // revert on failure
    showFeedback(err instanceof Error ? err.message : 'Failed to update visibility', 'error')
  } finally {
    actionInProgress.value = null
  }
}

// ─── Delete confirmations ───

const confirmDeleteUser = (u: User) => {
  deleteModal.value = {
    title: 'Delete User',
    message: 'Are you sure you want to delete this user?',
    detail: u.displayName,
    subDetail: u.email,
    warning: 'This will permanently delete the user and all their associated data (writings, themes, comments, appreciations).',
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/users/${u.id}`)
        users.value = users.value.filter(x => x.id !== u.id)
        totalUsers.value--
        if (expandedUserId.value === u.id) {
          expandedUserId.value = null
          userContent.value = null
        }
        deleteModal.value = null
        showFeedback(`${u.displayName} has been deleted`)
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete user', 'error')
      }
    }
  }
}

const confirmDeleteWriting = (w: AdminWriting) => {
  deleteModal.value = {
    title: 'Delete Essay',
    message: 'Are you sure you want to delete this essay?',
    detail: w.title,
    warning: 'This will permanently delete the essay and all its comments and appreciations.',
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/writings/${w.id}`)
        if (userContent.value) {
          userContent.value.writings = userContent.value.writings.filter(x => x.id !== w.id)
          // Also remove comments/appreciations linked to this writing
          userContent.value.comments = userContent.value.comments.filter(c => c.writingId !== w.id)
          userContent.value.appreciations = userContent.value.appreciations.filter(a => a.writingId !== w.id)
        }
        deleteModal.value = null
        showFeedback(`"${w.title}" has been deleted`)
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete essay', 'error')
      }
    }
  }
}

const confirmDeleteComment = (c: AdminComment) => {
  deleteModal.value = {
    title: 'Delete Comment',
    message: 'Are you sure you want to delete this comment?',
    detail: c.content.substring(0, 100) + (c.content.length > 100 ? '...' : ''),
    subDetail: c.writingTitle ? `On: ${c.writingTitle}` : undefined,
    warning: 'This action cannot be undone.',
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/comments/${c.id}`)
        if (userContent.value) {
          userContent.value.comments = userContent.value.comments.filter(x => x.id !== c.id)
        }
        deleteModal.value = null
        showFeedback('Comment deleted')
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete comment', 'error')
      }
    }
  }
}

const confirmDeleteAppreciation = (a: AdminAppreciation) => {
  deleteModal.value = {
    title: 'Delete Appreciation',
    message: `Remove this ${a.reactionType} reaction?`,
    subDetail: a.writingTitle ? `On: ${a.writingTitle}` : undefined,
    warning: 'This action cannot be undone.',
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/appreciations/${a.id}`)
        if (userContent.value) {
          userContent.value.appreciations = userContent.value.appreciations.filter(x => x.id !== a.id)
        }
        deleteModal.value = null
        showFeedback('Appreciation deleted')
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete appreciation', 'error')
      }
    }
  }
}

const executeDelete = () => {
  if (deleteModal.value?.onConfirm) {
    deleteModal.value.onConfirm()
  }
}

// ─── Init ───

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
