<template>
  <div
    class="filter-navigation sticky top-[57px] sm:top-[65px] md:top-[73px] z-40 w-full bg-paper border-b border-line py-6 sm:py-8 md:py-12"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div class="flex gap-4 sm:gap-6 text-xs sm:text-sm tracking-wide font-sans overflow-x-auto w-full sm:w-auto">
          <button
            v-for="filter in filters"
            :key="filter.value"
            @click="$emit('filter-change', filter.value)"
            class="pb-1 whitespace-nowrap"
            :class="
              currentFilter === filter.value
                ? 'text-ink border-b-2 border-ink'
                : 'text-ink-lighter hover:text-ink'
            "
          >
            {{ filter.label }}
          </button>
        </div>
        <div class="flex items-center gap-3 sm:gap-4">
          <span class="text-xs tracking-wide font-sans text-ink-lighter">
            {{ count }} {{ count === 1 ? 'essay' : 'essays' }}
          </span>
          <button
            v-if="showSettings"
            class="text-ink-lighter hover:text-ink"
            aria-label="Filter settings"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </button>
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

interface Props {
  filters: Filter[]
  currentFilter: string
  count: number
  showSettings?: boolean
}

withDefaults(defineProps<Props>(), {
  showSettings: false,
})

defineEmits<{
  'filter-change': [value: string]
}>()
</script>

<style scoped>
.filter-navigation {
  backdrop-filter: blur(8px);
  background-color: rgba(253, 252, 250, 0.95);
}
</style>
