<template>
  <header class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-10 bg-gradient-to-b from-paper to-surface">
    <div class="max-w-7xl mx-auto">
      <router-link
        to="/manuscripts"
        class="inline-flex items-center gap-2 text-sm font-sans text-ink-lighter hover:text-ink transition-colors duration-300 mb-6"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        All manuscripts
      </router-link>

      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div class="flex-1 min-w-0">
          <p v-if="eyebrow" class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">
            {{ eyebrow }}
          </p>
          <h1 class="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight leading-tight truncate">
            <router-link :to="`/manuscripts/${manuscriptId}`" class="hover:text-ink-light transition-colors">
              {{ manuscriptTitle }}
            </router-link>
          </h1>
          <p v-if="subtitle" class="text-sm font-light italic text-ink-light mt-1">{{ subtitle }}</p>
        </div>
        <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  manuscriptId: string
  manuscriptTitle: string
  /** Small label above the title, e.g. "Character Studio". */
  eyebrow?: string
  subtitle?: string
}>()
</script>
