<template>
  <div class="themes-page">
    <!-- Hero Section -->
    <div class="w-full px-8 py-24 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-6xl font-light tracking-tight mb-8 leading-tight">
          Themes
        </h1>
        <p class="text-xl font-light text-ink-light leading-relaxed max-w-2xl mx-auto">
          Organize your writing by themes. Create collections that help readers discover related ideas.
        </p>
      </div>
    </div>

    <!-- Filter Navigation -->
    <FilterNavigation
      v-if="isAuthenticated"
      :filters="filters"
      :current-filter="filter"
      :count="filteredThemes.length"
      @filter-change="handleFilterChange"
    />

    <!-- Themes List -->
    <div class="w-full px-8 py-20 bg-paper">
      <div class="max-w-7xl mx-auto">
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading themes...</p>
        </div>
        
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-8 mb-6">
          <p class="text-red-800">{{ error }}</p>
        </div>
        
        <div v-else-if="filteredThemes.length === 0" class="text-center py-16">
          <p class="text-lg font-light text-ink-light mb-4">
            <span v-if="filter === 'mine'">You haven't created any themes yet.</span>
            <span v-else-if="filter === 'shared'">No shared themes available.</span>
            <span v-else>No themes yet</span>
          </p>
          <router-link
            v-if="isAuthenticated"
            to="/themes/create"
            class="inline-block px-6 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-500 text-sm tracking-wide font-sans"
          >
            Create Your First Theme
          </router-link>
        </div>
        
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div
            v-for="theme in filteredThemes"
            :key="theme.id"
            class="theme-card bg-paper border border-line p-10 group cursor-pointer hover:border-ink-lighter transition-all duration-500"
          >
            <div class="flex items-start justify-between mb-6">
              <div class="flex-1">
                <h2 class="text-2xl font-light mb-3 tracking-tight group-hover:text-ink-light transition-colors duration-500">
                  {{ theme.name }}
                </h2>
                <p class="text-xs tracking-widest uppercase font-sans text-ink-lighter">
                  {{ getThemeCount(theme.id) }} {{ getThemeCount(theme.id) === 1 ? 'essay' : 'essays' }}
                </p>
              </div>
              <div v-if="isOwner(theme)" class="flex items-center gap-2">
                <router-link
                  :to="`/themes/edit/${theme.id}`"
                  class="p-2 text-ink-lighter hover:text-ink transition-colors"
                  title="Edit"
                  @click.stop
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </router-link>
                <button
                  @click.stop="handleDelete(theme)"
                  :disabled="deleting === theme.id"
                  class="p-2 text-ink-lighter hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            
            <p class="text-base font-light text-ink-light leading-relaxed mb-6">
              {{ theme.description || `Essays exploring ${theme.name.toLowerCase()}` }}
            </p>
            
            <div class="flex items-center justify-between">
              <ThemeTag :name="theme.name" />
              <span
                v-if="theme.visibility !== 'private'"
                class="text-xs px-3 py-1 rounded"
                :class="{
                  'bg-green-100 text-green-800': theme.visibility === 'public',
                  'bg-blue-100 text-blue-800': theme.visibility === 'shared'
                }"
              >
                {{ theme.visibility === 'public' ? 'Public' : 'Shared' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Theme CTA -->
    <div v-if="isAuthenticated && filteredThemes.length > 0" class="w-full px-8 py-24 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-4xl mx-auto text-center">
        <p class="text-lg font-light text-ink-light mb-8">
          Want to organize your writing differently?
        </p>
        <router-link
          to="/themes/create"
          class="inline-block px-6 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-500 text-sm tracking-wide font-sans"
        >
          Create New Theme
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { Theme } from '../domain/Theme'
import ThemeTag from '../components/writing/ThemeTag.vue'
import FilterNavigation from '../components/browse/FilterNavigation.vue'
import type { ApiResponse } from '@shared/ApiResponses'
import type { WritingBlock } from '../domain/WritingBlock'

const { user, isAuthenticated } = useAuth()

const themes = ref<Theme[]>([])
const writings = ref<WritingBlock[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref<'all' | 'mine' | 'shared'>('all')
const deleting = ref<string | null>(null)

const filters = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'My Themes' },
  { value: 'shared', label: 'Shared' },
]

const isOwner = (theme: Theme): boolean => {
  return user.value !== null && theme.userId === user.value.id
}

const getThemeCount = (themeId: string): number => {
  return writings.value.filter(w => w.themeIds.includes(themeId)).length
}

const filteredThemes = computed(() => {
  if (filter.value === 'all') {
    return themes.value
  }
  if (filter.value === 'mine' && user.value) {
    return themes.value.filter(t => t.userId === user.value!.id)
  }
  if (filter.value === 'shared') {
    return themes.value.filter(t => t.visibility === 'shared' || t.visibility === 'public')
  }
  return themes.value
})

const handleFilterChange = (value: string) => {
  filter.value = value as 'all' | 'mine' | 'shared'
}

const loadThemes = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await api.get<ApiResponse<Theme[]>>('/themes')
    themes.value = response.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load themes'
  } finally {
    loading.value = false
  }
}

const loadWritings = async () => {
  try {
    const response = await api.get<ApiResponse<WritingBlock[]>>('/writing')
    writings.value = response.data
  } catch (err) {
    console.error('Failed to load writings:', err)
  }
}

const handleDelete = async (theme: Theme) => {
  if (!confirm(`Are you sure you want to delete the theme "${theme.name}"? This action cannot be undone.`)) {
    return
  }

  try {
    deleting.value = theme.id
    await api.delete(`/themes/${theme.id}`)
    await loadThemes()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete theme')
  } finally {
    deleting.value = null
  }
}

onMounted(() => {
  loadThemes()
  loadWritings()
})
</script>

<style scoped>
.themes-page {
  min-height: 100vh;
}

.theme-card {
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-card:hover {
  transform: translateY(-2px);
}
</style>
