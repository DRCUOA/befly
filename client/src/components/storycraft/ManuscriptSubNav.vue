<template>
  <nav
    class="border-b border-line bg-paper sticky top-0 z-20"
    aria-label="Manuscript views"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <div class="flex items-center gap-1 overflow-x-auto -mb-px">
        <router-link
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.to"
          class="px-4 py-3 text-sm tracking-wide font-sans whitespace-nowrap border-b-2 transition-colors"
          :class="isActive(tab) ? activeClass : inactiveClass"
        >
          {{ tab.label }}
        </router-link>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface Props {
  manuscriptId: string
  manuscriptTitle?: string
}

const props = defineProps<Props>()
const route = useRoute()

const tabs = computed(() => [
  { name: 'ManuscriptDetail', label: 'Overview',   to: `/manuscripts/${props.manuscriptId}` },
  { name: 'CharacterStudio',  label: 'Characters', to: `/manuscripts/${props.manuscriptId}/characters` },
  { name: 'PolyphonicMap',    label: 'Polyphonic', to: `/manuscripts/${props.manuscriptId}/polyphonic` },
  { name: 'PlotCausality',    label: 'Plot',       to: `/manuscripts/${props.manuscriptId}/plot` },
])

// Considered active when the route name matches OR the path starts with the tab path
// (covers nested character pages, etc.).
const isActive = (tab: { name: string; to: string }) => {
  if (route.name === tab.name) return true
  // Overview only matches exact path because /characters etc. all share the prefix.
  if (tab.name === 'ManuscriptDetail') {
    return route.path === tab.to
  }
  return route.path.startsWith(tab.to)
}

const activeClass = 'border-ink text-ink font-medium'
const inactiveClass = 'border-transparent text-ink-lighter hover:text-ink hover:border-line'
</script>
