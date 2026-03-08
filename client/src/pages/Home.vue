<template>
  <div class="browse-page">
    <!-- Hero Section -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-6xl mx-auto">
        <div class="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start">
          <div class="flex-1 text-center lg:text-left">
            <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter mb-4 sm:mb-6">
              Browse at your pace
            </p>
            <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-6 sm:mb-8 leading-tight">
              Recent Essays
            </h1>
            <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed max-w-xl mx-auto lg:mx-0">
              Titles that read like thoughts, not headlines. No urgency, no pressure—just ideas waiting to be explored.
            </p>
          </div>
          <div v-if="featuredWriting" class="w-full lg:w-96 lg:flex-shrink-0">
            <router-link
              :to="`/read/${featuredWriting.id}`"
              class="block border border-line bg-paper p-6 sm:p-8 hover:border-ink-lighter transition-colors duration-slow group"
            >
              <span class="text-xs tracking-widest uppercase font-sans text-accent block mb-4">Latest Essay</span>
              <h3 class="text-xl sm:text-2xl font-light tracking-tight mb-3 leading-snug group-hover:text-ink-light transition-colors duration-slow">
                {{ featuredWriting.title }}
              </h3>
              <p class="text-sm font-light text-ink-light leading-relaxed mb-4 line-clamp-2">
                {{ featuredPreview }}
              </p>
              <span class="inline-flex items-center gap-2 text-sm font-sans text-ink-lighter group-hover:text-ink transition-colors duration-slow">
                Read essay
                <svg class="w-3.5 h-3.5 transition-transform duration-slow group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter Navigation -->
    <FilterNavigation
      :filters="filters"
      :current-filter="filter"
      :count="filteredWritings.length"
      :current-sort="sort"
      @filter-change="handleFilterChange"
      @sort-change="handleSortChange"
    />

    <!-- Essay List -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 bg-paper">
      <div class="max-w-7xl mx-auto">
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading...</p>
        </div>
        
        <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-8 mb-6">
          <p class="text-red-800 dark:text-red-300">{{ error }}</p>
        </div>
        
        <div v-else-if="filteredWritings.length === 0" class="text-center py-16">
          <p class="text-lg font-light text-ink-light mb-4">
            <span v-if="filter === 'mine'">You haven't written anything yet.</span>
            <span v-else-if="filter === 'shared'">No shared writing available.</span>
            <span v-else>No writing yet. Start writing!</span>
          </p>
          <router-link
            v-if="isAuthenticated"
            to="/write"
            class="inline-block px-6 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-500 text-sm tracking-wide font-sans"
          >
            Write Your First Piece
          </router-link>
          <router-link
            v-else
            to="/signup"
            class="inline-block px-6 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-500 text-sm tracking-wide font-sans"
          >
            Sign Up to Start Writing
          </router-link>
        </div>
        
        <div v-else class="space-y-0">
          <WritingCard
            v-for="(writing, index) in filteredWritings"
            :key="writing.id"
            :writing="writing"
            :themes="getThemesForWriting(writing)"
            :show-image="index < 3 || !!writing.coverImageUrl"
            :reaction-summary="getReactionSummary(writing.id)"
            @deleted="handleWritingDeleted"
          />
        </div>
      </div>
    </div>

    <!-- Load More Section -->
    <div v-if="!loading && filteredWritings.length > 0 && filteredWritings.length < writings.length" class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-4xl mx-auto text-center">
        <p class="text-sm sm:text-base font-light text-ink-lighter mb-6 sm:mb-8">
          Showing {{ filteredWritings.length }} of {{ writings.length }} essays
        </p>
        <button
          @click="loadMore"
          class="group relative inline-block"
        >
          <span class="text-sm tracking-widest uppercase font-sans font-light text-ink-lighter transition-colors duration-500 group-hover:text-ink">
            Load More Essays
          </span>
          <span class="absolute bottom-0 left-0 w-0 h-px bg-ink transition-all duration-500 group-hover:w-full"></span>
        </button>
      </div>
    </div>

    <!-- Collection Navigation -->
    <div v-if="themes.length > 0" class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-24 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 class="text-2xl sm:text-3xl md:text-4xl font-light mb-4 sm:mb-6 tracking-tight">Or browse by theme</h2>
          <p class="text-base sm:text-lg font-light text-ink-light px-4">
            Essays grouped by theme for a more focused exploration
          </p>
        </div>

        <div class="flex flex-col md:grid md:grid-cols-3 items-center md:items-stretch gap-6 sm:gap-8">
          <div
            v-for="theme in featuredThemes"
            :key="theme.id"
            class="w-full max-w-md md:max-w-none"
          >
            <CollectionCard
              :title="theme.name"
              :description="getThemeDescription(theme)"
              :count="getThemeCount(theme.id)"
              :tags="[]"
              :route="`/themes/${theme.id}`"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import type { WritingReactionSummary } from '../domain/Appreciation'
import WritingCard from '../components/writing/WritingCard.vue'
import FilterNavigation from '../components/browse/FilterNavigation.vue'
import CollectionCard from '../components/browse/CollectionCard.vue'
import { markdownToText } from '../utils/markdown'
import type { ApiResponse } from '@shared/ApiResponses'

const { user, isAuthenticated } = useAuth()

const writings = ref<WritingBlock[]>([])
const themes = ref<Theme[]>([])
const reactionSummaries = ref<Map<string, WritingReactionSummary>>(new Map())
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref<'all' | 'mine' | 'shared'>('all')
const sort = ref<string>('newest')
const displayedCount = ref(6)

const filters = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'My Writing' },
  { value: 'shared', label: 'Shared' },
]

const filteredWritings = computed(() => {
  let filtered = writings.value

  if (filter.value === 'mine' && user.value) {
    filtered = filtered.filter(w => w.userId === user.value!.id)
  } else if (filter.value === 'shared') {
    filtered = filtered.filter(w => w.visibility === 'shared' || w.visibility === 'public')
  }

  filtered = [...filtered].sort((a, b) => {
    switch (sort.value) {
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'updated':
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
  })

  return filtered.slice(0, displayedCount.value)
})

const featuredThemes = computed(() => {
  return themes.value.slice(0, 3)
})

const featuredWriting = computed(() => {
  return writings.value.length > 0 ? writings.value[0] : null
})

const featuredPreview = computed(() => {
  if (!featuredWriting.value) return ''
  const text = markdownToText(featuredWriting.value.body)
  return text.substring(0, 120) + (text.length > 120 ? '...' : '')
})

const getThemesForWriting = (writing: WritingBlock): Theme[] => {
  return themes.value.filter(theme => writing.themeIds.includes(theme.id))
}

const getReactionSummary = (writingId: string) => reactionSummaries.value.get(writingId)

const getThemeCount = (themeId: string): number => {
  return writings.value.filter(w => w.themeIds.includes(themeId)).length
}

const getThemeDescription = (theme: Theme): string => {
  // You could add descriptions to themes or generate them
  return `Essays exploring ${theme.name.toLowerCase()}`
}

const handleFilterChange = (value: string) => {
  filter.value = value as 'all' | 'mine' | 'shared'
  displayedCount.value = 6
}

const handleSortChange = (value: string) => {
  sort.value = value
}

const loadMore = () => {
  displayedCount.value += 6
}

const handleWritingDeleted = (writingId: string) => {
  writings.value = writings.value.filter(w => w.id !== writingId)
}

const loadWritings = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await api.get<ApiResponse<WritingBlock[]>>('/writing')
    writings.value = response.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load writings'
  } finally {
    loading.value = false
  }
}

const loadThemes = async () => {
  try {
    const response = await api.get<ApiResponse<Theme[]>>('/themes')
    themes.value = response.data
  } catch (err) {
    console.error('Failed to load themes:', err)
  }
}

const loadReactionSummaries = async () => {
  if (writings.value.length === 0) return
  try {
    const writingIds = writings.value.map(w => w.id)
    const response = await api.post<ApiResponse<WritingReactionSummary[]>>(
      '/appreciations/summaries',
      { writingIds }
    )
    const map = new Map<string, WritingReactionSummary>()
    for (const s of response.data) {
      map.set(s.writingId, s)
    }
    reactionSummaries.value = map
  } catch (err) {
    console.error('Failed to load reaction summaries:', err)
  }
}

onMounted(async () => {
  await Promise.all([loadWritings(), loadThemes()])
  loadReactionSummaries()
})
</script>

<style scoped>
.browse-page {
  min-height: 100vh;
}
</style>
