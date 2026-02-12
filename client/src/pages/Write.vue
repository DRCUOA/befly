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
          ref="bodyTextareaRef"
          v-model="form.body"
          rows="12"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
          placeholder="Write your thoughts in Markdown..."
          @blur="onBodyBlur"
        />
        <p v-if="blurSuggestionCount > 0 && !showTypographyModal" class="mt-1 text-xs text-amber-600">
          {{ blurSuggestionCount }} typography suggestion{{ blurSuggestionCount === 1 ? '' : 's' }} — review before publishing
        </p>
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
    <div
      v-if="showDraftIndicator"
      class="mt-4 px-3 py-2 rounded-md text-xs sm:text-sm"
      :class="hasUnsavedChanges ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'"
    >
      Draft saved at {{ draftSavedAt ?? '—' }}
    </div>

    <!-- Typography Suggestions Modal (before save) -->
    <div v-if="showTypographyModal && typographySuggestions.length > 0" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <h3 class="text-lg font-semibold mb-2">Typography Suggestions</h3>
        <p class="text-gray-600 text-sm mb-4">
          Review these typography suggestions before publishing. Accept or dismiss each one.
        </p>
        <div class="overflow-y-auto flex-1 space-y-3 mb-4">
          <div
            v-for="(suggestion, idx) in typographySuggestions"
            :key="`${suggestion.start}-${suggestion.original}`"
            class="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-md text-sm"
          >
            <div class="flex-1 min-w-0">
              <span class="text-gray-500">{{ suggestion.description }}:</span>
              <span class="ml-1 font-mono text-gray-800">"{{ suggestion.original }}"</span>
              <span class="mx-1 text-gray-400">→</span>
              <span class="font-mono text-green-700">"{{ suggestion.replacement }}"</span>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                type="button"
                @click="acceptTypographySuggestion(idx)"
                class="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                Accept
              </button>
              <button
                type="button"
                @click="dismissTypographySuggestion(idx)"
                class="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-2 border-t">
          <button
            type="button"
            @click="dismissAllTypographySuggestions"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
          >
            Dismiss all
          </button>
          <button
            type="button"
            @click="acceptAllTypographySuggestions"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Accept all
          </button>
          <button
            type="button"
            @click="closeTypographyModalAndSubmit"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
          >
            Continue without changes
          </button>
        </div>
      </div>
    </div>

    <!-- Draft Recovery Modal -->
    <div v-if="showRecoveryModal && recoveryDraft" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-2">Recover Unsaved Work?</h3>
        <p class="text-gray-700 mb-4">
          You have an unsaved draft from {{ formatTime(recoveryDraft.timestamp) }}. Would you like to recover it?
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
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { api } from '../api/client'
import type { Theme } from '../domain/Theme'
import type { WritingBlock } from '../domain/WritingBlock'
import type { ApiResponse } from '@shared/ApiResponses'
import { useWriteDraft } from '../composables/useWriteDraft'
import { formatTime, formatTimeWithSeconds } from '../utils/time'
import {
  scanTypography,
  applySuggestion,
  applySuggestions,
  type TypographySuggestion
} from '../utils/typography-suggestions'
import { useTypographyRules } from '../composables/useTypographyRules'

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

const initialFormState = ref({
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

// Typography suggestions (Option A: suggest only, on blur/save)
// Rules from API with fallback to bundled defaults (cni-07)
const { rules: typographyRules } = useTypographyRules()
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null)
const showTypographyModal = ref(false)
const typographySuggestions = ref<TypographySuggestion[]>([])
const pendingSubmit = ref(false)
const blurSuggestionCount = ref(0)

function onBodyBlur() {
  blurSuggestionCount.value = scanTypography(form.value.body, typographyRules.value).length
}

// Draft management
const draft = useWriteDraft(writingId.value, form)
const showRecoveryModal = ref(false)
const recoveryDraft = ref<{ title: string; body: string; themeIds: string[]; visibility: 'private' | 'shared' | 'public'; timestamp: number } | null>(null)
// Track if form has unsaved changes
const hasUnsavedChanges = computed(() => {
  // Check simple fields first (most common changes)
  if (form.value.title !== initialFormState.value.title ||
      form.value.body !== initialFormState.value.body ||
      form.value.visibility !== initialFormState.value.visibility) {
    return true
  }
  
  // Check themeIds array efficiently
  const currentThemes = form.value.themeIds
  const initialThemes = initialFormState.value.themeIds
  
  if (currentThemes.length !== initialThemes.length) {
    return true
  }
  
  // Sort and compare element-by-element
  const sortedCurrent = [...currentThemes].sort()
  const sortedInitial = [...initialThemes].sort()
  
  return sortedCurrent.some((id, index) => id !== sortedInitial[index])
})

// Reactive draft status for template (ensures updates when lastSaved changes)
const draftSavedAt = computed(() => {
  const saved = draft.lastSaved.value
  return saved ? formatTimeWithSeconds(saved) : null
})

const showDraftIndicator = computed(() => {
  if (isEditing.value) return false
  return !!(form.value.title.trim() || form.value.body.trim() || draft.lastSaved.value)
})

// Sync initialFormState when draft is saved to localStorage so color turns green
watch(() => draft.lastSaved.value, (saved) => {
  if (saved && !isEditing.value) {
    initialFormState.value = {
      title: form.value.title,
      body: form.value.body,
      themeIds: [...form.value.themeIds],
      visibility: form.value.visibility
    }
  }
})

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

const setFormState = (writing: Partial<WritingBlock>) => {
  const formState = {
    title: writing.title || '',
    body: writing.body || '',
    themeIds: writing.themeIds || [],
    visibility: (writing.visibility || 'private') as 'private' | 'shared' | 'public'
  }
  
  form.value = { ...formState }
  initialFormState.value = { ...formState, themeIds: [...formState.themeIds] }
}

const loadWriting = async () => {
  if (!writingId.value) return

  try {
    loadingWriting.value = true
    error.value = null
    const response = await api.get<ApiResponse<WritingBlock>>(`/writing/${writingId.value}`)
    setFormState(response.data)
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
    const data = recoveryDraft.value
    form.value = {
      title: data.title,
      body: data.body,
      themeIds: data.themeIds,
      visibility: data.visibility
    }
    initialFormState.value = {
      title: data.title,
      body: data.body,
      themeIds: [...data.themeIds],
      visibility: data.visibility
    }
    showRecoveryModal.value = false
    recoveryDraft.value = null
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

/** Perform the actual API call. Called after typography modal or when no suggestions. */
const doSubmit = async () => {
  if (!form.value.title.trim() || !form.value.body.trim()) {
    error.value = 'Title and body are required'
    return
  }

  try {
    submitting.value = true
    error.value = null

    if (isEditing.value && writingId.value) {
      await api.put<ApiResponse<any>>(`/writing/${writingId.value}`, {
        title: form.value.title,
        body: form.value.body,
        themeIds: form.value.themeIds,
        visibility: form.value.visibility
      })
    } else {
      await api.post<ApiResponse<any>>('/writing', {
        title: form.value.title,
        body: form.value.body,
        themeIds: form.value.themeIds,
        visibility: form.value.visibility
      })
    }

    draft.clearDraft()
    setFormState(form.value)
    router.push('/home')
  } catch (err) {
    error.value = err instanceof Error ? err.message : (isEditing.value ? 'Failed to update writing' : 'Failed to publish writing')
  } finally {
    submitting.value = false
  }
}

const handleSubmit = async () => {
  if (!form.value.title.trim() || !form.value.body.trim()) {
    error.value = 'Title and body are required'
    return
  }

  const suggestions = scanTypography(form.value.body, typographyRules.value)
  if (suggestions.length > 0) {
    typographySuggestions.value = suggestions
    showTypographyModal.value = true
    pendingSubmit.value = true
    return
  }

  await doSubmit()
}

function applySuggestionViaTextarea(suggestion: TypographySuggestion) {
  const textarea = bodyTextareaRef.value
  if (textarea) {
    textarea.focus()
    textarea.setSelectionRange(suggestion.start, suggestion.end)
    textarea.setRangeText(suggestion.replacement, suggestion.start, suggestion.end, 'select')
    form.value.body = textarea.value
  } else {
    form.value.body = applySuggestion(form.value.body, suggestion)
  }
}

function acceptTypographySuggestion(idx: number) {
  const suggestion = typographySuggestions.value[idx]
  if (!suggestion) return
  applySuggestionViaTextarea(suggestion)
  const next = scanTypography(form.value.body, typographyRules.value)
  typographySuggestions.value = next
  if (next.length === 0) {
    showTypographyModal.value = false
    if (pendingSubmit.value) {
      pendingSubmit.value = false
      doSubmit()
    }
  }
}

function dismissTypographySuggestion(idx: number) {
  typographySuggestions.value = typographySuggestions.value.filter((_, i) => i !== idx)
  if (typographySuggestions.value.length === 0) {
    showTypographyModal.value = false
    if (pendingSubmit.value) {
      pendingSubmit.value = false
      doSubmit()
    }
  }
}

function acceptAllTypographySuggestions() {
  const suggestions = typographySuggestions.value
  if (suggestions.length === 0) return
  form.value.body = applySuggestions(form.value.body, suggestions)
  typographySuggestions.value = []
  showTypographyModal.value = false
  pendingSubmit.value = false
  doSubmit()
}

function dismissAllTypographySuggestions() {
  typographySuggestions.value = []
  showTypographyModal.value = false
  if (pendingSubmit.value) {
    pendingSubmit.value = false
    doSubmit()
  }
}

function closeTypographyModalAndSubmit() {
  typographySuggestions.value = []
  showTypographyModal.value = false
  pendingSubmit.value = false
  doSubmit()
}

// Persist draft to localStorage before leaving (no confirmation dialog)
const handleBeforeUnload = () => {
  if (hasUnsavedChanges.value) {
    draft.saveDraft()
  }
}

// Vue Router guard: persist draft to localStorage before in-app navigation
onBeforeRouteLeave((_to, _from, next) => {
  if (hasUnsavedChanges.value) {
    draft.saveDraft()
  }
  next()
})

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
  
  // Add beforeunload event listener
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  draft.disableAutosave()
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

</script>
