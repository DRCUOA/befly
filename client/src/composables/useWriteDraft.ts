import type { Ref } from 'vue'
import { ref, watch, onUnmounted } from 'vue'
import { formatTime } from '../utils/time'

/**
 * Draft data structure stored in localStorage
 */
interface DraftData {
  title: string
  body: string
  themeIds: string[]
  visibility: 'private' | 'shared' | 'public'
  coverImageUrl?: string
  coverImagePosition?: string
  timestamp: number
  writingId?: string
}

/**
 * Debounce function to limit save frequency
 */
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null
  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = window.setTimeout(() => {
      func.apply(this, args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Composable for managing draft autosave and recovery
 * 
 * Usage:
 * const { 
 *   lastSaved, 
 *   hasDraft, 
 *   loadDraft, 
 *   clearDraft, 
 *   enableAutosave 
 * } = useWriteDraft(writingId, form)
 */
export function useWriteDraft(writingId: string | undefined, formDataRef: Ref<{
  title: string
  body: string
  themeIds: string[]
  visibility: 'private' | 'shared' | 'public'
  coverImageUrl?: string
  coverImagePosition?: string
}>) {
  const lastSaved = ref<Date | null>(null)
  const hasDraft = ref(false)
  const autosaveEnabled = ref(false)
  
  // Store watcher stop functions for cleanup
  let stopWatchers: (() => void)[] = []

  // Generate storage key based on writingId or 'new'
  const getStorageKey = () => {
    return `befly-draft-${writingId || 'new'}`
  }

  /**
   * Save draft to localStorage
   */
  const saveDraft = () => {
    try {
      const formData = formDataRef.value
      const draft: DraftData = {
        title: formData.title,
        body: formData.body,
        themeIds: formData.themeIds,
        visibility: formData.visibility,
        coverImageUrl: formData.coverImageUrl,
        coverImagePosition: formData.coverImagePosition,
        timestamp: Date.now(),
        writingId: writingId
      }

      // Only save if there's actual content
      if (!draft.title.trim() && !draft.body.trim()) {
        return
      }

      const key = getStorageKey()
      localStorage.setItem(key, JSON.stringify(draft))
      lastSaved.value = new Date()
      hasDraft.value = true

      console.log('[Draft] Saved:', new Date().toLocaleTimeString())
    } catch (error) {
      console.error('[Draft] Failed to save:', error)
      // Handle quota exceeded or other localStorage errors
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('[Draft] localStorage quota exceeded')
      }
    }
  }

  // Debounced save function (3 seconds for responsive "Draft saved at" feedback)
  const debouncedSave = debounce(saveDraft, 3000)

  /**
   * Load draft from localStorage
   */
  const loadDraft = (): DraftData | null => {
    try {
      const key = getStorageKey()
      const stored = localStorage.getItem(key)
      
      if (!stored) {
        hasDraft.value = false
        return null
      }

      const draft: DraftData = JSON.parse(stored)
      
      // Validate draft structure
      if (!draft.timestamp || typeof draft.title !== 'string' || typeof draft.body !== 'string') {
        console.warn('[Draft] Invalid draft data, clearing')
        clearDraft()
        return null
      }

      hasDraft.value = true
      return draft
    } catch (error) {
      console.error('[Draft] Failed to load:', error)
      return null
    }
  }

  /**
   * Clear draft from localStorage
   */
  const clearDraft = () => {
    try {
      const key = getStorageKey()
      localStorage.removeItem(key)
      lastSaved.value = null
      hasDraft.value = false
      console.log('[Draft] Cleared')
    } catch (error) {
      console.error('[Draft] Failed to clear:', error)
    }
  }

  /**
   * Check if draft exists in localStorage
   */
  const checkDraftExists = (): boolean => {
    try {
      const key = getStorageKey()
      const stored = localStorage.getItem(key)
      hasDraft.value = !!stored
      return hasDraft.value
    } catch (error) {
      console.error('[Draft] Failed to check:', error)
      return false
    }
  }

  /**
   * Enable autosave with watchers
   */
  const enableAutosave = () => {
    if (autosaveEnabled.value) return

    autosaveEnabled.value = true

    // Clean up any existing watchers first
    stopWatchers.forEach(stop => stop())
    stopWatchers = []

    const triggerSave = () => {
      if (!autosaveEnabled.value) return
      const formData = formDataRef.value
      const hasContent = formData.title.trim() || formData.body.trim()
      if (!hasContent) return
      // Immediate save on first content so "Draft saved at" appears quickly
      if (!lastSaved.value) {
        saveDraft()
      } else {
        debouncedSave()
      }
    }

    // Watch for changes to form data and trigger save
    stopWatchers.push(watch(() => formDataRef.value.title, triggerSave))
    stopWatchers.push(watch(() => formDataRef.value.body, triggerSave))
    stopWatchers.push(watch(() => formDataRef.value.themeIds, triggerSave, { deep: true }))
    stopWatchers.push(watch(() => formDataRef.value.visibility, triggerSave))
    stopWatchers.push(watch(() => formDataRef.value.coverImageUrl, triggerSave))
    stopWatchers.push(watch(() => formDataRef.value.coverImagePosition, triggerSave))
  }

  /**
   * Disable autosave
   */
  const disableAutosave = () => {
    autosaveEnabled.value = false
    // Clean up watchers when disabling
    stopWatchers.forEach(stop => stop())
    stopWatchers = []
  }

  // Clean up watchers on component unmount
  onUnmounted(() => {
    stopWatchers.forEach(stop => stop())
    stopWatchers = []
  })

  /**
   * Get formatted time string for last saved
   */
  const getFormattedSaveTime = (): string | null => {
    if (!lastSaved.value) return null
    return formatTime(lastSaved.value)
  }

  return {
    lastSaved,
    hasDraft,
    saveDraft,
    loadDraft,
    clearDraft,
    checkDraftExists,
    enableAutosave,
    disableAutosave,
    getFormattedSaveTime
  }
}
