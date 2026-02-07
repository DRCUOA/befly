<template>
  <div class="browse-page">
    <!-- Hero Section -->
    <div class="w-full px-8 py-24 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-4xl mx-auto text-center">
        <p class="text-sm tracking-widest uppercase font-sans text-ink-lighter mb-6">
          Browse at your pace
        </p>
        <h1 class="text-6xl font-light tracking-tight mb-8 leading-tight">
          Recent Essays
        </h1>
        <p class="text-xl font-light text-ink-light leading-relaxed max-w-2xl mx-auto">
          Titles that read like thoughts, not headlines. No urgency, no pressure—just ideas waiting to be explored.
        </p>
      </div>
    </div>

    <!-- Filter Navigation -->
    <FilterNavigation
      :filters="filters"
      :current-filter="filter"
      :count="filteredWritings.length"
      @filter-change="handleFilterChange"
    />

    <!-- Essay List -->
    <div class="w-full px-8 py-20 bg-paper">
      <div class="max-w-7xl mx-auto">
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading...</p>
        </div>
        
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-8 mb-6">
          <p class="text-red-800">{{ error }}</p>
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
            :show-image="index < 3"
          />
        </div>
      </div>
    </div>

    <!-- Load More Section -->
    <div v-if="!loading && filteredWritings.length > 0 && filteredWritings.length < writings.length" class="w-full px-8 py-20 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-4xl mx-auto text-center">
        <p class="text-base font-light text-ink-lighter mb-8">
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
    <div v-if="themes.length > 0" class="w-full px-8 py-24 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-16">
          <h2 class="text-4xl font-light mb-6 tracking-tight">Or browse by theme</h2>
          <p class="text-lg font-light text-ink-light">
            Essays grouped by theme for a more focused exploration
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <CollectionCard
            v-for="theme in featuredThemes"
            :key="theme.id"
            :title="theme.name"
            :description="getThemeDescription(theme)"
            :count="getThemeCount(theme.id)"
            :tags="[]"
            :route="`/themes?filter=${theme.id}`"
          />
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
import WritingCard from '../components/writing/WritingCard.vue'
import FilterNavigation from '../components/browse/FilterNavigation.vue'
import CollectionCard from '../components/browse/CollectionCard.vue'
import type { ApiResponse } from '@shared/ApiResponses'

const { user, isAuthenticated } = useAuth()

const writings = ref<WritingBlock[]>([])
const themes = ref<Theme[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref<'all' | 'mine' | 'shared'>('all')
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

  return filtered.slice(0, displayedCount.value)
})

const featuredThemes = computed(() => {
  return themes.value.slice(0, 3)
})

const getThemesForWriting = (writing: WritingBlock): Theme[] => {
  return themes.value.filter(theme => writing.themeIds.includes(theme.id))
}

const getThemeCount = (themeId: string): number => {
  return writings.value.filter(w => w.themeIds.includes(themeId)).length
}

const getThemeDescription = (theme: Theme): string => {
  // You could add descriptions to themes or generate them
  return `Essays exploring ${theme.name.toLowerCase()}`
}

const handleFilterChange = (value: string) => {
  filter.value = value as 'all' | 'mine' | 'shared'
  displayedCount.value = 6 // Reset display count on filter change
}

const loadMore = () => {
  displayedCount.value += 6
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


onMounted(async () => {
  // Load content - it will be visible immediately
  await Promise.all([loadWritings(), loadThemes()])
})
</script>

<style scoped>
.browse-page {
  min-height: 100vh;
}
</style>
