<template>
  <div class="zen-editor w-full" :class="{ 'panel-open': assistOpen || metadataPanelOpen }">
    <!-- Typewriter chrome — purely decorative, evokes the machine without
         crowding the surface. Top: cylindrical platen bar with end-knobs.
         Bottom: ribbon strip with a thin accent stripe and ruler ticks.
         Both sticky to the viewport edges so they always frame the page. -->
    <div class="zen-platen" aria-hidden="true">
      <div class="platen-knob platen-knob-left">
        <div class="platen-knob-grooves"></div>
      </div>
      <div class="platen-cylinder"></div>
      <div class="platen-knob platen-knob-right">
        <div class="platen-knob-grooves"></div>
      </div>
    </div>
    <div class="zen-ribbon" aria-hidden="true">
      <div class="zen-ribbon-stripe"></div>
      <div class="zen-ribbon-ruler"></div>
    </div>

    <!-- Zen editor surface: just the writing block. No header, no footer, no
         banners. All controls live in the floating WritingToolsCluster. -->
    <form @submit.prevent="handleSubmit" class="flex flex-col w-full">
      <!-- Brightness slider — a near-invisible track in the top line of
           the writing block. Sun icon thumb. Slides from full dark theme
           (left) to full light theme (right). Drives JS interpolation of
           every --color-* variable on documentElement. -->
      <div class="zen-brightness w-full max-w-[100ch] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pt-3">
        <div class="zen-brightness-track">
          <input
            ref="brightnessInputRef"
            type="range"
            min="0"
            max="100"
            step="1"
            v-model.number="brightnessValue"
            aria-label="Page brightness — dark theme to light theme"
            :title="`Brightness: ${brightnessValue}%`"
            class="zen-brightness-slider"
          />
          <!-- Sun icon shown adjacent to the thumb. Stays at the right end as
               a "destination = light" cue regardless of thumb position. -->
          <span class="zen-brightness-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
                 stroke="currentColor" stroke-width="1.4"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="10" cy="10" r="3.2" />
              <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M4.6 15.4l1.4-1.4M14 6l1.4-1.4" />
            </svg>
          </span>
        </div>
      </div>

      <!-- Title — typed onto the page, not a UI label. Same typewriter
           font as the body, slightly larger, with a faint bottom rule
           that suggests an underline-stamp from the typewriter itself.
           Width matches the body so they read as one continuous sheet. -->
      <div class="zen-title-area w-full max-w-[100ch] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pt-6 sm:pt-8">
        <input
          id="title"
          ref="titleInputRef"
          v-model="form.title"
          type="text"
          required
          class="block w-full border-0 bg-transparent font-typewriter text-2xl sm:text-3xl font-bold text-ink placeholder:text-ink-whisper focus:ring-0 focus:outline-none py-1"
          placeholder="Place your title here"
          aria-label="Title"
        />
      </div>

      <!-- Body — typewriter scrolling: 100vh padding-bottom so any line
           can be scrolled to the typewriter position. Width matches the
           title (100ch) so the page reads as one wide sheet. -->
      <div class="zen-body-area relative w-full max-w-[100ch] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
        <textarea
          id="body"
          ref="bodyTextareaRef"
          v-model="form.body"
          required
          class="zen-body block w-full min-h-[40vh] border-0 bg-transparent font-typewriter text-base sm:text-lg text-ink placeholder:text-ink-whisper focus:ring-0 focus:outline-none resize-none overflow-hidden py-2"
          :style="bodyFontStyle"
          placeholder="Place your text here"
          aria-label="Body"
          @input="onBodyInput"
          @click="scheduleTypewriterScroll"
          @keyup="scheduleTypewriterScroll"
          @blur="onBodyBlur"
        />
        <!-- Mirror div: an invisible copy of the textarea content used to
             measure caret pixel position for typewriter scrolling.
             CRITICAL: must wrap text at the SAME column as the textarea or
             the marker's Y won't match the cursor's actual Y. Width is set
             via matching horizontal padding (parent has px-*; mirror copies
             it). Font, size, vertical padding and line-height must also
             match the textarea exactly. -->
        <div
          ref="bodyMirrorRef"
          class="zen-body absolute top-0 left-0 right-0 invisible font-typewriter text-base sm:text-lg px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-2 whitespace-pre-wrap break-words pointer-events-none"
          :class="bodyMirrorClasses"
          :style="bodyFontStyle"
          aria-hidden="true"
        ></div>
      </div>
    </form>

    <!-- Metadata panel (cover, themes, visibility) — sits alongside the
         editor when open (no modal backdrop), thanks to the panel-open
         class on .zen-editor that adds right-padding to the writing area. -->
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

    <!-- Floating zen cluster — page actions on top, AI tools below. This is
         the ONLY persistent UI on the editor surface. Nothing else.  -->
    <WritingToolsCluster
      :has-selection="hasLiveSelection"
      :active-mode="assistOpen ? assistMode : null"
      :is-editing="isEditing"
      :save-busy="submitting"
      :save-disabled="loadingWriting || !canSave"
      :metadata-open="metadataPanelOpen"
      :cursor-y="cursorViewportY"
      :model="selectedModel"
      @select="openAssist"
      @save="handleSubmit"
      @metadata="metadataPanelOpen = true"
      @exit="handleExit"
      @font-up="bumpFontSize(+1)"
      @font-down="bumpFontSize(-1)"
      @update:model="onModelChange"
    />

    <!-- Tiny bottom-left status pill — only visible briefly after save success
         or while showing an error. Replaces the bulky footer's draft indicator
         and error banner with something that doesn't permanently take screen real estate. -->
    <Transition name="zen-status">
      <div
        v-if="zenStatus"
        class="zen-status-pill"
        :class="zenStatus.kind"
        role="status"
        aria-live="polite"
      >
        {{ zenStatus.message }}
      </div>
    </Transition>
    <WritingAssistPanel
      :open="assistOpen"
      :mode="assistMode ?? 'coherence'"
      :response="assistResponse"
      :is-loading="assistIsLoading"
      :error-message="assistErrorMessage"
      :unconfigured="assistUnconfigured"
      :selection="assistSelection"
      :writing-saved="isEditing"
      @close="closeAssist"
      @submit-coherence="handleSubmitCoherence"
      @submit-define="handleSubmitDefine"
      @insert="handleInsertAtCursor"
      @replace="handleReplaceSelection"
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
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
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
import WritingToolsCluster from '../components/writing/WritingToolsCluster.vue'
import WritingAssistPanel from '../components/writing/WritingAssistPanel.vue'
import { useBreathingCaret } from '../composables/useBreathingCaret'
import { useWritingAssist } from '../composables/useWritingAssist'
import type { WritingAssistMode } from '@shared/WritingAssist'
import { countWordsInMarkdown } from '../utils/markdown'
import { useNavigationOrigin } from '../stores/navigation'

const route = useRoute()

const { origin: navOrigin, navigateBack } = useNavigationOrigin('/home')

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
const titleInputRef = ref<HTMLInputElement | null>(null)
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null)
const typographySuggestions = ref<TypographySuggestion[]>([])
const suggestionsPanelExpanded = ref(false)
const dismissedSuggestionKeys = ref(new Set<string>())
// Breathing caret — P2-uix-06 / cni-06
const { refresh: refreshCaret } = useBreathingCaret(titleInputRef, bodyTextareaRef)
watch(() => form.value.body, () => nextTick(refreshCaret))
watch(() => form.value.title, () => nextTick(refreshCaret))

let scanTimer: ReturnType<typeof setTimeout> | null = null
const SCAN_DEBOUNCE_MS = 1500

// Word count on pause (P3-uix-07 / cni-07): visible only after typing pause, 2 lines below text
const showWordCount = ref(false)
const bodyWordCount = computed(() => countWordsInMarkdown(form.value.body))
const bodyMirrorRef = ref<HTMLDivElement | null>(null)
const wordCountStyle = ref<{ top: string }>({ top: '0.5rem' })

const bodyMirrorClasses = 'w-full'

function updateWordCountPosition() {
  const mirror = bodyMirrorRef.value
  if (!mirror) return
  const computed = getComputedStyle(mirror)
  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.6
  const textHeight = mirror.offsetHeight
  const twoLines = 2 * lineHeight
  wordCountStyle.value = { top: `${textHeight + twoLines}px` }
}

watch(showWordCount, (visible) => {
  if (visible) {
    nextTick(() => updateWordCountPosition())
  }
})

watch(() => form.value.body, () => {
  if (showWordCount.value) {
    nextTick(() => updateWordCountPosition())
  }
})

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
  showWordCount.value = false
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    refreshSuggestions()
    showWordCount.value = true
  }, SCAN_DEBOUNCE_MS)
})

function onBodyBlur() {
  if (scanTimer) clearTimeout(scanTimer)
  refreshSuggestions()
  showWordCount.value = true
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
    flashZenStatus('success', isEditing.value ? 'Updated' : 'Published', 1200)
    navigateBack()
  } catch (err) {
    const msg = err instanceof Error ? err.message : (isEditing.value ? 'Failed to update writing' : 'Failed to publish writing')
    error.value = msg
    flashZenStatus('error', msg, 4000)
  } finally {
    submitting.value = false
  }
}

const handleSubmit = async () => {
  if (!form.value.title.trim() || !form.value.body.trim()) {
    const msg = 'Title and body are required'
    error.value = msg
    flashZenStatus('error', msg, 2400)
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

/* ============================================================
 * Writing assist — coherence Q&A, define, focus, expand, proofread.
 *
 * Floating bottom-right cluster opens a slide-out right panel. The cluster
 * picks the mode; the panel runs the AI request and emits insert/replace
 * back into the textarea. Selection tracking is the only intrusive bit —
 * it's read-only and runs on the same events the breathing-caret already
 * listens to, so it adds no new event surface.
 * ============================================================ */

const assistOpen = ref(false)
const assistMode = ref<WritingAssistMode | null>(null)
// The text currently selected in the body textarea, snapshotted whenever
// the user opens a tool. We snapshot rather than computing live because
// once the panel takes focus the textarea selection collapses.
const assistSelection = ref('')
// Where the snapshotted selection lives in the textarea, so Replace can
// substitute exactly the right range (Insert falls back to caret).
const assistSelectionRange = ref<{ start: number; end: number } | null>(null)
// Live "is there currently a selection" flag for the cluster's disabled
// state. Updated on selectionchange — cheap, no debounce needed.
const hasLiveSelection = ref(false)

// NOTE on destructuring: Vue auto-unwraps refs/computeds in templates ONLY
// when they're bound as top-level identifiers. Reaching them via
// `writingAssist.isLoading` keeps the underlying ComputedRef wrapped, which
// causes "Expected Boolean, got Object" prop warnings on the panel. So we
// destructure into top-level locals.
/* ============================================================
 * Selected OpenAI model — the writer picks from a popover in the cluster.
 * Default 'gpt-4o-mini' (cheapest, matches the server's prior default).
 * Persisted to localStorage so the choice survives page reloads. The
 * server validates against an allow-list before honouring it.
 * ============================================================ */
const SELECTED_MODEL_STORAGE_KEY = 'rambulations-selected-model'
const DEFAULT_MODEL = 'gpt-4o-mini'

const selectedModel = ref<string>((() => {
  try {
    return localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) || DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
})())

function onModelChange(modelId: string) {
  selectedModel.value = modelId
  try { localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId) } catch { /* quota / unavailable — ignore */ }
}

const {
  response:             assistResponse,
  isLoading:            assistIsLoading,
  errorMessage:         assistErrorMessage,
  unconfigured:         assistUnconfigured,
  coherence:            runCoherence,
  define:               runDefine,
  focus:                runFocus,
  expand:               runExpand,
  proofread:            runProofread,
  factCheck:            runFactCheck,
  // Develop quadrant — four sister wrappers, dispatched from the
  // cluster's Develop sub-menu. Same arg shape as runExpand.
  fictionBreadth:       runFictionBreadth,
  fictionDepth:         runFictionDepth,
  nonfictionBreadth:    runNonfictionBreadth,
  nonfictionDepth:      runNonfictionDepth,
  clear:                clearAssist,
} = useWritingAssist(
  () => writingId.value ?? null,
  () => selectedModel.value,
)

function captureCurrentSelection(): { text: string; start: number; end: number } {
  const ta = bodyTextareaRef.value
  if (!ta) return { text: '', start: 0, end: 0 }
  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? 0
  const text = start !== end ? ta.value.slice(start, end) : ''
  return { text, start, end }
}

/* ============================================================
 * Zen page actions — Save / Metadata / Exit live in the cluster.
 * ============================================================ */

/** Disable Save when there's no title or body — prevents empty submissions
 *  the user wouldn't want, and makes the save icon look quietly inert until
 *  there's something to commit. */
const canSave = computed(() =>
  form.value.title.trim().length > 0 && form.value.body.trim().length > 0
)

/** Lightweight status pill replacing the old footer's draft / error banners.
 *  Stays minimal, fades after a short timeout, keeps the canvas zen. */
const zenStatus = ref<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null)
let zenStatusTimer: ReturnType<typeof setTimeout> | null = null

/* ============================================================
 * Body font size — controlled by the A+ / A- icons in the cluster.
 * Default is null, meaning "use the CSS default" (text-base sm:text-lg).
 * Once the writer adjusts, we apply a pixel-explicit font-size on both
 * the textarea AND the mirror via :style binding. They MUST stay in
 * sync or line wrapping will diverge and typewriter scroll breaks.
 * ============================================================ */

const FONT_SIZE_MIN = 12
const FONT_SIZE_MAX = 28
const FONT_SIZE_STEP = 2

const bodyFontSize = ref<number | null>(null) // null = use CSS default

/** Style object applied to both textarea and mirror. Returns an empty
 *  object when no override is in play (CSS class governs). */
const bodyFontStyle = computed<Record<string, string>>(() =>
  bodyFontSize.value === null
    ? {}
    : { fontSize: `${bodyFontSize.value}px` }
)

function bumpFontSize(direction: number) {
  const ta = bodyTextareaRef.value
  const current = bodyFontSize.value
    ?? (ta ? parseFloat(getComputedStyle(ta).fontSize) || 16 : 16)
  const next = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, current + direction * FONT_SIZE_STEP))
  bodyFontSize.value = next
  // Re-snap textarea height since line-height (unitless 1.85) scales with
  // font-size — the new content height is different. Wait one tick so the
  // style binding has flushed before we measure.
  nextTick(() => {
    autoResizeBody()
    refreshCursorViewportY()
  })
}

/* ============================================================
 * Idle autosave — saves the essay to the server 10 seconds after the
 * last change, but only when:
 *   - we're editing an existing essay (need a server-side id), AND
 *   - the form differs from the last-saved state, AND
 *   - we're not already in the middle of a manual save.
 *
 * Different from useWriteDraft (which writes to localStorage in create
 * mode for crash-recovery). This one is server persistence in edit mode.
 *
 * Implementation: every form change resets a debounce timer; if no
 * further changes land before it fires, the autosave runs.
 * ============================================================ */

const AUTOSAVE_IDLE_MS = 10000
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutosave() {
  if (!isEditing.value) return // new essays still require manual Publish
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(runAutosaveIfNeeded, AUTOSAVE_IDLE_MS)
}

async function runAutosaveIfNeeded() {
  autosaveTimer = null
  // Re-check guards at fire time — state may have changed in the 10s
  // since we scheduled. The writer might have hit Publish manually,
  // navigated away, or simply not made any net changes.
  if (!isEditing.value) return
  if (submitting.value) return
  if (!hasUnsavedChanges.value) return
  const id = writingId.value
  if (!id) return

  try {
    submitting.value = true
    await api.put<ApiResponse<any>>(`/writing/${id}`, {
      title: form.value.title,
      body: form.value.body,
      themeIds: form.value.themeIds,
      visibility: form.value.visibility,
      coverImageUrl: form.value.coverImageUrl || undefined,
      coverImagePosition: form.value.coverImagePosition || undefined,
    })
    // Snap initialFormState to the just-saved values so hasUnsavedChanges
    // flips false. Note this MUTATES form.value via setFormState; the
    // subsequent watcher won't trigger another autosave because each
    // watched getter returns the same primitive value as before.
    setFormState(form.value)
    flashZenStatus('info', 'Autosaved', 1200)
  } catch (err) {
    // Stay quiet on autosave failures — the writer didn't ask for this
    // to happen, so a brief notice is enough; they can manually Save
    // (cluster Save icon) if they want a guaranteed write.
    const msg = err instanceof Error ? err.message : 'Autosave failed'
    flashZenStatus('error', `Autosave failed: ${msg}`, 3000)
  } finally {
    submitting.value = false
  }
}

// Watch every saveable form field. Any change schedules a fresh idle
// timer — so 10 seconds of no further edits triggers the autosave.
watch(
  () => [
    form.value.title,
    form.value.body,
    form.value.themeIds,
    form.value.visibility,
    form.value.coverImageUrl,
    form.value.coverImagePosition,
  ],
  () => {
    scheduleAutosave()
  },
  { deep: true }
)

/* ============================================================
 * Brightness slider — interpolates between the dark and light theme
 * colors defined in index.css. The slider value (0–100) drives a JS
 * lerp of every --color-* variable, applied as inline styles on
 * document.documentElement (which override :root and .dark definitions).
 *
 * The .dark structural class is also stripped while the slider is in
 * use, so treatments that depend on it (the body gradient, the hidden
 * paper-grain overlay) don't fight the interpolation. They re-engage
 * if the writer drags the slider all the way to 0.
 * ============================================================ */

const brightnessInputRef = ref<HTMLInputElement | null>(null)
const brightnessValue = ref<number>(100) // 100 = light by default

/** Snapshot of `.dark`-on-`<html>` taken at mount, BEFORE applyBrightness
 *  strips the class. The unmount cleanup uses this to restore the writer
 *  to the same theme state they arrived in. Module-scoped (not a ref)
 *  because no template needs it — it's plumbing for cleanup. */
let wasDarkOnEntry = false

/** Pairs of (light-mode RGB) and (dark-mode RGB) for every theme token.
 *  Keep these in sync with the values in index.css :root / .dark blocks.
 *  When you change a token's color in index.css, also update its entry
 *  here or the brightness slider will lerp to a stale value. */
type Rgb = readonly [number, number, number]
const THEME_PAIRS: { name: string; light: Rgb; dark: Rgb }[] = [
  { name: '--color-paper',         light: [226, 204, 172], dark: [54,  52,  46] },
  { name: '--color-surface',       light: [234, 215, 188], dark: [64,  70,  58] },
  { name: '--color-ink',           light: [37,  37,  32 ], dark: [226, 204, 172] },
  { name: '--color-ink-light',     light: [30,  46,  28 ], dark: [168, 180, 196] },
  { name: '--color-ink-lighter',   light: [122, 142, 158], dark: [122, 142, 158] },
  { name: '--color-ink-whisper',   light: [168, 180, 196], dark: [98,  95,  85 ] },
  { name: '--color-line',          light: [207, 188, 156], dark: [78,  76,  68 ] },
  { name: '--color-accent',        light: [255, 128, 24 ], dark: [255, 128, 24 ] },
  { name: '--color-accent-hover',  light: [230, 100, 10 ], dark: [255, 208, 85 ] },
  { name: '--color-accent-muted',  light: [248, 230, 200], dark: [70,  52,  36 ] },
  { name: '--cluster-icon-color',  light: [30,  46,  28 ], dark: [255, 255, 255] },
]

function applyBrightness(value: number) {
  const t = Math.max(0, Math.min(100, value)) / 100
  const root = document.documentElement
  for (const pair of THEME_PAIRS) {
    const r = Math.round(pair.dark[0] + (pair.light[0] - pair.dark[0]) * t)
    const g = Math.round(pair.dark[1] + (pair.light[1] - pair.dark[1]) * t)
    const b = Math.round(pair.dark[2] + (pair.light[2] - pair.dark[2]) * t)
    root.style.setProperty(pair.name, `${r} ${g} ${b}`)
  }
  // ALWAYS strip .dark — the slider drives all colors via inline vars,
  // and the structural .dark CSS (body gradient, page-canvas gradient,
  // hidden paper grain) was fighting those overrides. At slider=0 the
  // shorthand `background: linear-gradient(...)` in .dark .page-canvas
  // resets background-color to transparent and depends on the gradient
  // vars, producing a blank surface. Solid colours via inline vars are
  // predictable across the entire 0–100 range. The animated dusk-drift
  // remains available outside slider mode — if the writer hasn't touched
  // the slider, system-pref / .dark behaviour is unchanged.
  root.classList.remove('dark')
}

watch(brightnessValue, (v) => applyBrightness(v))

function flashZenStatus(kind: 'success' | 'error' | 'info', message: string, ms: number = 2400) {
  zenStatus.value = { kind, message }
  if (zenStatusTimer) clearTimeout(zenStatusTimer)
  zenStatusTimer = setTimeout(() => { zenStatus.value = null }, ms)
}

/** Exit icon — go back to wherever the writer came from, persisting any
 *  unsaved draft via the existing useWriteDraft hook (the route-leave guard
 *  handles that). */
function handleExit() {
  navigateBack()
}

/* ============================================================
 * Auto-resize the body textarea so its height always matches its content.
 *
 * Without this, the textarea's min-h-[Xvh] caps it at a fixed height and
 * any content past that scrolls INSIDE the textarea. That breaks two
 * things at once:
 *   1. The breathing-caret composable hides itself when the cursor's Y
 *      exceeds the textarea's clientHeight (it thinks the cursor has
 *      scrolled out of view).
 *   2. The typewriter window-scroll has nothing to scroll, because the
 *      textarea-internal scroll is what actually moved.
 *
 * Snapping height to scrollHeight every time the value changes makes the
 * textarea grow with content. The page itself becomes the scrollable
 * surface, and both effects work as intended.
 * ============================================================ */

function autoResizeBody() {
  const ta = bodyTextareaRef.value
  const mirror = bodyMirrorRef.value
  if (!ta || !mirror) return
  // Measure via the mirror, NOT via the textarea's own scrollHeight.
  //
  // The old "ta.style.height = 'auto'; ta.style.height = scrollHeight + 'px'"
  // pattern triggers two synchronous reflows per keystroke and visibly flashes
  // — the textarea collapses to min-height for a frame, then snaps back. The
  // mirror is already a hidden duplicate sized identically to the textarea
  // (matching font, padding, width). Reading its offsetHeight gives us the
  // target height in one pass without ever touching the live textarea's
  // dimensions during measurement.
  //
  // We sync the mirror's text to the current value here. The typewriter-
  // scroll function will later overwrite it with a marker injected at the
  // caret position; both writes are safe because the mirror is invisible
  // and only used for measurement.
  const trailingNewline = ta.value.endsWith('\n')
  mirror.textContent = (ta.value || ' ') + (trailingNewline ? ' ' : '')
  const target = mirror.offsetHeight
  // Skip noise: only commit a height change once it differs by at least
  // one pixel. Prevents subtle jitter during rapid typing where rounding
  // makes the same line measure 24px vs 24.5px alternately.
  const current = parseFloat(ta.style.height || '0') || ta.offsetHeight
  if (Math.abs(target - current) < 1) return
  ta.style.height = `${target}px`
}

// Watch the body for ANY change — typing, load-from-server, draft-restore,
// AI insert/replace — and snap the textarea height to fit. Runs on the
// next tick so the textarea has had a chance to flush the new value
// through the DOM before we read scrollHeight.
watch(() => form.value.body, () => nextTick(autoResizeBody))

/* ============================================================
 * Typewriter scrolling — keep the active line at a fixed lower-middle
 * position in the viewport as the writer types or moves the caret. We use
 * the existing bodyMirrorRef to compute caret pixel position by inserting
 * a marker span at selectionStart. Throttled to one call per animation
 * frame. Honors prefers-reduced-motion.
 * ============================================================ */

/**
 * Fraction of the viewport that should remain *below* the active typing
 * line once typewriter-centering has kicked in. 0.20 means the cursor
 * sits at 80% from the top with 20vh of breathing room beneath. Tweak
 * this single constant to move the typewriter line up or down.
 */
const TYPEWRITER_BOTTOM_PCT = 0.20

/**
 * Cursor's Y position in the viewport, in pixels. Updated whenever we
 * compute the marker's position (typewriter scroll, selection change,
 * window scroll/resize). Null when the textarea is not focused.
 *
 * The floating WritingToolsCluster reads this via :cursor-y prop and
 * tracks it 10px above when the writer toggles to float mode.
 */
const cursorViewportY = ref<number | null>(null)

let typewriterRaf: number | null = null
let typewriterEnabled: boolean | null = null

function prefersReducedMotion(): boolean {
  if (typewriterEnabled === null) {
    typewriterEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return !typewriterEnabled
}

function scheduleTypewriterScroll() {
  if (typewriterRaf !== null) return
  typewriterRaf = requestAnimationFrame(() => {
    typewriterRaf = null
    runTypewriterScroll()
  })
}

/**
 * Measure the cursor's viewport Y by injecting a zero-width marker into
 * the mirror at the caret position and reading getBoundingClientRect().top.
 *
 * Returns null if the textarea isn't focused (cursor isn't really
 * "anywhere" in that case) or the refs aren't ready. Side-effect: the
 * mirror's content is replaced with [head, marker, tail]. autoResizeBody
 * also writes to the mirror, but the marker is zero-width so it doesn't
 * meaningfully change mirror.offsetHeight; auto-resize remains accurate.
 */
function measureCursorViewportY(): number | null {
  const ta = bodyTextareaRef.value
  const mirror = bodyMirrorRef.value
  if (!ta || !mirror) return null
  if (document.activeElement !== ta) return null

  const value = ta.value
  const caret = ta.selectionStart ?? value.length

  mirror.textContent = ''
  mirror.appendChild(document.createTextNode(value.slice(0, caret)))
  const marker = document.createElement('span')
  marker.textContent = '​' // zero-width space — keeps line height correct
  mirror.appendChild(marker)
  mirror.appendChild(document.createTextNode(value.slice(caret) || ' '))

  return marker.getBoundingClientRect().top
}

function runTypewriterScroll() {
  const cursorY = measureCursorViewportY()
  if (cursorY === null) return

  // Update the floating-cluster's tracking position whenever we measure.
  cursorViewportY.value = cursorY

  // Compute the marker's absolute Y in the document, then scroll so it
  // sits with TYPEWRITER_BOTTOM_PCT of the viewport remaining below it.
  // This keeps the cursor away from the bottom edge (no "writing at the
  // floor" feel) while still showing plenty of context above the active
  // line. We only scroll DOWN: cursors above the target line are left
  // where they are, so short essays don't get yanked around.
  const targetY = window.innerHeight * (1 - TYPEWRITER_BOTTOM_PCT)
  const delta = cursorY - targetY
  if (delta < 4) return // cursor is at or above the line — leave it alone

  window.scrollBy({
    top: delta,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })

  // After a smooth scroll the cursor's viewport Y will be ~targetY.
  // Update the tracker in the next frame so the floating cluster
  // settles to the right position post-scroll. (No need to wait for
  // the actual smooth-scroll animation — the cluster's own CSS
  // transition smooths the visual.)
  cursorViewportY.value = targetY
}

/**
 * Lightweight cursor-Y updater that does NOT scroll the page. Called on
 * selection change, window scroll, and window resize so the floating
 * cluster keeps tracking even when the writer isn't typing.
 */
function refreshCursorViewportY() {
  const y = measureCursorViewportY()
  // null is meaningful — it means the cursor isn't in the textarea.
  // Pass it through so the cluster falls back to its fixed corner.
  cursorViewportY.value = y
}

/** Combined input handler — schedule the typewriter window-scroll. The
 *  watcher on form.value.body handles auto-resize; the typography-scan
 *  watch handles typography suggestions. So this only needs to drive the
 *  per-keystroke window-scroll. */
function onBodyInput() {
  scheduleTypewriterScroll()
}

function onSelectionMaybeChanged() {
  const ta = bodyTextareaRef.value
  if (!ta || document.activeElement !== ta) {
    // Don't flip on/off when the user moves focus to the panel — keep the
    // last known selection state instead, so the cluster doesn't disable
    // mid-flow.
    return
  }
  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? 0
  hasLiveSelection.value = start !== end
}

function openAssist(mode: WritingAssistMode) {
  // Snapshot the selection at open-time. Once the panel takes focus the
  // textarea will lose its selection range, so we MUST capture before
  // any focus shift.
  const snap = captureCurrentSelection()
  assistSelection.value = snap.text
  assistSelectionRange.value = { start: snap.start, end: snap.end }

  assistMode.value = mode
  assistOpen.value = true

  console.log('[writing-assist] open', {
    mode,
    isEditing: isEditing.value,
    writingId: writingId.value ?? null,
    selectionChars: snap.text.length,
    selectionRange: snap.start !== snap.end ? { start: snap.start, end: snap.end } : null,
  })

  // For brand-new drafts (no server id yet) we deliberately do NOT auto-
  // fire any assist request. The panel will display a "save the draft
  // first" message instead — clearer than letting the request fail with
  // a generic error. Writers can still browse the panel UI to see what
  // each tool would do.
  if (!isEditing.value) return

  // Auto-fire the transformative modes — there's nothing for the writer
  // to type. Coherence and define need user input; the panel handles those
  // via its submit buttons.
  if (mode === 'focus') {
    if (!snap.text.trim()) return // panel will show "select text first"
    void runFocus({ selection: snap.text })
  } else if (mode === 'expand') {
    void runExpand({
      selection: snap.text || undefined,
      target: snap.text ? 'section' : 'whole',
    })
  } else if (mode === 'proofread') {
    void runProofread({
      selection: snap.text || undefined,
    })
  } else if (mode === 'factcheck') {
    void runFactCheck({
      selection: snap.text || undefined,
    })
  } else if (
    // Develop quadrant — four sister modes share `expand`'s dispatch
    // shape. The runner is picked by mode; everything else (selection
    // snapshot, whole-vs-section target) is identical to expand.
    mode === 'fiction-breadth'
    || mode === 'fiction-depth'
    || mode === 'nonfiction-breadth'
    || mode === 'nonfiction-depth'
  ) {
    const runner =
      mode === 'fiction-breadth'    ? runFictionBreadth :
      mode === 'fiction-depth'      ? runFictionDepth :
      mode === 'nonfiction-breadth' ? runNonfictionBreadth :
                                      runNonfictionDepth
    void runner({
      selection: snap.text || undefined,
      target: snap.text ? 'section' : 'whole',
    })
  }
}

function closeAssist() {
  assistOpen.value = false
  assistMode.value = null
  clearAssist()
  // Restore focus to the textarea so the writer can keep typing
  nextTick(() => bodyTextareaRef.value?.focus())
}

function handleSubmitCoherence(payload: { question: string; selection: string }) {
  void runCoherence({
    question: payload.question,
    selection: payload.selection || undefined,
  })
}

function handleSubmitDefine(payload: { term: string; contextSnippet: string }) {
  void runDefine({
    term: payload.term,
    contextSnippet: payload.contextSnippet || undefined,
  })
}

/**
 * Insert AI text at the textarea's current cursor position. Used when the
 * writer didn't have anything selected when they opened the tool — the
 * snapshotted "range" is just a caret position (start === end).
 */
function handleInsertAtCursor(text: string) {
  const ta = bodyTextareaRef.value
  if (!ta) {
    console.warn('[writing-assist] insert ignored — textarea ref missing')
    return
  }
  const range = assistSelectionRange.value
  const insertAt = range ? range.start : (ta.selectionStart ?? form.value.body.length)
  console.log('[writing-assist] insert at cursor', { insertAt, insertedChars: text.length })
  const before = form.value.body.slice(0, insertAt)
  const after = form.value.body.slice(insertAt)
  form.value.body = `${before}${text}${after}`
  // Restore focus and place caret immediately after the inserted text
  nextTick(() => {
    ta.focus()
    const caret = insertAt + text.length
    ta.setSelectionRange(caret, caret)
  })
  closeAssist()
}

/**
 * Replace the snapshotted selection with AI text. Falls back to insert-at-
 * cursor if for some reason no range was captured.
 */
function handleReplaceSelection(text: string) {
  const ta = bodyTextareaRef.value
  const range = assistSelectionRange.value
  if (!ta || !range || range.start === range.end) {
    console.log('[writing-assist] replace falling back to insert', {
      hasTextarea: !!ta,
      range,
    })
    handleInsertAtCursor(text)
    return
  }
  console.log('[writing-assist] replace selection', {
    range,
    removedChars: range.end - range.start,
    insertedChars: text.length,
  })
  const before = form.value.body.slice(0, range.start)
  const after = form.value.body.slice(range.end)
  form.value.body = `${before}${text}${after}`
  nextTick(() => {
    ta.focus()
    const caret = range.start + text.length
    ta.setSelectionRange(caret, caret)
  })
  closeAssist()
}

// selectionchange is the cleanest signal for "the selection in any input
// has changed". Fires for both keyboard (shift+arrow) and mouse drag.
// Also refreshes the cursor's viewport Y so the floating cluster tracks
// arrow-key navigation, not just typing.
function onDocumentSelectionChange() {
  onSelectionMaybeChanged()
  refreshCursorViewportY()
}

/** Window scroll / resize — the cursor's viewport Y changes even when the
 *  writer isn't doing anything (page scrolling, window resize). The
 *  floating cluster needs to follow. Throttled to one rAF to avoid spam. */
let cursorYRaf: number | null = null
function onWindowScrollOrResize() {
  if (cursorYRaf !== null) return
  cursorYRaf = requestAnimationFrame(() => {
    cursorYRaf = null
    refreshCursorViewportY()
  })
}

// Persist draft to localStorage before leaving (no confirmation dialog)
const handleBeforeUnload = () => {
  if (hasUnsavedChanges.value) {
    draft.saveDraft()
  }
}

// Vue Router guard: persist draft to localStorage before in-app navigation
onBeforeRouteLeave(async (_to, _from, next) => {
  // If a pending idle-autosave was scheduled but hasn't fired yet, flush
  // it now — otherwise the writer's last 10s of edits would only live in
  // localStorage (via draft.saveDraft below) and not on the server.
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
    if (isEditing.value && hasUnsavedChanges.value) {
      try { await runAutosaveIfNeeded() } catch { /* swallow — fall through to draft */ }
    }
  }
  // Always also persist to localStorage as a belt-and-braces backup,
  // matching the original behaviour for create mode and surviving any
  // server failure in edit mode.
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

  // Belt-and-braces auto-resize: run once after mount to snap the textarea
  // to the loaded body's height. The watch handles all subsequent changes,
  // but on the FIRST render the watcher hasn't fired yet (the body value
  // was set before the textarea was in the DOM).
  await nextTick()
  autoResizeBody()

  // Initialize brightness from the current document state. If the writer
  // arrived in dark mode (.dark class set by useTheme), the slider starts
  // at 0 (full dark). Otherwise 100 (full light). This is purely visual
  // initialization — the slider takes over from here.
  //
  // We snapshot the original .dark state BEFORE applyBrightness strips
  // it, so onBeforeUnmount can restore it. Without this, navigating
  // away leaves the inline CSS vars on <html> and the .dark class
  // stripped, which breaks the rest of the app: any later toggle of
  // dark mode pairs the structural .dark gradient with light-valued
  // inline CSS vars, producing dark text on a dark gradient → blank
  // pages site-wide. See also: cleanup block in onBeforeUnmount.
  wasDarkOnEntry = document.documentElement.classList.contains('dark')
  brightnessValue.value = wasDarkOnEntry ? 0 : 100

  // Add beforeunload event listener
  window.addEventListener('beforeunload', handleBeforeUnload)
  // selectionchange tells the writing-tools cluster whether to enable
  // selection-only tools like Focus. It fires from both keyboard and mouse.
  document.addEventListener('selectionchange', onDocumentSelectionChange)
  // Page scroll + viewport resize change the cursor's viewport Y even
  // without typing — the floating cluster must follow.
  window.addEventListener('scroll', onWindowScrollOrResize, { passive: true })
  window.addEventListener('resize', onWindowScrollOrResize)
})

onBeforeUnmount(() => {
  if (scanTimer) clearTimeout(scanTimer)
  if (zenStatusTimer) clearTimeout(zenStatusTimer)
  if (autosaveTimer) clearTimeout(autosaveTimer)
  if (typewriterRaf !== null) cancelAnimationFrame(typewriterRaf)
  if (cursorYRaf !== null) cancelAnimationFrame(cursorYRaf)
  draft.disableAutosave()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  document.removeEventListener('selectionchange', onDocumentSelectionChange)
  window.removeEventListener('scroll', onWindowScrollOrResize)
  window.removeEventListener('resize', onWindowScrollOrResize)

  /* ---- Brightness cleanup ----
   *
   * The slider sets inline CSS vars on document.documentElement and
   * strips the .dark class. Both effects must be undone when the
   * writer leaves /write — otherwise the rest of the app inherits the
   * inline overrides. The classic symptom: user visits /write, hits
   * dark mode somewhere else later, and content becomes invisible
   * because dark-mode structural CSS (the .page-canvas gradient)
   * pairs with light-valued inline vars (--color-ink stuck at 37 37
   * 32) producing dark text on a dark gradient.
   *
   * Strategy: remove every theme-pair var we set, then restore the
   * .dark class to whatever it was on entry so useTheme stays in
   * sync.
   */
  const rootStyle = document.documentElement.style
  for (const pair of THEME_PAIRS) {
    rootStyle.removeProperty(pair.name)
  }
  document.documentElement.classList.toggle('dark', wasDarkOnEntry)
})

</script>

<style scoped>
/* Zen editor canvas — only the BOTTOM gets generous padding. We use a
   full viewport-height of breathing room so the writer always has open
   space below the active line: it's where the typewriter-centering pulls
   the cursor up *into*, and it's also a deliberate visual exhale —
   nothing crowds the bottom of the cursor. The top stays flush so the
   title and the start of the body sit naturally near the top of the
   page on load. */
.zen-body-area {
  padding-bottom: 100vh;
}

/* Side-by-side panel layout — when AssistPanel or MetadataPanel is open,
   the editor reserves a right-side gutter the width of the panel. The
   title + body have max-width + mx-auto, so this gutter shifts the
   centered content leftward without breaking line-length. The platen
   and ribbon stay viewport-wide; the panel sits opaque on top of them
   on the right. */
.zen-editor.panel-open {
  padding-right: 420px;
  transition: padding-right 240ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
.zen-editor {
  transition: padding-right 240ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
@media (prefers-reduced-motion: reduce) {
  .zen-editor,
  .zen-editor.panel-open {
    transition: none;
  }
}
@media (max-width: 768px) {
  /* On narrow viewports, panel takes full width; no point shifting the
     editor — it'd just be hidden anyway. */
  .zen-editor.panel-open {
    padding-right: 0;
  }
}

/* ============================================================
 * Brightness slider — sits in the top line of the writing block.
 * Track is a near-invisible 1px line in the line color; thumb is a
 * 20px sun icon in the accent color. The native range input is
 * styled to be effectively invisible aside from the thumb area.
 * ============================================================ */
.zen-brightness {
  pointer-events: none; /* container — events only on the track */
}
.zen-brightness-track {
  position: relative;
  height: 22px;
  display: flex;
  align-items: center;
  pointer-events: auto;
}
.zen-brightness-slider {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 22px;
  background: transparent;
  cursor: pointer;
  outline: none;
  /* Track styled via ::-webkit-slider-runnable-track and ::-moz-range-track
     below. The wrapper element is just for layout. */
}
.zen-brightness-slider::-webkit-slider-runnable-track {
  height: 1px;
  background: rgb(var(--color-line) / 0.5);
  border-radius: 1px;
}
.zen-brightness-slider::-moz-range-track {
  height: 1px;
  background: rgb(var(--color-line) / 0.5);
  border-radius: 1px;
}
.zen-brightness-slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(var(--color-paper));
  border: 1.5px solid rgb(var(--color-accent));
  margin-top: -9px; /* center on 1px track */
  cursor: grab;
  transition: transform 120ms ease-out, background-color 120ms ease-out;
}
.zen-brightness-slider::-webkit-slider-thumb:hover,
.zen-brightness-slider:focus::-webkit-slider-thumb {
  transform: scale(1.12);
  background: rgb(var(--color-accent-muted));
}
.zen-brightness-slider:active::-webkit-slider-thumb {
  cursor: grabbing;
}
.zen-brightness-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(var(--color-paper));
  border: 1.5px solid rgb(var(--color-accent));
  cursor: grab;
}
.zen-brightness-slider:focus-visible {
  outline: none;
}
.zen-brightness-icon {
  position: absolute;
  right: -2px; /* float just past the right edge of the track */
  top: 50%;
  transform: translateY(-50%);
  color: rgb(var(--color-accent));
  pointer-events: none;
  display: inline-flex;
}

/* Title — typed onto the page. Subtle underline-rule directly beneath the
   text mimics the underscore-stamp many typewriter pages have under their
   heading. Letter-spacing nudged up slightly to read as machine-typed. */
.zen-title-area input {
  letter-spacing: 0.01em;
  border-bottom: 1px solid rgb(var(--color-line));
  padding-bottom: 6px;
  margin-bottom: 8px;
}

/* Body — typewriter cadence. Slightly looser line-height than default
   monospace gives the lines air to breathe (real typewriter copy lives at
   ~1.8). Letter-spacing kept neutral — Courier Prime's metrics already
   read as machine-spaced; pushing further makes it look stretched. The
   class is applied to BOTH the textarea and the mirror so wrap behavior
   stays identical. */
.zen-body {
  line-height: 1.85;
  letter-spacing: 0.005em;
}

/* ============================================================
 * Paper feel — bumped up.
 *
 * Two layered effects on .zen-editor::before give the writing surface
 * tactile depth without touching the writing area itself:
 *
 *   1. A fine SVG noise layer simulating paper fiber. Inline data-uri
 *      so no asset request, ~1.5KB. At ~6% opacity it's barely
 *      perceptible up close but reads instantly as "paper, not screen".
 *
 *   2. A stronger radial vignette than before — corners darkened to
 *      ~9% ink so the page feels like an actual sheet with edges,
 *      not an infinite plain.
 *
 * Both skipped in dark mode where .page-canvas's moving charcoal
 * gradient handles atmosphere.
 * ============================================================ */
.zen-editor::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-color: transparent;
  background-image:
    /* Vignette */
    radial-gradient(
      ellipse at center,
      transparent 0%,
      transparent 45%,
      rgb(var(--color-ink) / 0.09) 100%
    ),
    /* Paper grain */
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-size: cover, 240px 240px;
  background-repeat: no-repeat, repeat;
}
:global(.dark) .zen-editor::before {
  display: none;
}

/* ============================================================
 * Typewriter chrome — platen at top, ribbon at bottom.
 *
 * Pure CSS, no images. Subtle dark fixtures that read as a real
 * machine framing the page without dominating the writing area.
 * Both sit BEHIND the floating cluster (z-index 40) but above the
 * paper background.
 * ============================================================ */

/* ----- PLATEN — sits just above the strike line ------
 *
 * The platen and the ribbon together form a compact mechanism around the
 * line being typed. The platen's BOTTOM edge sits ~4px above the cursor
 * position (80vh from top), and the ribbon's TOP edge sits ~36px below
 * the cursor — the gap is one line of body text, so only the active
 * line is framed inside the mechanism. Above the platen: previously-
 * typed paper. Below the ribbon: breathing-room paper.
 *
 * Both pieces are keyed to TYPEWRITER_BOTTOM_PCT = 0.20 in the script.
 * If you change that constant, update the `top` values in both .zen-platen
 * and .zen-ribbon to keep the chrome aligned with the cursor.
 * ---------------------------------------------------------- */
.zen-platen {
  position: fixed;
  /* 80vh − (platen height) − 4px gap above the cursor */
  top: calc(80vh - 48px);
  left: 0;
  right: 0;
  height: 44px;
  z-index: 5;
  pointer-events: none;
  display: flex;
  align-items: stretch;
}

.platen-cylinder {
  flex: 1;
  position: relative;
  background:
    /* Highlight strip near the top — a wet sheen along the platen. */
    linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.05) 0%,
      transparent 30%
    ),
    /* Body of the cylinder — dark with a subtle highlight at upper third
       to fake the cylindrical curve. */
    linear-gradient(
      to bottom,
      rgb(38, 36, 32) 0%,
      rgb(28, 26, 22) 35%,
      rgb(20, 18, 16) 65%,
      rgb(40, 38, 33) 100%
    );
  border-bottom-left-radius: 28px;
  border-bottom-right-radius: 28px;
  box-shadow:
    inset 0 -2px 4px rgba(255, 255, 255, 0.05),
    inset 0 2px 6px rgba(0, 0, 0, 0.4),
    0 6px 14px rgba(0, 0, 0, 0.18);
}

/* The paper edge peeking out from under the cylinder — a thin cream
   line right at the bottom curve, suggesting the sheet emerges here. */
.platen-cylinder::after {
  content: '';
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: -3px;
  height: 6px;
  background-color: rgb(var(--color-paper));
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  z-index: -1;
}

/* End knobs on either side of the cylinder — circular, slightly larger
   than the cylinder's height, with grooves suggesting a turning grip.
   Sized to match the compacted 44px platen. */
.platen-knob {
  position: relative;
  width: 52px;
  flex-shrink: 0;
  background:
    radial-gradient(
      circle at 35% 30%,
      rgb(80, 76, 68) 0%,
      rgb(45, 42, 36) 45%,
      rgb(20, 18, 16) 100%
    );
  border-radius: 50%;
  align-self: center;
  height: 52px;
  /* Stick up slightly above the cylinder so the knob crowns are visible. */
  margin-top: -4px;
  box-shadow:
    inset -2px -2px 4px rgba(0, 0, 0, 0.5),
    inset 2px 2px 4px rgba(255, 255, 255, 0.05),
    0 4px 10px rgba(0, 0, 0, 0.25);
}
.platen-knob-left  { margin-left: -12px; }
.platen-knob-right { margin-right: -12px; }

/* Grooves — concentric ring suggesting the textured grip on a real
   typewriter platen knob. */
.platen-knob-grooves {
  position: absolute;
  inset: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.4);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    inset 0 0 0 8px rgba(0, 0, 0, 0.0),
    inset 0 0 0 9px rgba(0, 0, 0, 0.25);
}

/* ----- RIBBON / RULER — sits just below the strike line ------
 * Pairs with .zen-platen above. The gap between platen-bottom and
 * ribbon-top equals one line of body text, so only the active line
 * being typed is visible inside the mechanism. Below the ribbon: paper
 * extends to viewport bottom as breathing room and as "the page being
 * fed into the machine".
 * ---------------------------------------------------------- */
.zen-ribbon {
  position: fixed;
  left: 0;
  right: 0;
  /* 80vh + line-height gap. ~36px clears one line of text-base/text-lg
     at line-height 1.85 plus a touch of margin on either side. */
  top: calc(80vh + 36px);
  height: 26px;
  z-index: 5;
  pointer-events: none;
  display: flex;
  flex-direction: column;
}

/* The ribbon stripe — a thin band in the accent color along the top
   edge, like an inked typewriter ribbon. Subtle so it doesn't shout. */
.zen-ribbon-stripe {
  height: 4px;
  background:
    linear-gradient(
      to bottom,
      rgb(var(--color-accent) / 0.55) 0%,
      rgb(var(--color-accent) / 0.85) 50%,
      rgb(var(--color-accent) / 0.4) 100%
    );
  box-shadow: 0 0 6px rgb(var(--color-accent) / 0.25);
}

/* The ruler bar — dark strip with evenly-spaced tick marks rendered as a
   repeating linear gradient. The ticks are at every ~20px to suggest the
   measurement scale visible in the reference image. */
.zen-ribbon-ruler {
  flex: 1;
  background:
    /* Tick marks — repeating darker stripe every 20px */
    repeating-linear-gradient(
      to right,
      rgba(0, 0, 0, 0.0) 0px,
      rgba(0, 0, 0, 0.0) 18px,
      rgba(255, 255, 255, 0.12) 18px,
      rgba(255, 255, 255, 0.12) 19px,
      rgba(0, 0, 0, 0.0) 19px,
      rgba(0, 0, 0, 0.0) 20px
    ),
    /* Body */
    linear-gradient(
      to bottom,
      rgb(28, 26, 22) 0%,
      rgb(20, 18, 16) 100%
    );
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

/* ----- Smooth height transitions to mask the auto-resize ----- */
/* The textarea snaps to its new height on auto-resize. A short transition
   reads it as smooth growth instead of a hard step. Honors reduced-motion. */
.zen-body {
  transition: height 80ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .zen-body {
    transition: none;
  }
}

/* ----- Responsive: shrink mechanism on narrow viewports ----- */
@media (max-width: 640px) {
  .zen-platen {
    /* Same strike-line offset, just shorter platen. */
    height: 36px;
    top: calc(80vh - 40px);
  }
  .platen-knob {
    width: 42px;
    height: 42px;
    margin-top: -3px;
  }
  .platen-knob-left  { margin-left: -10px; }
  .platen-knob-right { margin-right: -10px; }
  .zen-ribbon {
    height: 20px;
    /* Slightly tighter line-height at smaller text size. */
    top: calc(80vh + 30px);
  }
}

/* Tiny status pill — bottom-left, fades in/out, stays out of the way. */
.zen-status-pill {
  position: fixed;
  left: 18px;
  bottom: 28px;
  z-index: 30;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  letter-spacing: 0.02em;
  padding: 6px 12px;
  border-radius: 999px;
  background-color: rgb(var(--color-paper));
  border: 1px solid rgb(var(--color-line));
  color: rgb(var(--color-ink-light));
  pointer-events: none;
}
.zen-status-pill.success {
  border-color: rgb(var(--color-accent));
  color: rgb(var(--color-accent));
}
.zen-status-pill.error {
  border-color: rgb(var(--color-highlight));
  color: rgb(var(--color-highlight));
}

.zen-status-enter-active,
.zen-status-leave-active {
  transition: opacity 220ms ease-out, transform 220ms ease-out;
}
.zen-status-enter-from,
.zen-status-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .zen-status-enter-active,
  .zen-status-leave-active {
    transition: none;
  }
  .zen-status-enter-from,
  .zen-status-leave-to {
    transform: none;
  }
}

@media (max-width: 640px) {
  .zen-status-pill {
    left: 10px;
    bottom: 16px;
  }
}
</style>
