<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Themes</h1>
      <div v-if="isAuthenticated" class="flex items-center space-x-2">
        <router-link
          to="/themes/create"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          Create Theme
        </router-link>
        <div class="flex space-x-2">
          <button
            @click="filter = 'all'"
            :class="filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'"
            class="px-3 py-1 rounded-md text-sm font-medium"
          >
            All
          </button>
          <button
            @click="filter = 'mine'"
            :class="filter === 'mine' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'"
            class="px-3 py-1 rounded-md text-sm font-medium"
          >
            My Themes
          </button>
          <button
            @click="filter = 'shared'"
            :class="filter === 'shared' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'"
            class="px-3 py-1 rounded-md text-sm font-medium"
          >
            Shared
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="text-center py-8">
      <p class="text-gray-500">Loading themes...</p>
    </div>
    
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
      <p class="text-red-800">{{ error }}</p>
    </div>
    
    <div v-else-if="filteredThemes.length === 0" class="text-center py-8">
      <p class="text-gray-500 mb-4">
        <span v-if="filter === 'mine'">You haven't created any themes yet.</span>
        <span v-else-if="filter === 'shared'">No shared themes available.</span>
        <span v-else>No themes yet</span>
      </p>
    </div>
    
    <div v-else class="space-y-3">
      <div
        v-for="theme in filteredThemes"
        :key="theme.id"
        class="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <h2 class="text-lg font-semibold text-gray-900">{{ theme.name }}</h2>
            <p class="text-sm text-gray-500">Slug: {{ theme.slug }}</p>
            <span
              v-if="theme.visibility !== 'private'"
              class="inline-block mt-1 px-2 py-1 text-xs rounded"
              :class="{
                'bg-green-100 text-green-800': theme.visibility === 'public',
                'bg-blue-100 text-blue-800': theme.visibility === 'shared'
              }"
            >
              {{ theme.visibility === 'public' ? 'Public' : 'Shared' }}
            </span>
          </div>
          <div class="flex items-center space-x-2">
            <ThemeTag :name="theme.name" />
            <div v-if="isOwner(theme)" class="flex items-center space-x-1 ml-2">
              <router-link
                :to="`/themes/edit/${theme.id}`"
                class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </router-link>
              <button
                @click="handleDelete(theme)"
                :disabled="deleting === theme.id"
                class="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Delete"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { Theme } from '../domain/Theme'
import ThemeTag from '../components/writing/ThemeTag.vue'
import type { ApiResponse } from '@shared/ApiResponses'

const { user, isAuthenticated } = useAuth()

const themes = ref<Theme[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref<'all' | 'mine' | 'shared'>('all')
const deleting = ref<string | null>(null)

const isOwner = (theme: Theme): boolean => {
  return user.value !== null && theme.userId === user.value.id
}

const loadThemes = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await api.get<ApiResponse<Theme[]>>('/themes')
    themes.value = response.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load themes'
  } finally {
    loading.value = false
  }
}

const filteredThemes = computed(() => {
  if (filter.value === 'all') {
    return themes.value
  }
  if (filter.value === 'mine' && user.value) {
    return themes.value.filter(t => t.userId === user.value!.id)
  }
  if (filter.value === 'shared') {
    return themes.value.filter(t => t.visibility === 'shared' || t.visibility === 'public')
  }
  return themes.value
})

const handleDelete = async (theme: Theme) => {
  if (!confirm(`Are you sure you want to delete the theme "${theme.name}"? This action cannot be undone.`)) {
    return
  }

  try {
    deleting.value = theme.id
    await api.delete(`/themes/${theme.id}`)
    await loadThemes()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete theme')
  } finally {
    deleting.value = null
  }
}

// Reload when filter changes
watch(filter, () => {
  loadThemes()
})

onMounted(() => {
  loadThemes()
})
</script>
