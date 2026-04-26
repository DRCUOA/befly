<template>
  <div class="manuscripts-page">
    <!-- Hero -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-24 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6 sm:mb-8 leading-tight">
          Manuscripts
        </h1>
        <p class="text-base sm:text-lg md:text-xl font-light text-ink-light leading-relaxed max-w-2xl mx-auto px-4">
          Where a body of writing finds its shape.
          A manuscript is more than a theme &mdash; it is the emerging form of a book.
        </p>
      </div>
    </div>

    <!-- Filter -->
    <FilterNavigation
      v-if="isAuthenticated"
      :filters="filters"
      :current-filter="filter"
      :count="filteredManuscripts.length"
      @filter-change="handleFilterChange"
    />

    <!-- List -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 bg-paper">
      <div class="max-w-7xl mx-auto">
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading manuscripts&hellip;</p>
        </div>

        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-8 mb-6">
          <p class="text-red-800">{{ error }}</p>
        </div>

        <div v-else-if="filteredManuscripts.length === 0" class="text-center py-16">
          <p class="text-lg font-light text-ink-light mb-4">
            <span v-if="filter === 'mine'">You haven&rsquo;t started a manuscript yet.</span>
            <span v-else-if="filter === 'shared'">No shared manuscripts to read.</span>
            <span v-else>No manuscripts yet.</span>
          </p>
          <router-link
            v-if="isAuthenticated"
            to="/manuscripts/create"
            class="inline-block px-6 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-500 text-sm tracking-wide font-sans"
          >
            Start Your First Manuscript
          </router-link>
        </div>

        <div
          v-else
          class="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 items-center md:items-stretch gap-6 sm:gap-8"
        >
          <div
            v-for="m in filteredManuscripts"
            :key="m.id"
            @click="$router.push(`/manuscripts/${m.id}`)"
            @keydown.enter="$router.push(`/manuscripts/${m.id}`)"
            role="link"
            tabindex="0"
            class="manuscript-card w-full max-w-md md:max-w-none bg-paper border border-line p-6 sm:p-8 md:p-10 group cursor-pointer hover:border-ink-lighter transition-all duration-500 text-center md:text-left"
          >
            <div class="flex flex-col md:flex-row items-start justify-between mb-4 sm:mb-6 gap-4">
              <div class="flex-1">
                <h2 class="text-xl sm:text-2xl font-light mb-2 tracking-tight group-hover:text-ink-light transition-colors duration-500">
                  {{ m.title }}
                </h2>
                <p v-if="m.workingSubtitle" class="text-sm text-ink-light italic mb-2">
                  {{ m.workingSubtitle }}
                </p>
                <p class="text-xs tracking-widest uppercase font-sans text-ink-lighter">
                  {{ formLabel(m.form) }} &middot; {{ statusLabel(m.status) }}
                </p>
              </div>
              <div v-if="canModify(m)" class="flex items-center gap-1" @click.stop>
                <router-link
                  :to="`/manuscripts/edit/${m.id}`"
                  class="p-2 text-ink-lighter hover:text-ink transition-colors"
                  title="Edit details"
                  @click.stop
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </router-link>
                <button
                  @click.stop="handleDelete(m)"
                  :disabled="deleting === m.id"
                  class="p-2 text-ink-lighter hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <p
              v-if="m.centralQuestion"
              class="text-sm sm:text-base font-light text-ink-light leading-relaxed mb-4 line-clamp-3"
            >
              {{ m.centralQuestion }}
            </p>
            <p v-else class="text-sm font-light text-ink-lighter italic mb-4">
              No central question yet.
            </p>

            <div class="flex flex-wrap gap-2 mt-auto">
              <span
                v-for="themeId in m.sourceThemeIds"
                :key="themeId"
                class="text-xs px-2 py-1 bg-surface text-ink-light rounded-sm"
              >
                {{ themeName(themeId) }}
              </span>
              <span
                v-if="m.visibility !== 'private'"
                class="text-xs px-2 py-1 rounded-sm ml-auto"
                :class="m.visibility === 'public'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'"
              >
                {{ m.visibility === 'public' ? 'Public' : 'Shared' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom CTA -->
    <div
      v-if="isAuthenticated && filteredManuscripts.length > 0"
      class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-24 bg-gradient-to-b from-paper to-surface"
    >
      <div class="max-w-4xl mx-auto text-center">
        <p class="text-base sm:text-lg font-light text-ink-light mb-6 sm:mb-8">
          Start shaping another body of work.
        </p>
        <router-link
          to="/manuscripts/create"
          class="inline-block px-6 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-500 text-sm tracking-wide font-sans"
        >
          New Manuscript
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../stores/auth'
import { manuscriptsApi } from '../api/manuscripts'
import { api } from '../api/client'
import type { ApiResponse } from '@shared/ApiResponses'
import type { ManuscriptProject, ManuscriptForm, ManuscriptStatus } from '@shared/Manuscript'
import type { Theme } from '../domain/Theme'
import FilterNavigation from '../components/browse/FilterNavigation.vue'

const { user, isAuthenticated, isAdmin } = useAuth()

const manuscripts = ref<ManuscriptProject[]>([])
const themes = ref<Theme[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref<'all' | 'mine' | 'shared'>('all')
const deleting = ref<string | null>(null)

const filters = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared' },
]

const isOwner = (m: ManuscriptProject) => user.value !== null && m.userId === user.value.id
const canModify = (m: ManuscriptProject) => isOwner(m) || isAdmin.value

const themeName = (id: string) => themes.value.find(t => t.id === id)?.name ?? 'unknown theme'

const FORM_LABELS: Record<ManuscriptForm, string> = {
  memoir: 'Memoir',
  essay_collection: 'Essay collection',
  long_form_essay: 'Long-form essay',
  creative_nonfiction: 'Creative nonfiction',
  hybrid: 'Hybrid',
  fictionalised_memoir: 'Fictionalised memoir',
}
const STATUS_LABELS: Record<ManuscriptStatus, string> = {
  gathering: 'Gathering',
  structuring: 'Structuring',
  drafting: 'Drafting',
  bridging: 'Bridging',
  revising: 'Revising',
  finalising: 'Finalising',
}
const formLabel = (f: ManuscriptForm) => FORM_LABELS[f] ?? f
const statusLabel = (s: ManuscriptStatus) => STATUS_LABELS[s] ?? s

const filteredManuscripts = computed(() => {
  if (filter.value === 'all') return manuscripts.value
  if (filter.value === 'mine' && user.value) {
    return manuscripts.value.filter(m => m.userId === user.value!.id)
  }
  if (filter.value === 'shared') {
    return manuscripts.value.filter(m => m.visibility === 'shared' || m.visibility === 'public')
  }
  return manuscripts.value
})

const handleFilterChange = (v: string) => { filter.value = v as 'all' | 'mine' | 'shared' }

async function loadManuscripts() {
  try {
    loading.value = true
    error.value = null
    manuscripts.value = await manuscriptsApi.list()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load manuscripts'
  } finally {
    loading.value = false
  }
}

async function loadThemes() {
  try {
    const response = await api.get<ApiResponse<Theme[]>>('/themes')
    themes.value = response.data
  } catch (err) {
    // Themes are nice-to-have for the chips; don't surface a hard error.
    console.error('Failed to load themes for manuscript chips:', err)
  }
}

async function handleDelete(m: ManuscriptProject) {
  if (!confirm(`Delete the manuscript "${m.title}"? Its sections and items will go too. The underlying essays in your library are kept.`)) {
    return
  }
  try {
    deleting.value = m.id
    await manuscriptsApi.delete(m.id)
    await loadManuscripts()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete manuscript')
  } finally {
    deleting.value = null
  }
}

onMounted(() => {
  loadManuscripts()
  loadThemes()
})
</script>

<style scoped>
.manuscripts-page {
  min-height: 100vh;
}
.manuscript-card {
  display: flex;
  flex-direction: column;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.manuscript-card:hover {
  transform: translateY(-2px);
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
