<template>
  <div class="theme-detail-page">
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-6xl mx-auto">
        <router-link
          to="/themes"
          class="inline-flex items-center gap-2 text-sm font-sans text-ink-lighter hover:text-ink transition-colors duration-300 mb-8"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          All Themes
        </router-link>

        <div v-if="theme">
          <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4 sm:mb-6 leading-tight">
            {{ theme.name }}
          </h1>
          <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed">
            {{ themeEssays.length }} {{ themeEssays.length === 1 ? 'essay' : 'essays' }} exploring this theme
          </p>
        </div>
      </div>
    </div>

    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 bg-paper">
      <div class="max-w-7xl mx-auto">
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading...</p>
        </div>

        <div v-else-if="!theme" class="text-center py-16">
          <p class="text-lg font-light text-ink-light mb-4">Theme not found</p>
          <router-link
            to="/themes"
            class="text-sm font-sans text-ink-lighter hover:text-ink transition-colors duration-300"
          >
            Browse all themes
          </router-link>
        </div>

        <div v-else-if="themeEssays.length === 0" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">No essays in this theme yet.</p>
        </div>

        <div v-else class="space-y-0">
          <WritingCard
            v-for="(writing, index) in themeEssays"
            :key="writing.id"
            :writing="writing"
            :themes="getThemesForWriting(writing)"
            :show-image="index < 3 || !!writing.coverImageUrl"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/client'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import WritingCard from '../components/writing/WritingCard.vue'
import type { ApiResponse } from '@shared/ApiResponses'

const route = useRoute()

const themes = ref<Theme[]>([])
const writings = ref<WritingBlock[]>([])
const loading = ref(true)

const theme = computed(() => {
  const id = route.params.id as string
  return themes.value.find(t => t.id === id) || null
})

const themeEssays = computed(() => {
  if (!theme.value) return []
  return writings.value
    .filter(w => w.themeIds.includes(theme.value!.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

const getThemesForWriting = (writing: WritingBlock): Theme[] => {
  return themes.value.filter(t => writing.themeIds.includes(t.id))
}

const loadData = async () => {
  try {
    loading.value = true
    const [themesRes, writingsRes] = await Promise.all([
      api.get<ApiResponse<Theme[]>>('/themes'),
      api.get<ApiResponse<WritingBlock[]>>('/writing'),
    ])
    themes.value = themesRes.data
    writings.value = writingsRes.data
  } catch (err) {
    console.error('Failed to load theme data:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(() => route.params.id, loadData)
</script>

<style scoped>
.theme-detail-page {
  min-height: 100vh;
}
</style>
