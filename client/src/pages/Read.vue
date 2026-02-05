<template>
  <div>
    <div v-if="loading" class="text-center py-8">
      <p class="text-gray-500">Loading...</p>
    </div>
    
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
      <p class="text-red-800">{{ error }}</p>
      <router-link
        to="/"
        class="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        ← Back to Home
      </router-link>
    </div>
    
    <div v-else-if="writing">
      <div class="mb-6">
        <router-link
          to="/"
          class="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Home
        </router-link>
        <h1 class="text-3xl font-bold mb-4">{{ writing.title }}</h1>
        <div class="flex items-center justify-between mb-6">
          <div class="flex flex-wrap gap-2">
            <ThemeTag
              v-for="theme in themes"
              :key="theme.id"
              :name="theme.name"
            />
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-500">{{ formattedDate }}</span>
            <AppreciationButton
              :writing-id="writing.id"
              :initial-count="appreciationCount"
              :is-appreciated="isAppreciated"
              @appreciated="loadAppreciations"
              @unappreciated="loadAppreciations"
            />
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-8">
        <MarkdownRenderer :markdown="writing.body" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import type { Appreciation } from '../domain/Appreciation'
import MarkdownRenderer from '../components/writing/MarkdownRenderer.vue'
import ThemeTag from '../components/writing/ThemeTag.vue'
import AppreciationButton from '../components/writing/AppreciationButton.vue'
import type { ApiResponse } from '@shared/ApiResponses'

const route = useRoute()
const { user } = useAuth()
const writing = ref<WritingBlock | null>(null)
const themes = ref<Theme[]>([])
const appreciations = ref<Appreciation[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const formattedDate = computed(() => {
  if (!writing.value) return ''
  const date = new Date(writing.value.createdAt)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const appreciationCount = computed(() => appreciations.value.length)

const isAppreciated = computed(() => {
  if (!user.value) return false
  return appreciations.value.some(a => a.userId === user.value!.id)
})

const loadAppreciations = async () => {
  if (!writing.value) return
  try {
    const response = await api.get<ApiResponse<Appreciation[]>>(`/appreciations/writing/${writing.value.id}`)
    appreciations.value = response.data
  } catch (err) {
    console.error('Failed to refresh appreciations:', err)
  }
}

const loadWriting = async () => {
  const id = route.params.id as string
  if (!id) {
    error.value = 'No writing ID provided'
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = null
    
    const [writingResponse, themesResponse, appreciationsResponse] = await Promise.all([
      api.get<ApiResponse<WritingBlock>>(`/writing/${id}`),
      api.get<ApiResponse<Theme[]>>('/themes'),
      api.get<ApiResponse<Appreciation[]>>(`/appreciations/writing/${id}`)
    ])
    
    writing.value = writingResponse.data
    themes.value = themesResponse.data.filter(t => writing.value!.themeIds.includes(t.id))
    appreciations.value = appreciationsResponse.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load writing'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadWriting()
})
</script>
