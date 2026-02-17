<template>
  <div class="w-full min-h-[calc(100vh-4rem)]">
    <!-- Editor: full viewport width, breathing space (P2-uix-05 / cni-05) -->
    <form @submit.prevent="handleSubmit" class="flex flex-col w-full">
      <!-- Content area: max-width for comfortable line length (65–75ch), generous margins (cni-05). -->
      <div class="w-full max-w-[70ch] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-8 md:py-12 lg:py-16">
        <input
          id="title"
          v-model="form.title"
          type="text"
          required
          class="block w-full border-0 bg-transparent text-xl sm:text-2xl font-light tracking-tight placeholder:text-ink-whisper focus:ring-0 focus:outline-none py-1"
          placeholder="Title"
          aria-label="Title"
        />
      </div>

      <!-- Non-blocking inline typography suggestions (P1-uix-03: progressive reveal)
           Positioned between title and body so writers see them without scrolling past text. -->
      <div v-if="typographySuggestions.length > 0" class="w-full max-w-[70ch] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-6" role="region" aria-label="Typography suggestions">
        <div class="border border-line bg-accent-muted rounded-md overflow-hidden">
          <!-- Summary bar — visually interactive: hover shifts to line, chevron signals expand -->
          <button
            type="button"
            class="w-full flex items-center justify-between min-h-[44px] px-4 py-4 text-sm text-accent-hover hover:bg-line transition-colors"
            @click="suggestionsPanelExpanded = !suggestionsPanelExpanded"
            :aria-expanded="suggestionsPanelExpanded"
            aria-controls="typography-suggestions-panel"
          >
            <span class="flex items-center gap-2">
              <svg class="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ typographySuggestions.length }} typography suggestion{{ typographySuggestions.length === 1 ? '' : 's' }}
            </span>
            <span class="flex items-center gap-3">
              <span
                role="button"
                tabindex="0"
                class="text-xs font-medium text-accent-hover hover:text-ink underline underline-offset-2"
                @click.stop="acceptAllTypographySuggestions"
                @keydown.enter.stop="acceptAllTypographySuggestions"
              >Accept all</span>
              <span
                role="button"
                tabindex="0"
                class="text-xs text-ink-lighter hover:text-ink-light underline underline-offset-2"
                @click.stop="dismissAllTypographySuggestions"
                @keydown.enter.stop="dismissAllTypographySuggestions"
              >Dismiss</span>
              <svg
                class="w-4 h-4 text-ink-lighter transition-transform duration-200"
                :class="{ 'rotate-180': suggestionsPanelExpanded }"
                fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
          <!-- Expanded suggestion list — generous height so users can review all detail -->
          <div
            v-if="suggestionsPanelExpanded"
            id="typography-suggestions-panel"
            class="border-t border-line px-4 pb-4 pt-2 space-y-2 max-h-[50vh] overflow-y-auto"
          >
            <div
              v-for="(suggestion, idx) in typographySuggestions"
              :key="`${suggestion.start}-${suggestion.ruleId}`"
              class="flex items-center justify-between gap-4 px-4 py-2 bg-white/70 rounded text-sm"
            >
              <div class="flex-1 min-w-0 truncate">
                <span class="text-ink-lighter">{{ suggestion.description }}:</span>
                <span class="ml-1 font-mono text-ink">"{{ suggestion.original }}"</span>
                <span class="mx-1 text-ink-whisper">→</span>
                <span class="font-mono font-medium text-accent-hover">"{{ suggestion.replacement }}"</span>
              </div>
              <div class="flex gap-2 shrink-0">
                <button
                  type="button"
                  @click="acceptTypographySuggestion(idx)"
                  class="min-h-[44px] px-4 py-2 text-xs bg-accent text-paper rounded hover:bg-accent-hover transition-colors"
                >Accept</button>
                <button
                  type="button"
                  @click="dismissTypographySuggestion(idx)"
                  class="min-h-[44px] px-4 py-2 text-xs border border-line rounded text-ink-lighter hover:bg-line transition-colors"
                >Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Body: line-height ≥1.6 for comfortable reading (cni-05), generous padding -->
      <div class="flex-1 w-full max-w-[70ch] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-8 sm:pb-12">
        <textarea
          id="body"
          ref="bodyTextareaRef"
          v-model="form.body"
          required
          class="block w-full min-h-[calc(100vh-14rem)] border-0 bg-transparent font-mono text-sm sm:text-base text-ink placeholder:text-ink-whisper focus:ring-0 focus:outline-none resize-none py-2 leading-[1.6]"
          placeholder="Write your thoughts in Markdown..."
          aria-label="Body"
          @blur="onBodyBlur"
        />
      </div>

      <!-- Footer: metadata trigger, publish, cancel (≤5 visible controls per epic DoD)
           Increased inter-element spacing, min 44px tap targets (cni-05) -->
      <div class="w-full border-t border-line bg-paper px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-8 md:py-12 sticky bottom-0 z-10">
      <div v-if="error" class="mb-6 bg-accent-muted border border-line rounded-md p-4 sm:p-6">
        <p class="text-ink text-xs sm:text-sm">{{ error }}</p>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 items-stretch sm:items-center">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-4 border border-line rounded-md text-ink-lighter hover:text-ink hover:bg-line text-sm font-sans"
          aria-label="Open metadata settings (cover, themes, visibility)"
          :aria-expanded="metadataPanelOpen"
          @click="metadataPanelOpen = true"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Metadata
        </button>
        <button
          type="submit"
          :disabled="submitting || loadingWriting"
          class="min-h-[44px] px-8 py-4 bg-ink text-paper rounded-md hover:bg-ink-light disabled:opacity-50 disabled:cursor-not-allowed text-sm font-sans"
        >
          {{ submitting ? (isEditing ? 'Updating...' : 'Publishing...') : (isEditing ? 'Update' : 'Publish') }}
        </button>
        <router-link
          to="/home"
          class="min-h-[44px] inline-flex items-center justify-center px-8 py-4 border border-line rounded-md text-ink-lighter hover:text-ink hover:bg-line text-center text-sm font-sans"
        >
          Cancel
        </router-link>
      </div>
      <!-- Draft Saved Indicator -->
      <div
        v-if="showDraftIndicator"
        class="mt-6 px-4 py-2 rounded-md text-xs sm:text-sm font-sans"
        :class="hasUnsavedChanges ? 'bg-accent-muted text-ink' : 'bg-accent-muted text-ink-lighter'"
      >
        Draft saved at {{ draftSavedAt ?? '—' }}
      </div>
      </div>
    </form>

    <!-- Slide-out metadata panel (cover, themes, visibility) - P1-uix-02 -->
    <div
      v-if="metadataPanelOpen"
      class="fixed inset-0 z-30 bg-black/20 transition-opacity duration-150"
      aria-hidden="true"
      @click="metadataPanelOpen = false"
    />
    <MetadataPanel
      v-model="metadataPanelOpen"
      :form="form"
      :available-themes="availableThemes"
      :loading-themes="loadingThemes"
      :loading-writing="loadingWriting"
      :error="error"
      @cover-file-select="handleCoverFileSelect"
      @open-crop="showCropModal = true"
    />
    <CoverImageCropModal
      v-if="showCropModal && form.coverImageUrl"
      :image-url="form.coverImageUrl"
      @cropped="onCoverCropped"
      @cancel="showCropModal = false"
    />

    <!-- Draft Recovery Modal -->
    <div v-if="showRecoveryModal && recoveryDraft" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-2">Recover Unsaved Work?</h3>
        <p class="text-ink-light mb-4">
          You have an unsaved draft from {{ formatTime(recoveryDraft.timestamp) }}. Would you like to recover it?
        </p>
        <div class="mb-4 p-3 bg-accent-muted rounded-md text-sm">
          <div class="font-medium text-ink-light mb-1">Draft Preview:</div>
          <div class="text-ink-lighter">
            <strong>Title:</strong> {{ recoveryDraft.title || '(empty)' }}
          </div>
          <div class="text-ink-lighter mt-1">
            <strong>Body:</strong> {{ recoveryDraft.body.substring(0, 100) }}{{ recoveryDraft.body.length > 100 ? '...' : '' }}
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-3">
          <button
            @click="dismissRecoveryModal"
            class="px-4 py-2 rounded-md text-ink-lighter hover:text-ink-light text-sm"
          >
            Dismiss
          </button>
          <button
            @click="discardDraft"
            class="px-4 py-2 border border-line rounded-md text-ink-light hover:text-ink hover:bg-line text-sm"
          >
            Discard
          </button>
          <button
            @click="restoreDraft"
            class="px-4 py-2 bg-accent text-paper rounded-md hover:bg-accent-hover text-sm"
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
import MetadataPanel from '../components/writing/MetadataPanel.vue'
import CoverImageCropModal from '../components/writing/CoverImageCropModal.vue'

const router = useRouter()
const route = useRoute()

const writingId = computed(() => route.params.id as string | undefined)
const isEditing = computed(() => !!writingId.value)

const form = ref({
  title: '',
  body: '',
  themeIds: [] as string[],
  visibility: 'private' as 'private' | 'shared' | 'public',
  coverImageUrl: '' as string,
  coverImagePosition: '50% 50%' as string
})

const initialFormState = ref({
  title: '',
  body: '',
  themeIds: [] as string[],
  visibility: 'private' as 'private' | 'shared' | 'public',
  coverImageUrl: '' as string,
  coverImagePosition: '50% 50%' as string
})

const availableThemes = ref<Theme[]>([])
const loadingThemes = ref(true)
const loadingWriting = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)
const showCropModal = ref(false)
const metadataPanelOpen = ref(false)

// Non-blocking typography suggestions (P1-uix-03: progressive reveal on pause/blur)
// Rules from API with fallback to bundled defaults (cni-07)
const { rules: typographyRules } = useTypographyRules()
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null)
const typographySuggestions = ref<TypographySuggestion[]>([])
const suggestionsPanelExpanded = ref(false)
const dismissedSuggestionKeys = ref(new Set<string>())
let scanTimer: ReturnType<typeof setTimeout> | null = null
const SCAN_DEBOUNCE_MS = 1500

function suggestionKey(s: TypographySuggestion): string {
  return `${s.ruleId}:${s.original}`
}

function refreshSuggestions() {
  const all = scanTypography(form.value.body, typographyRules.value)
  typographySuggestions.value = all.filter(
    s => !dismissedSuggestionKeys.value.has(suggestionKey(s))
  )
}

watch(() => form.value.body, () => {
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    refreshSuggestions()
  }, SCAN_DEBOUNCE_MS)
})

function onBodyBlur() {
  if (scanTimer) clearTimeout(scanTimer)
  refreshSuggestions()
}

// Draft management
const draft = useWriteDraft(writingId.value, form)
const showRecoveryModal = ref(false)
const recoveryDraft = ref<{ title: string; body: string; themeIds: string[]; visibility: 'private' | 'shared' | 'public'; coverImageUrl?: string; coverImagePosition?: string; timestamp: number } | null>(null)
// Track if form has unsaved changes
const hasUnsavedChanges = computed(() => {
  // Check simple fields first (most common changes)
  if (form.value.title !== initialFormState.value.title ||
      form.value.body !== initialFormState.value.body ||
      form.value.visibility !== initialFormState.value.visibility ||
      form.value.coverImageUrl !== initialFormState.value.coverImageUrl ||
      form.value.coverImagePosition !== initialFormState.value.coverImagePosition) {
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
      visibility: form.value.visibility,
      coverImageUrl: form.value.coverImageUrl,
      coverImagePosition: form.value.coverImagePosition
    }
  }
})

function onCoverCropped(newUrl: string) {
  form.value.coverImageUrl = newUrl
  form.value.coverImagePosition = '50% 50%'
  showCropModal.value = false
}

const handleCoverFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.postFormData<{ data: { path: string } }>('/writing/upload', formData)
    const path = res.data?.path
    if (path) form.value.coverImageUrl = path
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to upload image'
  }
}

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
    visibility: (writing.visibility || 'private') as 'private' | 'shared' | 'public',
    coverImageUrl: writing.coverImageUrl || '',
    coverImagePosition: writing.coverImagePosition || '50% 50%'
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
      visibility: data.visibility,
      coverImageUrl: data.coverImageUrl || '',
      coverImagePosition: data.coverImagePosition || '50% 50%'
    }
    initialFormState.value = {
      title: data.title,
      body: data.body,
      themeIds: [...data.themeIds],
      visibility: data.visibility,
      coverImageUrl: data.coverImageUrl || '',
      coverImagePosition: data.coverImagePosition || '50% 50%'
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

/** Perform the actual API call. */
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
        visibility: form.value.visibility,
        coverImageUrl: form.value.coverImageUrl || undefined,
      coverImagePosition: form.value.coverImagePosition || undefined
      })
    } else {
      await api.post<ApiResponse<any>>('/writing', {
        title: form.value.title,
        body: form.value.body,
        themeIds: form.value.themeIds,
        visibility: form.value.visibility,
        coverImageUrl: form.value.coverImageUrl || undefined,
      coverImagePosition: form.value.coverImagePosition || undefined
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
  refreshSuggestions()
}

function dismissTypographySuggestion(idx: number) {
  const suggestion = typographySuggestions.value[idx]
  if (suggestion) {
    dismissedSuggestionKeys.value.add(suggestionKey(suggestion))
  }
  typographySuggestions.value = typographySuggestions.value.filter((_, i) => i !== idx)
}

function acceptAllTypographySuggestions() {
  const suggestions = typographySuggestions.value
  if (suggestions.length === 0) return
  form.value.body = applySuggestions(form.value.body, suggestions)
  typographySuggestions.value = []
  suggestionsPanelExpanded.value = false
}

function dismissAllTypographySuggestions() {
  for (const s of typographySuggestions.value) {
    dismissedSuggestionKeys.value.add(suggestionKey(s))
  }
  typographySuggestions.value = []
  suggestionsPanelExpanded.value = false
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
  if (scanTimer) clearTimeout(scanTimer)
  draft.disableAutosave()
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

</script>
