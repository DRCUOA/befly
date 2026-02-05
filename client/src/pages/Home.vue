<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Recent Writing</h1>
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
          My Writing
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
      <p class="text-gray-500">Loading...</p>
    </div>
    
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
      <p class="text-red-800">{{ error }}</p>
    </div>
    
    <div v-else-if="filteredWritings.length === 0" class="text-center py-8">
      <p class="text-gray-500 mb-4">
        <span v-if="filter === 'mine'">You haven't written anything yet.</span>
        <span v-else-if="filter === 'shared'">No shared writing available.</span>
        <span v-else>No writing yet. Start writing!</span>
      </p>
      <router-link
        v-if="isAuthenticated"
        to="/write"
        class="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Write Your First Piece
      </router-link>
      <router-link
        v-else
        to="/signup"
        class="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Sign Up to Start Writing
      </router-link>
    </div>
    
    <div v-else class="space-y-4">
      <WritingCard
        v-for="writing in filteredWritings"
        :key="writing.id"
        :writing="writing"
        :themes="getThemesForWriting(writing)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import WritingCard from '../components/writing/WritingCard.vue'
import type { ApiResponse } from '@shared/ApiResponses'

const { user, isAuthenticated } = useAuth()

const writings = ref<WritingBlock[]>([])
const themes = ref<Theme[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref<'all' | 'mine' | 'shared'>('all')

const loadWritings = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await api.get<ApiResponse<WritingBlock[]>>('/writing')
    writings.value = response.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load writings'
  } finally {
    loading.value = false
  }
}

const loadThemes = async () => {
  try {
    const response = await api.get<ApiResponse<Theme[]>>('/themes')
    themes.value = response.data
  } catch (err) {
    console.error('Failed to load themes:', err)
  }
}

const getThemesForWriting = (writing: WritingBlock): Theme[] => {
  return themes.value.filter(theme => writing.themeIds.includes(theme.id))
}

const filteredWritings = computed(() => {
  if (filter.value === 'all') {
    return writings.value
  }
  if (filter.value === 'mine' && user.value) {
    return writings.value.filter(w => w.userId === user.value!.id)
  }
  if (filter.value === 'shared') {
    return writings.value.filter(w => w.visibility === 'shared' || w.visibility === 'public')
  }
  return writings.value
})

// Reload when filter changes
watch(filter, () => {
  loadWritings()
})

onMounted(() => {
  loadWritings()
  loadThemes()
})
</script>
