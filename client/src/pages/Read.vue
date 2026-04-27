<template>
  <ReadingLayout
    :back-route="navOrigin"
    :back-label="originLabel"
  >
    <div v-if="loading" class="text-center py-32">
      <p class="text-lg font-light text-ink-light">Loading...</p>
    </div>
    
    <div v-else-if="error" class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
      <div class="bg-red-50 border border-red-200 rounded-md p-8 mb-6">
        <p class="text-red-800 mb-4">{{ error }}</p>
          <router-link
            :to="navOrigin"
            class="text-sm text-ink hover:text-ink-light"
          >
            ← {{ originLabel }}
          </router-link>
      </div>
    </div>
    
    <div v-else-if="writing" class="reading-content-wrapper">
      <!-- Essay Header -->
      <div class="w-full px-4 sm:px-6 md:px-8 pt-8 sm:pt-12 md:pt-16 pb-8 sm:pb-10 md:pb-12 bg-paper">
        <div class="max-w-4xl mx-auto">
          <div class="mb-6 sm:mb-8">
            <div class="flex items-center justify-between gap-3 sm:gap-4 flex-wrap mb-3 sm:mb-4">
              <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
                <ThemeTag
                  v-for="theme in themes"
                  :key="theme.id"
                  :name="theme.name"
                  class="text-xs tracking-widest uppercase font-sans text-ink-lighter"
                />
                <span class="text-xs text-ink-lighter mx-2 sm:mx-3">·</span>
                <span class="text-xs font-sans text-ink-lighter">{{ formattedDate }}</span>
              </div>
              <img
                v-if="writing.coverImageUrl"
                :src="writing.coverImageUrl"
                :alt="`Cover for ${writing.title}`"
                class="w-32 h-32 rounded overflow-hidden object-cover flex-shrink-0 border border-line ml-auto"
                :style="{ objectPosition: writing.coverImagePosition || '50% 50%' }"
              />
            </div>
          </div>
          
          <div class="flex items-start justify-between gap-4 mb-8 sm:mb-10 md:mb-12">
            <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-tight">
              {{ writing.title }}
            </h1>
            <router-link
              v-if="canEdit"
              :to="`/write/${writing.id}`"
              class="flex-shrink-0 mt-2 sm:mt-3 inline-flex items-center justify-center w-10 h-10 rounded text-ink-lighter hover:text-ink hover:bg-line transition-colors"
              :aria-label="`Edit ${writing.title}`"
              title="Edit essay"
            >
              <svg
                class="w-5 h-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <!-- Heroicons "pencil-square" -->
                <path d="M16.862 4.487 18.549 2.799a2.121 2.121 0 1 1 3 3L19.862 7.487M16.862 4.487 7.5 13.85l-1.5 4.5 4.5-1.5 9.362-9.363M16.862 4.487l3 3" />
                <path d="M21 12v7.5A2.25 2.25 0 0 1 18.75 21.75H6A2.25 2.25 0 0 1 3.75 19.5V6.75A2.25 2.25 0 0 1 6 4.5h6" />
              </svg>
            </router-link>
          </div>
          
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

      <!-- Essay Content (continues after the excerpt; no duplicate of the opening lines) -->
      <div
        v-if="paragraphs.length > 0"
        class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16 bg-paper"
      >
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
import { useNavigationOrigin } from '../stores/navigation'
import ReadingLayout from '../layouts/ReadingLayout.vue'
import MarkdownRenderer from '../components/writing/MarkdownRenderer.vue'
import ThemeTag from '../components/writing/ThemeTag.vue'
import AppreciationButton from '../components/writing/AppreciationButton.vue'
import CommentSection from '../components/writing/CommentSection.vue'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import type { Appreciation } from '../domain/Appreciation'
import type { ApiResponse } from '@shared/ApiResponses'
import {
  markdownToText,
  bodyMarkdownAfterExcerptPrefix,
  excerptPlainCutLength
} from '../utils/markdown'

const route = useRoute()
const { isAuthenticated, user, isAdmin } = useAuth()
const readingStore = useReadingStore()
const { origin: navOrigin, originLabel } = useNavigationOrigin('/home')

const writing = ref<WritingBlock | null>(null)
const themes = ref<Theme[]>([])
const appreciations = ref<Appreciation[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Split content into paragraphs for progressive reveal (body only — excerpt covers the opening)
const paragraphs = computed(() => {
  if (!writing.value) return []
  const afterExcerpt = bodyMarkdownAfterExcerptPrefix(writing.value.body)
  return afterExcerpt.split(/\n\n+/).filter(p => p.trim().length > 0)
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
  const cut = excerptPlainCutLength(text)
  if (cut >= text.length) return text
  return text.substring(0, cut) + '...'
})

// Show the edit affordance only to the author or to admins. Falls back to
// false when no writing is loaded or the viewer is not signed in.
const canEdit = computed(() => {
  if (!writing.value || !isAuthenticated.value || !user.value) return false
  return isAdmin.value || writing.value.userId === user.value.id
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
