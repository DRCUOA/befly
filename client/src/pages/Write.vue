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

    <!-- Draft Saved Indicator -->
    <div v-if="!isEditing && draft.lastSaved.value" class="mt-4 text-xs sm:text-sm text-gray-500">
      Draft saved at {{ draft.getFormattedSaveTime() }}
    </div>

    <!-- Draft Recovery Modal -->
    <div v-if="showRecoveryModal && recoveryDraft" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-2">Recover Unsaved Work?</h3>
        <p class="text-gray-700 mb-4">
          You have an unsaved draft from {{ formatDraftTime(recoveryDraft.timestamp) }}. Would you like to recover it?
        </p>
        <div class="mb-4 p-3 bg-gray-50 rounded-md text-sm">
          <div class="font-medium text-gray-700 mb-1">Draft Preview:</div>
          <div class="text-gray-600">
            <strong>Title:</strong> {{ recoveryDraft.title || '(empty)' }}
          </div>
          <div class="text-gray-600 mt-1">
            <strong>Body:</strong> {{ recoveryDraft.body.substring(0, 100) }}{{ recoveryDraft.body.length > 100 ? '...' : '' }}
          </div>
        </div>
        <div class="flex justify-end gap-3">
          <button
            @click="dismissRecoveryModal"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
          >
            Dismiss
          </button>
          <button
            @click="discardDraft"
            class="px-4 py-2 border border-red-300 rounded-md text-red-700 hover:bg-red-50 text-sm"
          >
            Discard
          </button>
          <button
            @click="restoreDraft"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { api } from '../api/client'
import type { Theme } from '../domain/Theme'
import type { WritingBlock } from '../domain/WritingBlock'
import type { ApiResponse } from '@shared/ApiResponses'
import { useWriteDraft } from '../composables/useWriteDraft'

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

// Draft management
const draft = useWriteDraft(writingId.value, form.value)
const showRecoveryModal = ref(false)
const recoveryDraft = ref<{ title: string; body: string; themeIds: string[]; visibility: 'private' | 'shared' | 'public'; timestamp: number } | null>(null)

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

const checkForDraft = () => {
  // Only check for draft if we're creating a new writing (not editing)
  if (isEditing.value) {
    return
  }

  // Only check if form is currently empty
  if (form.value.title.trim() || form.value.body.trim()) {
    return
  }

  const savedDraft = draft.loadDraft()
  if (savedDraft) {
    recoveryDraft.value = savedDraft
    showRecoveryModal.value = true
  }
}

const restoreDraft = () => {
  if (recoveryDraft.value) {
    form.value = {
      title: recoveryDraft.value.title,
      body: recoveryDraft.value.body,
      themeIds: recoveryDraft.value.themeIds,
      visibility: recoveryDraft.value.visibility
    }
    showRecoveryModal.value = false
    recoveryDraft.value = null
    // Enable autosave after restoring
    draft.enableAutosave()
  }
}

const discardDraft = () => {
  draft.clearDraft()
  showRecoveryModal.value = false
  recoveryDraft.value = null
  // Enable autosave for new content
  draft.enableAutosave()
}

const dismissRecoveryModal = () => {
  showRecoveryModal.value = false
  recoveryDraft.value = null
  // Enable autosave for new content
  draft.enableAutosave()
}

const formatDraftTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
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
    
    // Clear draft on successful submission
    draft.clearDraft()
    
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
    // Don't enable autosave when editing existing writing
  } else {
    // Check for draft when creating new writing
    checkForDraft()
    // Enable autosave if no recovery modal is shown
    if (!showRecoveryModal.value) {
      draft.enableAutosave()
    }
  }

  // Add beforeunload listener to warn user about unsaved changes
  window.addEventListener('beforeunload', handleBeforeUnload)
})

// Cleanup on unmount
onBeforeUnmount(() => {
  draft.disableAutosave()
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

// Warn user before leaving page with unsaved changes
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  // Only warn if we're creating new content (not editing) and there's unsaved content
  if (!isEditing.value && (form.value.title.trim() || form.value.body.trim())) {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }
}

// Router navigation guard to warn about unsaved changes
onBeforeRouteLeave((_to, _from, next) => {
  // Only warn if we're creating new content (not editing) and there's unsaved content
  if (!isEditing.value && (form.value.title.trim() || form.value.body.trim())) {
    const answer = window.confirm('You have unsaved changes. Do you really want to leave?')
    if (answer) {
      next()
    } else {
      next(false)
    }
  } else {
    next()
  }
})

</script>
