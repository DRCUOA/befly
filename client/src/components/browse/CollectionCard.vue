<template>
  <router-link
    :to="route"
    class="collection-card group bg-paper border border-line hover:border-ink-lighter p-6 sm:p-8 md:p-12 cursor-pointer block text-center md:text-left"
  >
    <div class="flex flex-col md:flex-row items-center md:items-start justify-center md:justify-between mb-4 sm:mb-6">
      <div>
        <h3 class="text-2xl sm:text-3xl font-light mb-2 sm:mb-3 tracking-tight">{{ title }}</h3>
        <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter">
          {{ count }} {{ count === 1 ? 'essay' : 'essays' }}
        </p>
      </div>
      <svg
        class="w-5 h-5 text-ink-lighter opacity-0 group-hover:opacity-100 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </div>
    <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-4 sm:mb-6">
      {{ description }}
    </p>
    <div class="flex justify-center md:justify-start gap-3 flex-wrap">
      <span
        v-for="tag in tags"
        :key="tag"
        class="text-xs tracking-wide font-sans px-3 py-1 bg-gray-100 text-ink-light"
      >
        {{ tag }}
      </span>
    </div>
  </router-link>
</template>

<script setup lang="ts">
interface Props {
  title: string
  description: string
  count: number
  tags: string[]
  route: string
}

defineProps<Props>()
</script>

<style scoped>
.collection-card:hover {
  transform: translateY(-2px);
}
</style>
