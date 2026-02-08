<template>
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{{ isEditing ? 'Edit Writing' : 'Write' }}</h1>
    
    <form @submit.prevent="handleSubmit" class="space-y-4 sm:space-y-6">
      <div>
        <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="title"
          v-model="form.title"
          type="text"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base sm:text-sm"
          placeholder="Enter title..."
        />
      </div>
      
      <div>
        <label for="body" class="block text-sm font-medium text-gray-700 mb-1">
          Body (Markdown supported)
        </label>
        <textarea
          id="body"
          v-model="form.body"
          rows="12"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
          placeholder="Write your thoughts in Markdown..."
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Visibility
        </label>
        <select
          v-model="form.visibility"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base sm:text-sm"
        >
          <option value="private">Private (only you can see)</option>
          <option value="shared">Shared (others can see but not edit)</option>
          <option value="public">Public (everyone can see)</option>
        </select>
        <p class="mt-1 text-xs sm:text-sm text-gray-500">
          Choose who can see this writing block
        </p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Themes (optional)
        </label>
    <div v-if="loadingThemes || loadingWriting" class="text-xs sm:text-sm text-gray-500">
      {{ loadingWriting ? 'Loading writing...' : 'Loading themes...' }}
    </div>
        <div v-else class="space-y-2">
          <div
            v-for="theme in availableThemes"
            :key="theme.id"
            class="flex items-center"
          >
            <input
              :id="`theme-${theme.id}`"
              v-model="form.themeIds"
              type="checkbox"
              :value="theme.id"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              :for="`theme-${theme.id}`"
              class="ml-2 text-sm text-gray-700"
            >
              {{ theme.name }}
            </label>
          </div>
          <p v-if="availableThemes.length === 0" class="text-xs sm:text-sm text-gray-500">
            No themes available. Create themes on the Themes page.
          </p>
        </div>
      </div>
      
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4">
        <p class="text-red-800 text-xs sm:text-sm">{{ error }}</p>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-3 sm:space-x-4">
        <button
          type="submit"
          :disabled="submitting || loadingWriting"
          class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          {{ submitting ? (isEditing ? 'Updating...' : 'Publishing...') : (isEditing ? 'Update' : 'Publish') }}
        </button>
        <router-link
          to="/"
          class="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-center text-sm sm:text-base"
        >
          Cancel
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api/client'
import type { Theme } from '../domain/Theme'
import type { WritingBlock } from '../domain/WritingBlock'
import type { ApiResponse } from '@shared/ApiResponses'

const router = useRouter()
const route = useRoute()

const writingId = computed(() => route.params.id as string | undefined)
const isEditing = computed(() => !!writingId.value)

const form = ref({
  title: '',
  body: '',
  themeIds: [] as string[],
  visibility: 'private' as 'private' | 'shared' | 'public'
})

const availableThemes = ref<Theme[]>([])
const loadingThemes = ref(true)
const loadingWriting = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)

const loadThemes = async () => {
  try {
    loadingThemes.value = true
    const response = await api.get<ApiResponse<Theme[]>>('/themes')
    availableThemes.value = response.data
  } catch (err) {
    console.error('Failed to load themes:', err)
  } finally {
    loadingThemes.value = false
  }
}

const loadWriting = async () => {
  if (!writingId.value) return

  try {
    loadingWriting.value = true
    error.value = null
    const response = await api.get<ApiResponse<WritingBlock>>(`/writing/${writingId.value}`)
    const writing = response.data
    
    form.value = {
      title: writing.title,
      body: writing.body,
      themeIds: writing.themeIds || [],
      visibility: writing.visibility || 'private'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load writing'
  } finally {
    loadingWriting.value = false
  }
}

const handleSubmit = async () => {
  if (!form.value.title.trim() || !form.value.body.trim()) {
    error.value = 'Title and body are required'
    return
  }

  try {
    submitting.value = true
    error.value = null
    
    if (isEditing.value && writingId.value) {
      // Update existing writing
      await api.put<ApiResponse<any>>(`/writing/${writingId.value}`, {
        title: form.value.title,
        body: form.value.body,
        themeIds: form.value.themeIds,
        visibility: form.value.visibility
      })
    } else {
      // Create new writing
      await api.post<ApiResponse<any>>('/writing', {
        title: form.value.title,
        body: form.value.body,
        themeIds: form.value.themeIds,
        visibility: form.value.visibility
      })
    }
    
    router.push('/home')
  } catch (err) {
    error.value = err instanceof Error ? err.message : (isEditing.value ? 'Failed to update writing' : 'Failed to publish writing')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadThemes()
  if (isEditing.value) {
    await loadWriting()
  }
})
</script>
