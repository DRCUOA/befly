<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Themes</h1>
      <div v-if="isAuthenticated" class="flex space-x-2">
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
          <div>
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
          <ThemeTag :name="theme.name" />
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

// Reload when filter changes
watch(filter, () => {
  loadThemes()
})

onMounted(() => {
  loadThemes()
})
</script>
