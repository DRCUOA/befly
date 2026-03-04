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
            {{ count }} {{ count === 1 ? 'essay' : 'essays' }}
          </span>
        </div>
        <div class="flex items-center gap-3 sm:gap-4">
          <span class="text-xs tracking-wide font-sans text-ink-whisper sm:hidden">
            {{ count }} {{ count === 1 ? 'essay' : 'essays' }}
          </span>
          <div class="relative">
            <select
              :value="currentSort"
              @change="onSortChange"
              class="text-xs sm:text-sm font-sans text-ink-lighter bg-transparent border border-line rounded-none px-3 py-1.5 pr-8 appearance-none cursor-pointer hover:border-ink-lighter transition-colors duration-300"
              aria-label="Sort essays"
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

interface Props {
  filters: Filter[]
  currentFilter: string
  count: number
  sortOptions?: SortOption[]
  currentSort?: string
  showSettings?: boolean
}

withDefaults(defineProps<Props>(), {
  showSettings: false,
  sortOptions: () => [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'updated', label: 'Recently Updated' },
  ],
  currentSort: 'newest',
})

const emit = defineEmits<{
  'filter-change': [value: string]
  'sort-change': [value: string]
}>()

const onSortChange = (event: Event) => {
  emit('sort-change', (event.target as HTMLSelectElement).value)
}
</script>

<style scoped>
.filter-navigation {
  backdrop-filter: blur(8px);
  background-color: rgb(var(--color-paper) / 0.95);
}
</style>
