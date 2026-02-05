<template>
  <ReadingLayout
    :progress="scrollPercent"
    :progress-bar-visible="progressBarVisible"
    :progress-bar-faded="progressBarFaded"
    :interface-visible="interfaceVisible"
    :back-button-visible="backButtonVisible"
    :back-button-faded="backButtonFaded"
    back-route="/home"
    back-label="Back to essays"
  >
    <div v-if="loading" class="text-center py-32">
      <p class="text-lg font-light text-ink-light">Loading...</p>
    </div>
    
    <div v-else-if="error" class="max-w-4xl mx-auto px-8 py-16">
      <div class="bg-red-50 border border-red-200 rounded-md p-8 mb-6">
        <p class="text-red-800 mb-4">{{ error }}</p>
        <router-link
          to="/home"
          class="text-sm text-ink hover:text-ink-light transition-colors duration-500"
        >
          ← Back to Essays
        </router-link>
      </div>
    </div>
    
    <div v-else-if="writing">
      <!-- Stage 3-5: Reading Content -->
      <div v-if="currentStage !== 'completion'" class="reading-content-wrapper">
        <!-- Essay Header -->
        <div
          class="w-full px-8 pt-16 pb-12 bg-paper"
          :class="{ 'opacity-0': currentStage === 'immersion' }"
          style="transition: opacity 2s cubic-bezier(0.4, 0, 0.2, 1)"
        >
          <div class="max-w-4xl mx-auto">
            <div class="mb-8 animate-fade-in delay-200">
              <div class="flex items-center gap-3 flex-wrap mb-4">
                <ThemeTag
                  v-for="theme in themes"
                  :key="theme.id"
                  :name="theme.name"
                  class="text-xs tracking-widest uppercase font-sans text-ink-lighter"
                />
                <span class="text-xs text-ink-lighter mx-3">·</span>
                <span class="text-xs font-sans text-ink-lighter">{{ formattedDate }}</span>
              </div>
            </div>
            
            <h1
              class="text-6xl font-light tracking-tight leading-tight mb-12 animate-fade-in delay-300"
            >
              {{ writing.title }}
            </h1>
            
            <div
              class="flex items-center gap-8 text-sm font-sans text-ink-lighter mb-16 animate-fade-in delay-400"
            >
              <span>{{ wordCount }} words</span>
              <span>·</span>
              <span>{{ readTime }} min read</span>
              <span>·</span>
              <span>Published {{ formattedDate }}</span>
            </div>
            
            <div
              class="border-t border-line pt-8 animate-fade-in delay-500"
            >
              <p class="text-xl font-light text-ink-light leading-relaxed italic">
                {{ excerpt }}
              </p>
            </div>
          </div>
        </div>

        <!-- Essay Content -->
        <div
          class="w-full px-8 py-16 bg-paper"
          :class="{
            'reading-mode': currentStage === 'immersion',
            'descent-mode': currentStage === 'descent'
          }"
        >
          <div
            class="max-w-3xl mx-auto essay-content"
            :class="{
              'text-2xl leading-loose': currentStage === 'immersion',
              'text-xl leading-relaxed': currentStage !== 'immersion'
            }"
          >
            <div
              v-for="(paragraph, index) in paragraphs"
              :key="index"
              class="essay-paragraph mb-10"
              :style="getParagraphStyle(index)"
            >
              <MarkdownRenderer :markdown="paragraph" />
            </div>
          </div>
        </div>

        <!-- Auto-continue button -->
        <AutoContinueButton
          :show="showAutoContinue"
          button-text="Continue Deep Reading"
          @continue="handleContinueToImmersion"
          @hide="showAutoContinue = false"
        />
      </div>

      <!-- Stage 6: Completion Page -->
      <div v-else class="completion-wrapper">
        <CompletionPage
          :final-paragraph="completionText"
          :resurfacing-texts="resurfacingTexts"
          :exit-options="exitOptions"
        />
      </div>
    </div>
  </ReadingLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import { useReadingStore } from '../stores/reading'
import { useReadingStage } from '../composables/useReadingStage'
import ReadingLayout from '../layouts/ReadingLayout.vue'
import AutoContinueButton from '../components/reading/AutoContinueButton.vue'
import CompletionPage from '../components/reading/CompletionPage.vue'
import MarkdownRenderer from '../components/writing/MarkdownRenderer.vue'
import ThemeTag from '../components/writing/ThemeTag.vue'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import type { Appreciation } from '../domain/Appreciation'
import type { ApiResponse } from '@shared/ApiResponses'
import { markdownToText } from '../utils/markdown'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const readingStore = useReadingStore()

const writing = ref<WritingBlock | null>(null)
const themes = ref<Theme[]>([])
const appreciations = ref<Appreciation[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showAutoContinue = ref(false)

const {
  currentStage,
  interfaceVisible,
  progressBarVisible,
  progressBarFaded,
  backButtonVisible,
  backButtonFaded,
  scrollPercent,
  isNearEnd,
} = useReadingStage()

// Split content into paragraphs for progressive reveal
const paragraphs = computed(() => {
  if (!writing.value) return []
  const text = writing.value.body
  // Split by double newlines (paragraph breaks)
  return text.split(/\n\n+/).filter(p => p.trim().length > 0)
})

const wordCount = computed(() => {
  if (!writing.value) return 0
  const text = markdownToText(writing.value.body)
  return text.split(/\s+/).filter(word => word.length > 0).length
})

const readTime = computed(() => {
  // Estimate at 280 words per minute
  return Math.max(1, Math.round(wordCount.value / 280))
})

const excerpt = computed(() => {
  if (!writing.value) return ''
  const text = markdownToText(writing.value.body)
  return text.substring(0, 200) + '...'
})

const formattedDate = computed(() => {
  if (!writing.value) return ''
  const date = new Date(writing.value.createdAt)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const completionText = computed(() => {
  return "And then, without ceremony, without fanfare, without any signal except the natural completion of thought—it ends. The final sentence arrives not as a conclusion but as a resting place, a moment where the rhythm gently comes to stillness. You've been carried this far, and now the current releases you, setting you down softly on the shore."
})

const resurfacingTexts = computed(() => [
  "You sit in the silence that follows. Not an empty silence, but one full of resonance, like the moment after a bell has stopped ringing but the air still vibrates with its tone. The words have ended, but their presence remains, settling into the spaces between your thoughts.",
  "There's no rush to move. No urgent pull toward the next thing. The experience has earned this pause, this moment of integration, this gentle transition from the world of the text back to the world of ordinary time. You're grateful for both: for where you've been, and for the care with which you're being returned.",
  "The afternoon light has changed completely now. Hours have passed, though you couldn't say exactly how many. Time has been transformed, and now it's transforming back, but you're not the same. Something has shifted, subtly but irreversibly. You've spent time in a different quality of consciousness, and traces of it linger.",
])

const exitOptions = computed(() => [
  { type: 'link' as const, label: 'Another piece', route: '/home' },
  { type: 'link' as const, label: 'Return to essays', route: '/home' },
  { type: 'button' as const, label: 'Stay here a moment' },
])

// Paragraph reveal animation - memoized to prevent recalculation
const paragraphStyles = computed(() => {
  const baseDelay = 100
  const isImmersion = currentStage.value === 'immersion'
  
  return paragraphs.value.map((_, index) => {
    const delay = index * baseDelay
    return {
      animation: `paragraphFadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms forwards`,
      opacity: isImmersion ? '0' : '1',
    }
  })
})

const getParagraphStyle = (index: number) => {
  return paragraphStyles.value[index] || { opacity: '1' }
}

// Watch for near-end to show auto-continue - debounced
let autoContinueTimeout: ReturnType<typeof setTimeout> | null = null
watch(isNearEnd, (nearEnd) => {
  if (autoContinueTimeout) {
    clearTimeout(autoContinueTimeout)
  }
  
  autoContinueTimeout = setTimeout(() => {
    if (nearEnd && currentStage.value !== 'immersion' && currentStage.value !== 'completion') {
      showAutoContinue.value = true
    }
  }, 300)
})

// Watch for completion
watch(() => currentStage.value, (stage) => {
  if (stage === 'completion' && writing.value) {
    readingStore.markAsRead(writing.value.id, writing.value.title, true)
  }
})

const handleContinueToImmersion = () => {
  // Scroll to ensure we're past threshold
  window.scrollTo({
    top: 800,
    behavior: 'smooth',
  })
  showAutoContinue.value = false
}

const loadWriting = async () => {
  const id = route.params.id as string
  if (!id) {
    error.value = 'No writing ID provided'
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = null
    
    readingStore.setCurrentReading(id)
    
    const [writingResponse, themesResponse, appreciationsResponse] = await Promise.all([
      api.get<ApiResponse<WritingBlock>>(`/writing/${id}`),
      api.get<ApiResponse<Theme[]>>('/themes'),
      api.get<ApiResponse<Appreciation[]>>(`/appreciations/writing/${id}`)
    ])
    
    writing.value = writingResponse.data
    themes.value = themesResponse.data.filter(t => writing.value!.themeIds.includes(t.id))
    appreciations.value = appreciationsResponse.data
    
    // Mark as read
    readingStore.markAsRead(writing.value.id, writing.value.title, false)
    
    // Restore scroll position if available
    const savedPosition = readingStore.getScrollPosition(id)
    if (savedPosition) {
      setTimeout(() => {
        window.scrollTo({
          top: savedPosition,
          behavior: 'instant',
        })
      }, 100)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load writing'
  } finally {
    loading.value = false
  }
}

// Save scroll position periodically
let scrollSaveInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadWriting()
  
  // Save scroll position every 2 seconds
  scrollSaveInterval = setInterval(() => {
    if (writing.value) {
      readingStore.saveScrollPosition(writing.value.id, window.pageYOffset)
    }
  }, 2000)
})

onUnmounted(() => {
  if (scrollSaveInterval) {
    clearInterval(scrollSaveInterval)
  }
  
  if (autoContinueTimeout) {
    clearTimeout(autoContinueTimeout)
  }
  
  // Final save
  if (writing.value) {
    readingStore.saveScrollPosition(writing.value.id, window.pageYOffset)
  }
  
  readingStore.setCurrentReading(null)
})
</script>

<style scoped>
.reading-content-wrapper {
  min-height: 100vh;
}

.essay-content {
  animation: contentFadeIn 1s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
  opacity: 0;
}

@keyframes contentFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.essay-paragraph {
  opacity: 0;
}

.reading-mode .essay-paragraph {
  line-height: 2.2;
  letter-spacing: 0.01em;
  margin-bottom: 3.5rem;
}

.descent-mode {
  transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.completion-wrapper {
  min-height: 100vh;
}
</style>
