<template>
  <div
    class="filter-navigation sticky top-[57px] sm:top-[65px] md:top-[73px] z-40 w-full bg-paper border-b border-line py-4 sm:py-5 md:py-6"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div class="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <div class="flex gap-4 sm:gap-6 text-xs sm:text-sm tracking-wide font-sans overflow-x-auto">
            <button
              v-for="filter in filters"
              :key="filter.value"
              @click="$emit('filter-change', filter.value)"
              class="pb-1 whitespace-nowrap transition-colors duration-300"
              :class="
                currentFilter === filter.value
                  ? 'text-ink border-b-2 border-ink'
                  : 'text-ink-lighter hover:text-ink'
              "
            >
              {{ filter.label }}
            </button>
          </div>
          <span class="text-xs tracking-wide font-sans text-ink-whisper hidden sm:inline" aria-hidden="true">&middot;</span>
          <span class="text-xs tracking-wide font-sans text-ink-whisper hidden sm:inline">
            {{ count }} {{ count === 1 ? 'frag' : 'frags' }}
          </span>
        </div>
        <div class="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <span class="text-xs tracking-wide font-sans text-ink-whisper sm:hidden">
            {{ count }} {{ count === 1 ? 'frag' : 'frags' }}
          </span>
          <!-- Search input: opt-in via the `enableSearch` prop. Hidden when
               not enabled to keep pages that haven't migrated unchanged. -->
          <div v-if="enableSearch" class="flex flex-1 sm:flex-none items-center gap-2">
            <div class="relative flex-1 sm:w-64">
              <input
                :value="searchQuery"
                @input="onSearchInput"
                type="search"
                :placeholder="searchPlaceholder"
                class="w-full text-xs sm:text-sm font-sans text-ink bg-transparent border border-line rounded-none pl-8 pr-7 py-1.5 placeholder:text-ink-whisper focus:border-ink-lighter focus:outline-none transition-colors duration-300"
                :aria-label="searchPlaceholder"
              />
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-lighter pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              </svg>
              <button
                v-if="searchQuery"
                type="button"
                @click="emit('search-change', '')"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-ink-lighter hover:text-ink transition-colors duration-300"
                aria-label="Clear search"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- Title-only / Anywhere toggle. Title-only matches just w.title;
                 Anywhere also matches the rendered body text. The toggle is
                 disabled when no query is present, since it has no effect. -->
            <div
              role="group"
              aria-label="Search scope"
              class="inline-flex border border-line rounded-none text-xs font-sans"
            >
              <button
                type="button"
                @click="emit('scope-change', 'title')"
                :class="[
                  'px-2 py-1 transition-colors duration-200',
                  searchScope === 'title'
                    ? 'bg-ink text-paper'
                    : 'text-ink-lighter hover:text-ink',
                ]"
                :aria-pressed="searchScope === 'title' ? 'true' : 'false'"
              >Title</button>
              <button
                type="button"
                @click="emit('scope-change', 'anywhere')"
                :class="[
                  'px-2 py-1 transition-colors duration-200 border-l border-line',
                  searchScope === 'anywhere'
                    ? 'bg-ink text-paper'
                    : 'text-ink-lighter hover:text-ink',
                ]"
                :aria-pressed="searchScope === 'anywhere' ? 'true' : 'false'"
              >Anywhere</button>
            </div>
          </div>
          <div class="relative">
            <select
              :value="currentSort"
              @change="onSortChange"
              class="text-xs sm:text-sm font-sans text-ink-lighter bg-transparent border border-line rounded-none px-3 py-1.5 pr-8 appearance-none cursor-pointer hover:border-ink-lighter transition-colors duration-300"
              aria-label="Sort frags"
            >
              <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <svg class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-lighter pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Filter {
  value: string
  label: string
}

interface SortOption {
  value: string
  label: string
}

export type SearchScope = 'title' | 'anywhere'

interface Props {
  filters: Filter[]
  currentFilter: string
  count: number
  sortOptions?: SortOption[]
  currentSort?: string
  showSettings?: boolean
  /** Show a search input. Defaults to false so pages that don't pass it stay
   *  visually identical. */
  enableSearch?: boolean
  /** Current search query (controlled). */
  searchQuery?: string
  /** Placeholder shown inside the search input. */
  searchPlaceholder?: string
  /** Where to look when filtering: "title" matches only the title field;
   *  "anywhere" also matches the body text. */
  searchScope?: SearchScope
}

withDefaults(defineProps<Props>(), {
  showSettings: false,
  sortOptions: () => [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'updated', label: 'Recently Updated' },
  ],
  currentSort: 'newest',
  enableSearch: false,
  searchQuery: '',
  searchPlaceholder: 'Search frags…',
  searchScope: 'anywhere',
})

const emit = defineEmits<{
  'filter-change': [value: string]
  'sort-change': [value: string]
  'search-change': [value: string]
  'scope-change': [value: SearchScope]
}>()

const onSortChange = (event: Event) => {
  emit('sort-change', (event.target as HTMLSelectElement).value)
}

const onSearchInput = (event: Event) => {
  emit('search-change', (event.target as HTMLInputElement).value)
}
</script>

<style scoped>
.filter-navigation {
  backdrop-filter: blur(8px);
  background-color: rgb(var(--color-paper) / 0.95);
}
</style>
