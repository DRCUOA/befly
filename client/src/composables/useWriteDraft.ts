import { ref, watch, onUnmounted } from 'vue'

/**
 * Draft data structure stored in localStorage
 */
interface DraftData {
  title: string
  body: string
  themeIds: string[]
  visibility: 'private' | 'shared' | 'public'
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
export function useWriteDraft(writingId: string | undefined, formData: {
  title: string
  body: string
  themeIds: string[]
  visibility: 'private' | 'shared' | 'public'
}) {
  const lastSaved = ref<Date | null>(null)
  const hasDraft = ref(false)
  const autosaveEnabled = ref(false)

  // Generate storage key based on writingId or 'new'
  const getStorageKey = () => {
    return `befly-draft-${writingId || 'new'}`
  }

  /**
   * Save draft to localStorage
   */
  const saveDraft = () => {
    try {
      const draft: DraftData = {
        title: formData.title,
        body: formData.body,
        themeIds: formData.themeIds,
        visibility: formData.visibility,
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

  // Debounced save function (30 seconds default)
  const debouncedSave = debounce(saveDraft, 30000)

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

    // Watch for changes to form data and trigger debounced save
    const stopWatchTitle = watch(() => formData.title, () => {
      if (autosaveEnabled.value) {
        debouncedSave()
      }
    })

    const stopWatchBody = watch(() => formData.body, () => {
      if (autosaveEnabled.value) {
        debouncedSave()
      }
    })

    const stopWatchThemeIds = watch(() => formData.themeIds, () => {
      if (autosaveEnabled.value) {
        debouncedSave()
      }
    }, { deep: true })

    const stopWatchVisibility = watch(() => formData.visibility, () => {
      if (autosaveEnabled.value) {
        debouncedSave()
      }
    })

    // Clean up watchers on unmount
    onUnmounted(() => {
      stopWatchTitle()
      stopWatchBody()
      stopWatchThemeIds()
      stopWatchVisibility()
    })
  }

  /**
   * Disable autosave
   */
  const disableAutosave = () => {
    autosaveEnabled.value = false
  }

  /**
   * Get formatted time string for last saved
   */
  const getFormattedSaveTime = (): string | null => {
    if (!lastSaved.value) return null
    
    const hours = lastSaved.value.getHours().toString().padStart(2, '0')
    const minutes = lastSaved.value.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
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
