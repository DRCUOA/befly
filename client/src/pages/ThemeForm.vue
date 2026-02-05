<template>
  <div>
    <h1 class="text-3xl font-bold mb-6">{{ isEditing ? 'Edit Theme' : 'Create Theme' }}</h1>
    
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
          Theme Name
        </label>
        <input
          id="name"
          v-model="form.name"
          type="text"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter theme name..."
        />
        <p class="mt-1 text-sm text-gray-500">
          The slug will be automatically generated from the name
        </p>
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
          Choose who can see this theme
        </p>
      </div>
      
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-4">
        <p class="text-red-800 text-sm">{{ error }}</p>
      </div>
      
      <div class="flex space-x-4">
        <button
          type="submit"
          :disabled="submitting || loadingTheme"
          class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ submitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update' : 'Create') }}
        </button>
        <router-link
          to="/themes"
          class="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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
import type { ApiResponse } from '@shared/ApiResponses'

const router = useRouter()
const route = useRoute()

const themeId = computed(() => route.params.id as string | undefined)
const isEditing = computed(() => !!themeId.value)

const form = ref({
  name: '',
  visibility: 'private' as 'private' | 'shared' | 'public'
})

const loadingTheme = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)

const loadTheme = async () => {
  if (!themeId.value) return

  try {
    loadingTheme.value = true
    error.value = null
    const response = await api.get<ApiResponse<Theme>>(`/themes/${themeId.value}`)
    const theme = response.data
    
    form.value = {
      name: theme.name,
      visibility: theme.visibility || 'private'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load theme'
  } finally {
    loadingTheme.value = false
  }
}

const handleSubmit = async () => {
  if (!form.value.name.trim()) {
    error.value = 'Theme name is required'
    return
  }

  try {
    submitting.value = true
    error.value = null
    
    if (isEditing.value && themeId.value) {
      // Update existing theme
      await api.put<ApiResponse<any>>(`/themes/${themeId.value}`, {
        name: form.value.name,
        visibility: form.value.visibility
      })
    } else {
      // Create new theme
      await api.post<ApiResponse<any>>('/themes', {
        name: form.value.name,
        visibility: form.value.visibility
      })
    }
    
    router.push('/themes')
  } catch (err) {
    error.value = err instanceof Error ? err.message : (isEditing.value ? 'Failed to update theme' : 'Failed to create theme')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (isEditing.value) {
    await loadTheme()
  }
})
</script>
