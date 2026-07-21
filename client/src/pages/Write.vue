<template>
  <div class="write-page w-full" :class="{ 'panel-open': assistOpen || metadataPanelOpen }">
    <!-- Simple authoring surface: title + body, nothing else. The page
         scrolls naturally; all controls live in the bottom toolbar. -->
    <form @submit.prevent="handleSubmit" class="flex flex-col w-full">
      <!-- Title — same face as the body, slightly larger, faint rule
           underneath so it reads as part of the sheet, not a UI label. -->
      <div class="write-title-area w-full max-w-[72ch] mx-auto px-4 sm:px-6 md:px-8 pt-6 sm:pt-10">
        <input
          id="title"
          ref="titleInputRef"
          v-model="form.title"
          type="text"
          required
          class="block w-full border-0 bg-transparent font-typewriter text-2xl sm:text-3xl font-bold text-ink placeholder:text-ink-whisper focus:ring-0 focus:outline-none py-1"
          placeholder="Title"
          aria-label="Title"
        />
      </div>

      <!-- Standalone-HTML banner — appears the moment the writer pastes a
           full HTML document into the body. Tells them what's about to
           happen and offers a Preview toggle that swaps the textarea for a
           sandboxed iframe of the current value. While preview is on, the
           textarea is hidden but the underlying value is unchanged. -->
      <div
        v-if="isSpaBody"
        class="w-full max-w-[72ch] mx-auto px-4 sm:px-6 md:px-8 pt-3"
      >
        <div class="spa-banner-pill">
          <span class="spa-banner-dot" aria-hidden="true"></span>
          <span class="spa-banner-text">
            Interactive HTML detected — this frag will render as a sandboxed SPA when published.
          </span>
          <button
            type="button"
            class="spa-banner-toggle"
            @click="spaPreviewOpen = !spaPreviewOpen"
          >
            {{ spaPreviewOpen ? 'Edit source' : 'Preview' }}
          </button>
        </div>
      </div>

      <!-- Body — an auto-growing textarea; the page itself is the scroll
           surface. Bottom padding keeps the last lines clear of the fixed
           toolbar. Width matches the title so both read as one sheet. -->
      <div class="relative w-full max-w-[72ch] mx-auto px-4 sm:px-6 md:px-8 pb-36 sm:pb-32">
        <textarea
          id="body"
          ref="bodyTextareaRef"
          v-show="!isSpaBody || !spaPreviewOpen"
          v-model="form.body"
          required
          class="write-body block w-full min-h-[50vh] border-0 bg-transparent font-typewriter text-base sm:text-lg text-ink placeholder:text-ink-whisper focus:ring-0 focus:outline-none resize-none overflow-hidden py-2"
          :style="bodyFontStyle"
          placeholder="Start writing…"
          aria-label="Body"
        />

        <!-- Live SPA preview — sandboxed iframe of the current body value.
             Sandbox flags match the reader. We re-key by an incrementing id
             so big edits force a fresh document load (otherwise srcdoc
             updates can leave stale CDN-script side effects in the iframe). -->
        <iframe
          v-if="isSpaBody && spaPreviewOpen"
          :key="spaPreviewKey"
          :srcdoc="form.body"
          title="SPA preview"
          class="spa-preview"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer"
          loading="eager"
        />
        <!-- Mirror div: an invisible copy of the textarea content used to
             measure content height for flash-free auto-resize.
             CRITICAL: must wrap text at the SAME column as the textarea.
             Width is set via matching horizontal padding (parent has px-*;
             mirror copies it). Font, size, vertical padding and line-height
             must also match the textarea exactly. -->
        <div
          ref="bodyMirrorRef"
          class="write-body absolute top-0 left-0 right-0 w-full invisible font-typewriter text-base sm:text-lg px-4 sm:px-6 md:px-8 py-2 whitespace-pre-wrap break-words pointer-events-none"
          :style="bodyFontStyle"
          aria-hidden="true"
        ></div>
      </div>
    </form>

    <!-- Metadata panel (cover, themes, visibility) — sits alongside the
         editor when open (no modal backdrop), thanks to the panel-open
         class on .write-page that adds right-padding to the writing area. -->
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

    <!-- Collaboration panels. Only meaningful for existing frags. Server
         enforces who's allowed to manage editors or restore history; we
         deliberately don't gate the buttons by role so admin/manager
         editors can also reach them without an extra round-trip. -->
    <EditorsPanel
      v-if="isEditing && writingId"
      v-model="editorsPanelOpen"
      :writing-id="writingId"
    />
    <RevisionHistoryPanel
      v-if="isEditing && writingId"
      v-model="historyPanelOpen"
      :writing-id="writingId"
      :can-restore="true"
      @restored="loadWriting"
    />

    <div
      v-if="isEditing"
      class="fixed top-4 right-4 z-30 flex gap-2 print:hidden"
    >
      <button
        type="button"
        class="px-2 py-1 text-xs rounded border border-line bg-paper text-ink hover:bg-line"
        @click="editorsPanelOpen = true"
      >Editors</button>
      <button
        type="button"
        class="px-2 py-1 text-xs rounded border border-line bg-paper text-ink hover:bg-line"
        @click="historyPanelOpen = true"
      >History</button>
    </div>

    <!-- Bottom toolbar — page actions plus a consolidated AI menu. This is
         the ONLY persistent UI on the editor surface. -->
    <WritingToolsCluster
      :has-selection="hasLiveSelection"
      :active-mode="assistOpen ? assistMode : null"
      :is-editing="isEditing"
      :save-busy="submitting"
      :save-disabled="loadingWriting || !canSave"
      :metadata-open="metadataPanelOpen"
      :model="selectedModel"
      :find-open="findOpen"
      @select="openAssist"
      @save="handleSubmit"
      @metadata="metadataPanelOpen = true"
      @exit="handleExit"
      @find="findOpen = !findOpen"
      @font-up="bumpFontSize(+1)"
      @font-down="bumpFontSize(-1)"
      @update:model="onModelChange"
    />

    <FindReplacePanel
      :open="findOpen"
      :body="form.body"
      :writing-block-id="writingId"
      :textarea-ref="bodyTextareaRef"
      @close="findOpen = false"
      @update:body="onBodyReplaced"
      @status="onFindStatus"
    />

    <!-- Tiny status pill — only visible briefly after save success or while
         showing an error. Sits above the toolbar so neither covers the other. -->
    <Transition name="status-pill">
      <div
        v-if="statusPill"
        class="status-pill"
        :class="statusPill.kind"
        role="status"
        aria-live="polite"
      >
        {{ statusPill.message }}
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
import { formatTime } from '../utils/time'
import {
  scanTypography,
  type TypographySuggestion
} from '../utils/typography-suggestions'
import { useTypographyRules } from '../composables/useTypographyRules'
import MetadataPanel from '../components/writing/MetadataPanel.vue'
import CoverImageCropModal from '../components/writing/CoverImageCropModal.vue'
import WritingToolsCluster from '../components/writing/WritingToolsCluster.vue'
import WritingAssistPanel from '../components/writing/WritingAssistPanel.vue'
import FindReplacePanel from '../components/writing/FindReplacePanel.vue'
import EditorsPanel from '../components/writing/EditorsPanel.vue'
import RevisionHistoryPanel from '../components/writing/RevisionHistoryPanel.vue'
import { ApiError } from '../api/client'
import { useWritingAssist } from '../composables/useWritingAssist'
import type { WritingAssistMode } from '@shared/WritingAssist'
import { isStandaloneHtmlDoc } from '../utils/markdown'
import { useNavigationOrigin } from '../stores/navigation'

const route = useRoute()

// `origin` is tracked by the store but Write.vue only needs the navigateBack
// closure here; the origin is read by other consumers via the store.
const { navigateBack } = useNavigationOrigin('/home')

const writingId = computed(() => route.params.id as string | undefined)
const isEditing = computed(() => !!writingId.value)

// Optimistic-lock version of the loaded frag. We refresh this on load and
// on every successful save; the server bumps it on its side, so any other
// editor's save between our load and our save will trigger a 409 which
// we surface as a "merge" prompt rather than silently overwriting.
const currentVersion = ref<number | null>(null)

// Collaboration panels. We show the buttons unconditionally on existing
// frags; the server enforces who's actually allowed to manage editors or
// restore revisions, so unauthorized users just see a friendly error.
const editorsPanelOpen = ref(false)
const historyPanelOpen = ref(false)

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
const findOpen = ref(false)

// Non-blocking typography suggestions (P1-uix-03: progressive reveal on pause/blur)
// Rules from API with fallback to bundled defaults (cni-07)
const { rules: typographyRules } = useTypographyRules()
const titleInputRef = ref<HTMLInputElement | null>(null)
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null)
const bodyMirrorRef = ref<HTMLDivElement | null>(null)
const typographySuggestions = ref<TypographySuggestion[]>([])
const dismissedSuggestionKeys = ref(new Set<string>())

let scanTimer: ReturnType<typeof setTimeout> | null = null
const SCAN_DEBOUNCE_MS = 1500

function suggestionKey(s: TypographySuggestion): string {
  return `${s.ruleId}:${s.original}`
}

/* ============================================================
 * Standalone-HTML SPA mode
 *
 * If the body is a complete HTML document (DOCTYPE / <html>) we treat the
 * essay as an interactive SPA: the reader will render it inside a sandboxed
 * iframe, so typography suggestions don't apply (they'd flag attribute
 * quotes, ampersands, etc.) and the editor offers a Preview toggle that
 * swaps the textarea for a live sandboxed iframe of the current value.
 * ============================================================ */
const isSpaBody = computed(() => isStandaloneHtmlDoc(form.value.body))
const spaPreviewOpen = ref(false)
// Bumped after a debounce so the iframe re-mounts on substantive edits —
// without this, srcdoc updates accumulate inside the same document context
// and CDN scripts can keep stale side effects from the previous render.
const spaPreviewKey = ref(0)
let spaReloadTimer: ReturnType<typeof setTimeout> | null = null

watch(() => form.value.body, () => {
  if (!spaPreviewOpen.value) return
  if (spaReloadTimer) clearTimeout(spaReloadTimer)
  spaReloadTimer = setTimeout(() => { spaPreviewKey.value++ }, 500)
})

// Closing the editor — clean up the debounce so it doesn't fire post-unmount.
onBeforeUnmount(() => { if (spaReloadTimer) clearTimeout(spaReloadTimer) })

function refreshSuggestions() {
  // Skip the typography scan for SPA bodies — the rules target prose, and
  // running them on raw HTML produces noisy, unhelpful suggestions on
  // attribute quotes, entity ampersands, etc.
  if (isSpaBody.value) {
    typographySuggestions.value = []
    return
  }
  const all = scanTypography(form.value.body, typographyRules.value)
  typographySuggestions.value = all.filter(
    s => !dismissedSuggestionKeys.value.has(suggestionKey(s))
  )
}

watch(() => form.value.body, () => {
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(refreshSuggestions, SCAN_DEBOUNCE_MS)
})

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
    currentVersion.value = (response.data as WritingBlock & { currentVersion?: number }).currentVersion ?? null
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
      const res = await api.put<ApiResponse<WritingBlock>>(`/writing/${writingId.value}`, {
        title: form.value.title,
        body: form.value.body,
        themeIds: form.value.themeIds,
        visibility: form.value.visibility,
        coverImageUrl: form.value.coverImageUrl || undefined,
        coverImagePosition: form.value.coverImagePosition || undefined,
        expectedVersion: currentVersion.value ?? undefined,
      })
      currentVersion.value = (res.data as WritingBlock & { currentVersion?: number })?.currentVersion ?? currentVersion.value
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
    flashStatus('success', isEditing.value ? 'Updated' : 'Published', 1200)
    navigateBack()
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const reload = confirm(
        'Another editor has updated this frag since you loaded it. ' +
        'Reload their changes? (Your current edits will be discarded — ' +
        'cancel to keep them and copy them out manually.)'
      )
      if (reload) await loadWriting()
      flashStatus('error', 'Save blocked: frag was updated by another editor', 4000)
      return
    }
    const msg = err instanceof Error ? err.message : (isEditing.value ? 'Failed to update writing' : 'Failed to publish writing')
    error.value = msg
    flashStatus('error', msg, 4000)
  } finally {
    submitting.value = false
  }
}

const handleSubmit = async () => {
  if (!form.value.title.trim() || !form.value.body.trim()) {
    const msg = 'Title and body are required'
    error.value = msg
    flashStatus('error', msg, 2400)
    return
  }

  await doSubmit()
}

// Typography-suggestion handlers (accept / dismiss / accept-all / dismiss-all,
// plus the textarea-aware applySuggestionViaTextarea helper) used to live
// here. They were removed when the suggestions UI was unwired from the
// template; the underlying scan still runs and populates
// `typographySuggestions` but no surface consumes it right now. If/when the
// UI returns, restore those handlers (and re-import `applySuggestion` /
// `applySuggestions` from utils/typography-suggestions) — the data plumbing
// is already in place.

/* ============================================================
 * Writing assist — coherence Q&A, define, focus, expand, proofread.
 *
 * The toolbar's AI menu picks the mode; the slide-out panel runs the AI
 * request and emits insert/replace back into the textarea. Selection
 * tracking is the only intrusive bit — it's read-only and listens to
 * document selectionchange, so it adds no new event surface.
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
// Live "is there currently a selection" flag for the toolbar's disabled
// state. Updated on selectionchange — cheap, no debounce needed.
const hasLiveSelection = ref(false)

// NOTE on destructuring: Vue auto-unwraps refs/computeds in templates ONLY
// when they're bound as top-level identifiers. Reaching them via
// `writingAssist.isLoading` keeps the underlying ComputedRef wrapped, which
// causes "Expected Boolean, got Object" prop warnings on the panel. So we
// destructure into top-level locals.
/* ============================================================
 * Selected OpenAI model — the writer picks from the AI menu's model
 * section. Default 'gpt-4o-mini' (cheapest, matches the server's prior
 * default). Persisted to localStorage so the choice survives page
 * reloads. The server validates against an allow-list before honouring it.
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
  // Develop quadrant — four sister wrappers, dispatched from the AI
  // menu's Develop section. Same arg shape as runExpand.
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
 * Page actions — Save / Metadata / Exit live in the toolbar.
 * ============================================================ */

/** Disable Save when there's no title or body — prevents empty submissions
 *  the user wouldn't want, and makes the save icon look quietly inert until
 *  there's something to commit. */
const canSave = computed(() =>
  form.value.title.trim().length > 0 && form.value.body.trim().length > 0
)

/** Lightweight status pill — save receipts, autosave notes, errors.
 *  Stays minimal, fades after a short timeout. */
const statusPill = ref<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null)
let statusPillTimer: ReturnType<typeof setTimeout> | null = null

/* ============================================================
 * Body font size — controlled by the text-size control in the toolbar.
 * Default is null, meaning "use the CSS default" (text-base sm:text-lg).
 * Once the writer adjusts, we apply a pixel-explicit font-size on both
 * the textarea AND the mirror via :style binding. They MUST stay in
 * sync or line wrapping will diverge and auto-resize breaks.
 * ============================================================ */

const FONT_SIZE_MIN = 12
const FONT_SIZE_MAX = 28
const FONT_SIZE_STEP = 2

const bodyFontSize = ref<number | null>(null) // null = use CSS default

/** Style object applied to both textarea and mirror. Returns an empty
 *  object when no override is in play (CSS class governs). The
 *  `fontSize` key is optional so `{}` is a clean member of the type;
 *  using `Record<string, string>` here trips strict TS because the
 *  empty-object branch isn't assignable to a fully-required mapping. */
const bodyFontStyle = computed<{ fontSize?: string }>(() =>
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
  nextTick(autoResizeBody)
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
    flashStatus('info', 'Autosaved', 1200)
  } catch (err) {
    // Stay quiet on autosave failures — the writer didn't ask for this
    // to happen, so a brief notice is enough; they can manually Save
    // (toolbar Save button) if they want a guaranteed write.
    const msg = err instanceof Error ? err.message : 'Autosave failed'
    flashStatus('error', `Autosave failed: ${msg}`, 3000)
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

function flashStatus(kind: 'success' | 'error' | 'info', message: string, ms: number = 2400) {
  statusPill.value = { kind, message }
  if (statusPillTimer) clearTimeout(statusPillTimer)
  statusPillTimer = setTimeout(() => { statusPill.value = null }, ms)
}

/** Exit icon — go back to wherever the writer came from, persisting any
 *  unsaved draft via the existing useWriteDraft hook (the route-leave guard
 *  handles that). */
function handleExit() {
  navigateBack()
}

/** The Find & Replace panel emits `update:body` after an in-essay replace.
 *  The body watcher picks it up like any other edit — autosave, draft and
 *  auto-resize all run from there. */
function onBodyReplaced(next: string) {
  form.value.body = next
}

/** The Find & Replace panel emits status messages (match counts, errors,
 *  replace receipts). Surface them through the same status pill that
 *  save/error states use, so we don't introduce a second toast system. */
function onFindStatus(status: { kind: 'info' | 'success' | 'error'; message: string }) {
  flashStatus(status.kind, status.message, status.kind === 'error' ? 4000 : 2600)
}

/* ============================================================
 * Auto-resize the body textarea so its height always matches its content.
 *
 * Without this, the textarea's min-h-[Xvh] caps it at a fixed height and
 * any content past that scrolls INSIDE the textarea — a miserable mobile
 * experience. Snapping height to content height makes the textarea grow
 * with the text so the page itself is the scrollable surface.
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
// through the DOM before we measure.
watch(() => form.value.body, () => nextTick(autoResizeBody))

function onSelectionMaybeChanged() {
  const ta = bodyTextareaRef.value
  if (!ta || document.activeElement !== ta) {
    // Don't flip on/off when the user moves focus to the panel — keep the
    // last known selection state instead, so the toolbar doesn't disable
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
function onDocumentSelectionChange() {
  onSelectionMaybeChanged()
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

  // Add beforeunload event listener
  window.addEventListener('beforeunload', handleBeforeUnload)
  // selectionchange tells the toolbar whether to enable selection-only
  // tools like Focus. It fires from both keyboard and mouse.
  document.addEventListener('selectionchange', onDocumentSelectionChange)
})

onBeforeUnmount(() => {
  if (scanTimer) clearTimeout(scanTimer)
  if (statusPillTimer) clearTimeout(statusPillTimer)
  if (autosaveTimer) clearTimeout(autosaveTimer)
  draft.disableAutosave()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  document.removeEventListener('selectionchange', onDocumentSelectionChange)
})

</script>

<style scoped>
/* Side-by-side panel layout — when AssistPanel or MetadataPanel is open,
   the editor reserves a right-side gutter the width of the panel. The
   title + body have max-width + mx-auto, so this gutter shifts the
   centered content leftward without breaking line-length. */
.write-page.panel-open {
  padding-right: 420px;
  transition: padding-right 240ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
.write-page {
  transition: padding-right 240ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
@media (prefers-reduced-motion: reduce) {
  .write-page,
  .write-page.panel-open {
    transition: none;
  }
}
@media (max-width: 768px) {
  /* On narrow viewports, panel takes full width; no point shifting the
     editor — it'd just be hidden anyway. */
  .write-page.panel-open {
    padding-right: 0;
  }
}

/* Title — faint rule beneath so it reads as a heading on the sheet,
   not a form field. */
.write-title-area input {
  letter-spacing: 0.01em;
  border-bottom: 1px solid rgb(var(--color-line));
  padding-bottom: 6px;
  margin-bottom: 8px;
}

/* Body — comfortable long-form line-height. The class is applied to BOTH
   the textarea and the mirror so wrap behavior stays identical. */
.write-body {
  line-height: 1.85;
  letter-spacing: 0.005em;
}

/* ============================================================
 * Standalone-HTML SPA UI
 *
 * Banner + preview iframe styles. The banner is a thin pill that sits
 * just under the title, low-contrast so it doesn't shout. The preview
 * iframe replaces the textarea visually but the textarea remains in the
 * DOM (just v-show'd off) so all the keyboard / draft state is intact.
 * ============================================================ */
.spa-banner-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-line));
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  letter-spacing: 0.01em;
  color: rgb(var(--color-ink-light));
  max-width: 100%;
}
.spa-banner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgb(var(--color-accent));
  flex-shrink: 0;
}
.spa-banner-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.spa-banner-toggle {
  flex-shrink: 0;
  margin-left: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgb(var(--color-line));
  background: transparent;
  color: rgb(var(--color-ink));
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 120ms ease-out, color 120ms ease-out;
}
.spa-banner-toggle:hover {
  background: rgb(var(--color-accent));
  color: rgb(var(--color-paper));
  border-color: rgb(var(--color-accent));
}
@media (max-width: 640px) {
  .spa-banner-text {
    white-space: normal;
  }
}

.spa-preview {
  display: block;
  width: 100%;
  height: 80vh;
  min-height: 480px;
  margin-top: 8px;
  border: 1px solid rgb(var(--color-line));
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 18px rgba(0, 0, 0, 0.06);
}

/* Tiny status pill — bottom-left, above the toolbar, fades in/out. */
.status-pill {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  z-index: 45;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  letter-spacing: 0.02em;
  padding: 6px 12px;
  border-radius: 999px;
  background-color: rgb(var(--color-paper));
  border: 1px solid rgb(var(--color-line));
  color: rgb(var(--color-ink-light));
  pointer-events: none;
  box-shadow: 0 2px 8px rgb(var(--color-ink) / 0.08);
}
.status-pill.success {
  border-color: rgb(var(--color-accent));
  color: rgb(var(--color-accent));
}
.status-pill.error {
  border-color: rgb(var(--color-highlight));
  color: rgb(var(--color-highlight));
}

.status-pill-enter-active,
.status-pill-leave-active {
  transition: opacity 220ms ease-out, transform 220ms ease-out;
}
.status-pill-enter-from,
.status-pill-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .status-pill-enter-active,
  .status-pill-leave-active {
    transition: none;
  }
  .status-pill-enter-from,
  .status-pill-leave-to {
    transform: translateX(-50%);
  }
}
</style>
