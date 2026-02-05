import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useReadingProgress } from './useReadingProgress'

export type ReadingStage = 'selection' | 'descent' | 'immersion' | 'completion'

const READING_MODE_THRESHOLD = 800 // pixels
const DEEP_READING_DELAY = 8000 // milliseconds

// Debounce function to limit stage updates
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastCallTime = 0
  
  return function(this: any, ...args: Parameters<T>) {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime
    
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    
    if (timeSinceLastCall >= wait) {
      // If enough time has passed, call immediately
      lastCallTime = now
      func.apply(this, args)
    } else {
      // Otherwise, schedule for later
      timeout = setTimeout(() => {
        lastCallTime = Date.now()
        func.apply(this, args)
        timeout = null
      }, wait - timeSinceLastCall)
    }
  }
}

export function useReadingStage() {
  const currentStage = ref<ReadingStage>('selection')
  const interfaceVisible = ref(true)
  const progressBarVisible = ref(true)
  const progressBarFaded = ref(false)
  const backButtonVisible = ref(true)
  const backButtonFaded = ref(false)
  
  const { scrollPosition, scrollPercent, isNearEnd } = useReadingProgress()
  
  let deepReadingTimeout: ReturnType<typeof setTimeout> | null = null
  let completionTimeout: ReturnType<typeof setTimeout> | null = null
  let lastScrollTop = 0
  let lastStage: ReadingStage = 'selection'

  const updateStage = () => {
    const scrollTop = scrollPosition.value
    
    // Skip update if scroll position hasn't changed significantly
    if (Math.abs(scrollTop - lastScrollTop) < 10 && currentStage.value === lastStage) {
      return
    }
    
    lastScrollTop = scrollTop
    const previousStage = currentStage.value

    // Stage 3: Selection (initial reading with full nav)
    if (scrollTop < READING_MODE_THRESHOLD) {
      if (previousStage !== 'selection') {
        currentStage.value = 'selection'
        interfaceVisible.value = true
        progressBarVisible.value = true
        progressBarFaded.value = false
        backButtonVisible.value = true
        backButtonFaded.value = false
        
        if (deepReadingTimeout) {
          clearTimeout(deepReadingTimeout)
          deepReadingTimeout = null
        }
        lastStage = 'selection'
      }
    }
    // Stage 4: Descent (interface begins to fade)
    else if (scrollTop >= READING_MODE_THRESHOLD && previousStage !== 'immersion' && previousStage !== 'completion') {
      if (previousStage !== 'descent') {
        currentStage.value = 'descent'
        interfaceVisible.value = false
        progressBarFaded.value = true
        backButtonFaded.value = true
        lastStage = 'descent'
      }
      
      // Transition to immersion after delay
      if (!deepReadingTimeout && previousStage !== 'immersion') {
        deepReadingTimeout = setTimeout(() => {
          if (scrollPosition.value >= READING_MODE_THRESHOLD && currentStage.value === 'descent') {
            currentStage.value = 'immersion'
            progressBarVisible.value = false
            backButtonVisible.value = false
            lastStage = 'immersion'
          }
        }, DEEP_READING_DELAY)
      }
    }
    
    // Stage 6: Completion (near end) - only update if not already completion
    if (isNearEnd.value && previousStage !== 'completion') {
      currentStage.value = 'completion'
      lastStage = 'completion'
    }
  }

  // Debounce stage updates to prevent excessive re-renders
  const debouncedUpdateStage = debounce(updateStage, 200)

  // Watch scroll position with debouncing
  // Use immediate update for critical thresholds, debounced for others
  watch(scrollPosition, (newPosition) => {
    const previousStage = currentStage.value
    
    // Immediate update for critical transitions (crossing threshold)
    if (
      (previousStage === 'selection' && newPosition >= READING_MODE_THRESHOLD) ||
      (previousStage !== 'selection' && newPosition < READING_MODE_THRESHOLD)
    ) {
      updateStage()
    } else {
      // Debounced update for other changes
      debouncedUpdateStage()
    }
  }, { flush: 'post' })

  // Watch isNearEnd separately (less frequent updates) - debounced
  watch(isNearEnd, (nearEnd) => {
    if (completionTimeout) {
      clearTimeout(completionTimeout)
    }
    
    if (nearEnd && currentStage.value !== 'completion') {
      // Small delay to prevent rapid toggling
      completionTimeout = setTimeout(() => {
        if (isNearEnd.value && currentStage.value !== 'completion') {
          currentStage.value = 'completion'
          lastStage = 'completion'
        }
      }, 300)
    }
  })

  const resetStage = () => {
    if (currentStage.value !== 'selection') {
      currentStage.value = 'selection'
      interfaceVisible.value = true
      progressBarVisible.value = true
      progressBarFaded.value = false
      backButtonVisible.value = true
      backButtonFaded.value = false
      lastScrollTop = 0
      lastStage = 'selection'
    }
    
    if (deepReadingTimeout) {
      clearTimeout(deepReadingTimeout)
      deepReadingTimeout = null
    }
  }

  onMounted(() => {
    updateStage()
  })

  onUnmounted(() => {
    if (deepReadingTimeout) {
      clearTimeout(deepReadingTimeout)
    }
    if (completionTimeout) {
      clearTimeout(completionTimeout)
    }
  })

  return {
    currentStage,
    interfaceVisible,
    progressBarVisible,
    progressBarFaded,
    backButtonVisible,
    backButtonFaded,
    scrollPercent,
    isNearEnd,
    scrollPosition,
    resetStage,
  }
}
