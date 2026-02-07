import { ref, computed } from 'vue'

interface ReadingHistoryItem {
  writingId: string
  title: string
  readAt: number
  scrollPosition?: number
  completed: boolean
}

const readingHistory = ref<ReadingHistoryItem[]>([])
const currentReadingId = ref<string | null>(null)
const scrollPositions = ref<Record<string, number>>({})
const recentlyReadIds = ref<Set<string>>(new Set())

export function useReadingStore() {

  // Load from sessionStorage on init
  const loadFromStorage = () => {
    try {
      const stored = sessionStorage.getItem('befly-reading-history')
      if (stored) {
        readingHistory.value = JSON.parse(stored)
        recentlyReadIds.value = new Set(readingHistory.value.map(item => item.writingId))
      }

      const storedPositions = sessionStorage.getItem('befly-scroll-positions')
      if (storedPositions) {
        scrollPositions.value = JSON.parse(storedPositions)
      }
    } catch (error) {
      console.error('Failed to load reading state from storage:', error)
    }
  }

  // Save to sessionStorage
  const saveToStorage = () => {
    try {
      sessionStorage.setItem('befly-reading-history', JSON.stringify(readingHistory.value))
      sessionStorage.setItem('befly-scroll-positions', JSON.stringify(scrollPositions.value))
    } catch (error) {
      console.error('Failed to save reading state to storage:', error)
    }
  }

  // Mark writing as read
  const markAsRead = (writingId: string, title: string, completed: boolean = false) => {
    const existingIndex = readingHistory.value.findIndex(item => item.writingId === writingId)
    
    const readingItem: ReadingHistoryItem = {
      writingId,
      title,
      readAt: Date.now(),
      completed,
    }

    if (existingIndex >= 0) {
      readingHistory.value[existingIndex] = readingItem
    } else {
      readingHistory.value.unshift(readingItem)
    }

    recentlyReadIds.value.add(writingId)
    
    // Keep only last 50 items
    if (readingHistory.value.length > 50) {
      readingHistory.value = readingHistory.value.slice(0, 50)
    }

    saveToStorage()
  }

  // Save scroll position
  const saveScrollPosition = (writingId: string, position: number) => {
    scrollPositions.value[writingId] = position
    saveToStorage()
  }

  // Get scroll position
  const getScrollPosition = (writingId: string): number | undefined => {
    return scrollPositions.value[writingId]
  }

  // Check if writing was recently read
  const isRecentlyRead = (writingId: string): boolean => {
    return recentlyReadIds.value.has(writingId)
  }

  // Set current reading
  const setCurrentReading = (writingId: string | null) => {
    currentReadingId.value = writingId
  }

  // Initialize on first use
  if (readingHistory.value.length === 0) {
    loadFromStorage()
  }

  return {
    readingHistory: computed(() => readingHistory.value),
    currentReadingId: computed(() => currentReadingId.value),
    scrollPositions: computed(() => scrollPositions.value),
    recentlyReadIds: computed(() => recentlyReadIds.value),
    markAsRead,
    saveScrollPosition,
    getScrollPosition,
    isRecentlyRead,
    setCurrentReading,
  }
}
