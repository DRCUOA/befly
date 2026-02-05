<template>
  <div>
    <h1 class="text-3xl font-bold mb-6">Write</h1>
    
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="title"
          v-model="form.title"
          type="text"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
          rows="15"
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
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="private">Private (only you can see)</option>
          <option value="shared">Shared (others can see but not edit)</option>
          <option value="public">Public (everyone can see)</option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          Choose who can see this writing block
        </p>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Themes (optional)
        </label>
        <div v-if="loadingThemes" class="text-sm text-gray-500">
          Loading themes...
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
          <p v-if="availableThemes.length === 0" class="text-sm text-gray-500">
            No themes available. Create themes on the Themes page.
          </p>
        </div>
      </div>
      
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-4">
        <p class="text-red-800 text-sm">{{ error }}</p>
      </div>
      
      <div class="flex space-x-4">
        <button
          type="submit"
          :disabled="submitting"
          class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ submitting ? 'Publishing...' : 'Publish' }}
        </button>
        <router-link
          to="/"
          class="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client'
import type { Theme } from '../domain/Theme'
import type { ApiResponse } from '@shared/ApiResponses'

const router = useRouter()

const form = ref({
  title: '',
  body: '',
  themeIds: [] as string[],
  visibility: 'private' as 'private' | 'shared' | 'public'
})

const availableThemes = ref<Theme[]>([])
const loadingThemes = ref(true)
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

const handleSubmit = async () => {
  if (!form.value.title.trim() || !form.value.body.trim()) {
    error.value = 'Title and body are required'
    return
  }

  try {
    submitting.value = true
    error.value = null
    
    await api.post<ApiResponse<any>>('/writing', {
      title: form.value.title,
      body: form.value.body,
      themeIds: form.value.themeIds,
      visibility: form.value.visibility
    })
    
    router.push('/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to publish writing'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadThemes()
})
</script>
