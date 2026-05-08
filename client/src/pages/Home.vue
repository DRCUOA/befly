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
              Recent Frags
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
              <span class="text-xs tracking-widest uppercase font-sans text-accent block mb-4">Latest Frag</span>
              <h3 class="text-xl sm:text-2xl font-light tracking-tight mb-3 leading-snug group-hover:text-ink-light transition-colors duration-slow">
                {{ featuredWriting.title }}
              </h3>
              <p class="text-sm font-light text-ink-light leading-relaxed mb-4 line-clamp-2">
                {{ featuredPreview }}
              </p>
              <span class="inline-flex items-center gap-2 text-sm font-sans text-ink-lighter group-hover:text-ink transition-colors duration-slow">
                Read frag
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
      :count="totalMatchedCount"
      :current-sort="sort"
      :enable-search="true"
      :search-query="searchQuery"
      :search-scope="searchScope"
      :search-placeholder="searchScope === 'title' ? 'Search frag titles…' : 'Search title or text…'"
      :enable-view-mode="true"
      :view-mode="viewMode"
      @filter-change="handleFilterChange"
      @sort-change="handleSortChange"
      @search-change="handleSearchChange"
      @scope-change="handleSearchScopeChange"
      @view-change="handleViewChange"
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
        
        <div v-else-if="totalMatchedCount === 0" class="text-center py-16">
          <p class="text-lg font-light text-ink-light mb-4">
            <span v-if="searchQuery">No frags match &ldquo;{{ searchQuery }}&rdquo;.</span>
            <span v-else-if="filter === 'mine'">You haven't written anything yet.</span>
            <span v-else-if="filter === 'shared'">No shared writing available.</span>
            <span v-else>No writing yet. Start writing!</span>
          </p>
          <button
            v-if="searchQuery"
            type="button"
            @click="handleSearchChange('')"
            class="inline-block px-6 py-3 border border-ink-lighter text-ink hover:border-ink transition-colors duration-500 text-sm tracking-wide font-sans"
          >
            Clear search
          </button>
          <router-link
            v-else-if="isAuthenticated"
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

        <div v-else :class="viewMode === 'list' ? 'frag-list' : 'space-y-0'">
          <template v-if="viewMode === 'detail'">
            <WritingCard
              v-for="(writing, index) in filteredWritings"
              :key="writing.id"
              :writing="writing"
              :themes="getThemesForWriting(writing)"
              :show-image="index < 3 || !!writing.coverImageUrl"
              :reaction-summary="getReactionSummary(writing.id)"
              @deleted="handleWritingDeleted"
            />
          </template>
          <template v-else>
            <WritingListRow
              v-for="writing in filteredWritings"
              :key="writing.id"
              :writing="writing"
              :themes="getThemesForWriting(writing)"
              @deleted="handleWritingDeleted"
            />
          </template>

          <!-- Infinite-scroll sentinel. The IntersectionObserver in onMounted
               watches this element; when it enters the viewport we extend
               displayedCount, which in turn shows more cards above. The
               sentinel renders only while there are more frags to load. -->
          <div
            v-if="hasMore"
            ref="scrollSentinel"
            class="py-12 text-center"
            aria-live="polite"
          >
            <p class="text-xs tracking-widest uppercase font-sans font-light text-ink-lighter">
              Loading more frags…
            </p>
            <p class="text-xs tracking-wide font-sans text-ink-whisper mt-2">
              {{ filteredWritings.length }} of {{ totalMatchedCount }}
            </p>
          </div>
          <div
            v-else-if="filteredWritings.length > 6"
            class="py-12 text-center"
          >
            <p class="text-xs tracking-widest uppercase font-sans font-light text-ink-whisper">
              {{ totalMatchedCount }} {{ totalMatchedCount === 1 ? 'frag' : 'frags' }} —
              you&rsquo;ve reached the end.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Collection Navigation -->
    <div v-if="themes.length > 0" class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-24 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 class="text-2xl sm:text-3xl md:text-4xl font-light mb-4 sm:mb-6 tracking-tight">Or browse by theme</h2>
          <p class="text-base sm:text-lg font-light text-ink-light px-4">
            Frags grouped by theme for a more focused exploration
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
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import type { WritingReactionSummary } from '../domain/Appreciation'
import WritingCard from '../components/writing/WritingCard.vue'
import WritingListRow from '../components/writing/WritingListRow.vue'
import FilterNavigation, { type SearchScope, type ViewMode } from '../components/browse/FilterNavigation.vue'
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
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const searchScope = ref<SearchScope>('anywhere')

// View mode is persisted across visits — once a user picks the list view
// they tend to want it next time too. Stored under a stable key so future
// list pages can share the same preference if we like.
const VIEW_MODE_STORAGE_KEY = 'frag:viewMode'
function loadViewMode(): ViewMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
      if (v === 'list' || v === 'detail') return v
    }
  } catch { /* ignore — fall back to default */ }
  return 'detail'
}
const viewMode = ref<ViewMode>(loadViewMode())

const PAGE_SIZE = 6
const displayedCount = ref(PAGE_SIZE)

const filters = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'My Writing' },
  { value: 'shared', label: 'Shared' },
]

// Plain-text body cache. We compute markdownToText once per body so the
// search comparator doesn't strip markdown on every keystroke for every
// frag — important once the list is several hundred items long.
const bodyTextCache = new Map<string, string>()
function bodyTextFor(w: WritingBlock): string {
  const cacheKey = `${w.id}:${w.updatedAt || w.createdAt}`
  let v = bodyTextCache.get(cacheKey)
  if (v === undefined) {
    v = markdownToText(w.body || '').toLowerCase()
    bodyTextCache.set(cacheKey, v)
  }
  return v
}

/** Apply filter + sort + search but NOT slicing. Used for the displayed
 *  list (sliced by displayedCount) and the total-match count. */
const matchedWritings = computed(() => {
  let filtered = writings.value

  if (filter.value === 'mine' && user.value) {
    filtered = filtered.filter(w => w.userId === user.value!.id)
  } else if (filter.value === 'shared') {
    filtered = filtered.filter(w => w.visibility === 'shared' || w.visibility === 'public')
  }

  const q = debouncedSearchQuery.value.trim().toLowerCase()
  if (q) {
    filtered = filtered.filter(w => {
      const title = (w.title || '').toLowerCase()
      if (title.includes(q)) return true
      // "title" scope skips the body comparison entirely. "anywhere" falls
      // through to the cached plain-text body.
      if (searchScope.value === 'title') return false
      return bodyTextFor(w).includes(q)
    })
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

  return filtered
})

const totalMatchedCount = computed(() => matchedWritings.value.length)
const filteredWritings = computed(() => matchedWritings.value.slice(0, displayedCount.value))
const hasMore = computed(() => displayedCount.value < totalMatchedCount.value)

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
  return `Frags exploring ${theme.name.toLowerCase()}`
}

const handleFilterChange = (value: string) => {
  filter.value = value as 'all' | 'mine' | 'shared'
  displayedCount.value = PAGE_SIZE
}

const handleSortChange = (value: string) => {
  sort.value = value
  displayedCount.value = PAGE_SIZE
}

// Search debouncing. The user can type quickly through a long list; we
// reflect their input in the input box immediately (searchQuery) but only
// re-filter the list ~180ms after they pause (debouncedSearchQuery). That
// keeps every keystroke from re-running the filter+sort over every frag.
let searchTimer: number | null = null
const handleSearchChange = (value: string) => {
  searchQuery.value = value
  if (searchTimer !== null) clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    searchTimer = null
    debouncedSearchQuery.value = value
    displayedCount.value = PAGE_SIZE
  }, 180)
}

// Switching the scope re-filters immediately — no need to wait, since this
// only fires when the user clicks a toggle, not while typing.
const handleSearchScopeChange = (value: SearchScope) => {
  searchScope.value = value
  displayedCount.value = PAGE_SIZE
}

const handleViewChange = (value: ViewMode) => {
  viewMode.value = value
  // Persist so the user's preference survives reloads.
  try { localStorage.setItem(VIEW_MODE_STORAGE_KEY, value) } catch { /* ignore */ }
}

// Infinite scroll. We watch a sentinel element near the bottom of the
// list; when the user scrolls it into view the observer fires and we load
// the next page. Using IntersectionObserver (rather than scroll-event
// math) means we don't run JS on every scroll frame.
const scrollSentinel = ref<HTMLElement | null>(null)
let infiniteObserver: IntersectionObserver | null = null

function ensureObserver() {
  if (infiniteObserver || typeof IntersectionObserver === 'undefined') return
  infiniteObserver = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && hasMore.value) {
          // Extend by one page. Reading from the computed first prevents an
          // out-of-range count if the user has filtered down the list.
          displayedCount.value = Math.min(
            totalMatchedCount.value,
            displayedCount.value + PAGE_SIZE,
          )
        }
      }
    },
    { rootMargin: '400px 0px' },
  )
}

// Re-attach the observer whenever the sentinel is mounted/remounted (it
// disappears when the list is fully shown and reappears when more matches
// are discovered, e.g. after clearing the search).
watch(scrollSentinel, async (el, prev) => {
  if (prev && infiniteObserver) infiniteObserver.unobserve(prev)
  if (!el) return
  ensureObserver()
  infiniteObserver?.observe(el)
  // After clearing the search the user often expects the new top of the
  // list; nextTick lets the layout settle before any auto-paging trigger.
  await nextTick()
})

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
  ensureObserver()
  await Promise.all([loadWritings(), loadThemes()])
  loadReactionSummaries()
})

onBeforeUnmount(() => {
  if (searchTimer !== null) clearTimeout(searchTimer)
  if (infiniteObserver) {
    infiniteObserver.disconnect()
    infiniteObserver = null
  }
})
</script>

<style scoped>
.browse-page {
  min-height: 100vh;
}

/* List view: each WritingListRow has its own border-bottom. The container
   gets a leading border-top so the first row reads as part of a stacked
   list rather than floating in space. */
.frag-list {
  border-top: 1px solid rgb(var(--color-line));
}
</style>
