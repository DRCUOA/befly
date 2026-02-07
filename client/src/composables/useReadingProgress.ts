import { ref, onMounted, onUnmounted } from 'vue'

// Throttle function to limit scroll handler calls
function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let lastRun = 0
  return function(this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastRun >= limit) {
      func.apply(this, args)
      lastRun = now
    }
  }
}

export function useReadingProgress() {
  const scrollPosition = ref(0)
  const scrollPercent = ref(0)
  const isNearEnd = ref(false)
  const readingTime = ref(0)
  const startTime = ref<number | null>(null)

  let scrollTimeout: number | null = null

  const calculateProgress = () => {
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    
    // Only update if scroll position actually changed significantly (avoid micro-updates)
    const positionDiff = Math.abs(scrollPosition.value - scrollTop)
    if (positionDiff < 1 && scrollPosition.value > 0) {
      return // Skip if change is less than 1px
    }
    
    scrollPosition.value = scrollTop
    
    if (documentHeight > windowHeight) {
      const totalScrollable = documentHeight - windowHeight
      const newPercent = Math.min(100, Math.max(0, (scrollTop / totalScrollable) * 100))
      
      // Only update if percent changed significantly
      if (Math.abs(scrollPercent.value - newPercent) > 0.1) {
        scrollPercent.value = newPercent
      }
    } else {
      scrollPercent.value = 100
    }

    // Check if near end (95% threshold) - only update if state changes
    const newIsNearEnd = scrollPercent.value >= 95
    if (isNearEnd.value !== newIsNearEnd) {
      isNearEnd.value = newIsNearEnd
    }
  }

  const handleScroll = throttle(() => {
    // Use requestAnimationFrame for smooth updates
    if (scrollTimeout !== null) {
      cancelAnimationFrame(scrollTimeout)
    }
    
    scrollTimeout = requestAnimationFrame(() => {
      calculateProgress()
      
      // Start tracking reading time on first scroll
      if (startTime.value === null) {
        startTime.value = Date.now()
      }
      
      // Update reading time less frequently (every 5 seconds)
      if (startTime.value) {
        const elapsed = Math.floor((Date.now() - startTime.value) / 1000)
        if (elapsed !== readingTime.value) {
          readingTime.value = elapsed
        }
      }
    })
  }, 16) // ~60fps throttle

  const resetProgress = () => {
    scrollPosition.value = 0
    scrollPercent.value = 0
    isNearEnd.value = false
    readingTime.value = 0
    startTime.value = Date.now()
  }

  onMounted(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    calculateProgress()
    startTime.value = Date.now()
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
    if (scrollTimeout !== null) {
      cancelAnimationFrame(scrollTimeout)
      scrollTimeout = null
    }
  })

  return {
    scrollPosition,
    scrollPercent,
    isNearEnd,
    readingTime,
    calculateProgress,
    resetProgress,
  }
}
