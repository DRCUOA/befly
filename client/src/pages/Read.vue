<template>
  <ReadingLayout
    back-route="/home"
    back-label="Back to essays"
  >
    <div v-if="loading" class="text-center py-32">
      <p class="text-lg font-light text-ink-light">Loading...</p>
    </div>
    
    <div v-else-if="error" class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
      <div class="bg-red-50 border border-red-200 rounded-md p-8 mb-6">
        <p class="text-red-800 mb-4">{{ error }}</p>
          <router-link
            to="/home"
            class="text-sm text-ink hover:text-ink-light"
          >
            ← Back to Essays
          </router-link>
      </div>
    </div>
    
    <div v-else-if="writing" class="reading-content-wrapper">
      <!-- Essay Header -->
      <div class="w-full px-4 sm:px-6 md:px-8 pt-8 sm:pt-12 md:pt-16 pb-8 sm:pb-10 md:pb-12 bg-paper">
        <div class="max-w-4xl mx-auto">
          <div class="mb-6 sm:mb-8">
            <div class="flex items-center gap-2 sm:gap-3 flex-wrap mb-3 sm:mb-4">
              <ThemeTag
                v-for="theme in themes"
                :key="theme.id"
                :name="theme.name"
                class="text-xs tracking-widest uppercase font-sans text-ink-lighter"
              />
              <span class="text-xs text-ink-lighter mx-2 sm:mx-3">·</span>
              <span class="text-xs font-sans text-ink-lighter">{{ formattedDate }}</span>
            </div>
          </div>
          
          <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-tight mb-8 sm:mb-10 md:mb-12">
            {{ writing.title }}
          </h1>
          
          <div class="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-8 text-xs sm:text-sm font-sans text-ink-lighter mb-8 sm:mb-12 md:mb-16">
            <span>{{ wordCount }} words</span>
            <span>·</span>
            <span>{{ readTime }} min read</span>
            <span>·</span>
            <span>Published {{ formattedDate }}</span>
          </div>
          
          <div class="border-t border-line pt-6 sm:pt-8">
            <p class="text-base sm:text-lg md:text-xl font-light text-ink-light leading-relaxed italic">
              {{ excerpt }}
            </p>
          </div>
        </div>
      </div>

      <!-- Essay Content -->
      <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16 bg-paper">
        <div class="max-w-3xl mx-auto essay-content text-base sm:text-lg md:text-xl leading-relaxed">
          <div
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="essay-paragraph mb-10"
          >
            <MarkdownRenderer :markdown="paragraph" />
          </div>
        </div>
      </div>

      <!-- Appreciation Section -->
      <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16 bg-paper border-t border-line">
        <div class="max-w-3xl mx-auto">
          <div class="mb-6 sm:mb-8">
            <h2 class="text-xl sm:text-2xl font-light tracking-tight mb-3 sm:mb-4">Appreciation</h2>
            <p class="text-xs sm:text-sm font-light text-ink-lighter">
              {{ isAuthenticated ? 'Share your reaction to this piece' : 'Sign in to share your reaction' }}
            </p>
          </div>
          <AppreciationButton
            v-if="isAuthenticated"
            :writing-id="writing.id"
            :appreciators="appreciations"
            @appreciated="loadAppreciations"
            @unappreciated="loadAppreciations"
          />
          <div v-else class="text-sm text-ink-lighter">
            <router-link to="/signin" class="hover:text-ink">Sign in</router-link> to share your reaction
          </div>
        </div>
      </div>

      <!-- Comments Section -->
      <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16 bg-paper border-t border-line">
        <div class="max-w-3xl mx-auto">
          <CommentSection :writing-id="writing.id" />
        </div>
      </div>
    </div>
  </ReadingLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import { useReadingStore } from '../stores/reading'
import ReadingLayout from '../layouts/ReadingLayout.vue'
import MarkdownRenderer from '../components/writing/MarkdownRenderer.vue'
import ThemeTag from '../components/writing/ThemeTag.vue'
import AppreciationButton from '../components/writing/AppreciationButton.vue'
import CommentSection from '../components/writing/CommentSection.vue'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import type { Appreciation } from '../domain/Appreciation'
import type { ApiResponse } from '@shared/ApiResponses'
import { markdownToText } from '../utils/markdown'

const route = useRoute()
const { isAuthenticated } = useAuth()
const readingStore = useReadingStore()

const writing = ref<WritingBlock | null>(null)
const themes = ref<Theme[]>([])
const appreciations = ref<Appreciation[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

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

const loadAppreciations = async () => {
  if (!writing.value) return
  try {
    const response = await api.get<ApiResponse<Appreciation[]>>(`/appreciations/writing/${writing.value.id}`)
    appreciations.value = response.data
  } catch (err) {
    console.error('Failed to reload appreciations:', err)
  }
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
    readingStore.markAsRead(writing.value.id, writing.value.title, true)
    
    // Restore scroll position if available (content is already visible)
    const savedPosition = readingStore.getScrollPosition(id)
    if (savedPosition && savedPosition > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        window.scrollTo({ top: savedPosition, behavior: 'instant' })
      }, 50)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load writing'
  } finally {
    loading.value = false
  }
}

// Simple scroll save for reading
let saveTimeout: ReturnType<typeof setTimeout> | null = null

const saveReadingScroll = () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    if (writing.value) {
      readingStore.saveScrollPosition(writing.value.id, window.scrollY)
    }
  }, 500)
}

onMounted(() => {
  loadWriting()
  window.addEventListener('scroll', saveReadingScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', saveReadingScroll)
  if (saveTimeout) clearTimeout(saveTimeout)
  
  // Final save
  if (writing.value) {
    readingStore.saveScrollPosition(writing.value.id, window.scrollY)
  }
  
  readingStore.setCurrentReading(null)
})
</script>

<style scoped>
.reading-content-wrapper {
  min-height: 100vh;
}

</style>
