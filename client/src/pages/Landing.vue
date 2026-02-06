<template>
  <div class="landing-page">
    <!-- Hero Section - Arrival -->
    <div id="arrival-container" class="w-full h-screen flex items-center justify-center relative overflow-hidden">
      <div id="central-content" class="text-center px-8 max-w-2xl">
        <div id="author-mark" class="mb-12">
          <h1 class="text-6xl font-light tracking-tight leading-none">
            {{ appConfig.appName }}
          </h1>
        </div>
        
        <div id="context-line" class="mb-16">
          <p class="text-xl font-light text-ink-light tracking-wide">
            A place for slow reading and thoughtful writing
          </p>
        </div>
        
        <div id="entry-action" class="mb-24">
          <router-link
            to="/home"
            class="group relative inline-block"
          >
            <span class="text-lg tracking-widest uppercase font-sans font-light text-ink-lighter group-hover:text-ink">
              Enter
            </span>
            <span class="absolute bottom-0 left-0 w-full h-px bg-ink"></span>
          </router-link>
        </div>
        
        <div id="scroll-indicator">
          <div class="flex flex-col items-center text-ink-lighter">
            <span class="text-xs tracking-widest uppercase font-sans mb-3">or scroll</span>
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>
      
      <div id="corner-mark" class="absolute top-8 left-8">
        <span class="text-xs tracking-widest uppercase font-sans text-ink-lighter">2025</span>
      </div>
    </div>

    <!-- Opening Statement -->
    <div id="threshold-section" class="w-full min-h-screen flex items-center justify-center px-8 py-32">
      <div class="max-w-3xl">
        <div id="opening-statement" class="mb-24">
          <h2 class="text-5xl font-light leading-tight mb-8 tracking-tight">
            This is a place for<br/>slow reading.
          </h2>
          <p class="text-2xl font-light text-ink-light leading-relaxed">
            No notifications. No endless feeds. Just words that ask to be read carefully.
          </p>
        </div>
        
        <div id="invitation-block" class="border-t border-line pt-16 pb-16">
          <p class="text-xl font-light leading-loose text-ink-light mb-8">
            Each piece here is written to be experienced in one sitting, when you have time to think. There's no rush. Nothing expires. The essays will be here when you're ready.
          </p>
          <p class="text-xl font-light leading-loose text-ink-light">
            If you're in a hurry, come back later. This work deserves your full attention, and you deserve the space to give it.
          </p>
        </div>
        
        <!-- Philosophy Grid -->
        <div id="philosophy-grid" class="grid grid-cols-1 md:grid-cols-3 gap-12 pt-16 border-t border-line">
          <div class="text-center">
            <div class="mb-6">
              <svg class="w-12 h-12 text-ink-lighter mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 class="text-sm tracking-widest uppercase font-sans mb-4 text-ink">Depth</h3>
            <p class="text-base font-light text-ink-light leading-relaxed">
              Every word is considered. Every sentence earns its place.
            </p>
          </div>
          
          <div class="text-center">
            <div class="mb-6">
              <svg class="w-12 h-12 text-ink-lighter mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-sm tracking-widest uppercase font-sans mb-4 text-ink">Silence</h3>
            <p class="text-base font-light text-ink-light leading-relaxed">
              Space between ideas matters as much as the ideas themselves.
            </p>
          </div>
          
          <div class="text-center">
            <div class="mb-6">
              <svg class="w-12 h-12 text-ink-lighter mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 class="text-sm tracking-widest uppercase font-sans mb-4 text-ink">Craft</h3>
            <p class="text-base font-light text-ink-light leading-relaxed">
              Writing as an act of care, not content production.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Collection Preview -->
    <div id="navigation-emergence" class="w-full min-h-screen bg-gradient-to-b from-paper to-gray-50 px-8 py-32">
      <div class="max-w-4xl mx-auto">
        <div id="nav-introduction" class="text-center mb-20">
          <h2 class="text-4xl font-light mb-6 tracking-tight">What you'll find here</h2>
          <p class="text-lg font-light text-ink-light">Essays and writing organized by theme</p>
        </div>
        
        <div id="collection-cards" class="space-y-8">
          <router-link
            v-for="theme in featuredThemes"
            :key="theme.id"
            :to="`/themes?filter=${theme.id}`"
            class="group bg-paper border border-line hover:border-ink-lighter p-12 cursor-pointer block"
          >
            <div class="flex items-start justify-between mb-6">
              <div>
                <h3 class="text-3xl font-light mb-3 tracking-tight">{{ theme.name }}</h3>
                <p class="text-sm tracking-widest uppercase font-sans text-ink-lighter">
                  {{ getThemeCount(theme.id) }} {{ getThemeCount(theme.id) === 1 ? 'essay' : 'essays' }}
                </p>
              </div>
              <svg
                class="w-6 h-6 text-ink-lighter group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p class="text-lg font-light text-ink-light leading-relaxed mb-6">
              {{ theme.description || `Essays exploring ${theme.name.toLowerCase()}` }}
            </p>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Reading Principles -->
    <div id="reading-principles" class="w-full min-h-screen bg-paper px-8 py-32">
      <div class="max-w-5xl mx-auto">
        <div id="principles-header" class="text-center mb-24">
          <h2 class="text-4xl font-light mb-6 tracking-tight">How to read here</h2>
          <p class="text-lg font-light text-ink-light max-w-2xl mx-auto">
            This site is designed around a few simple principles that honor your time and attention
          </p>
        </div>
        
        <div id="principles-list" class="space-y-16">
          <div class="flex gap-12 items-start border-b border-line pb-16">
            <div class="w-16 flex-shrink-0">
              <div class="w-12 h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-xl font-light text-ink-lighter">1</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-2xl font-light mb-4 tracking-tight">One essay at a time</h3>
              <p class="text-lg font-light text-ink-light leading-relaxed mb-4">
                When you open an essay, that's all you see. No sidebar of recommendations. No "related posts." No distractions competing for your attention. Just the piece you chose to read.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                The navigation reappears only when you finish or choose to leave.
              </p>
            </div>
          </div>
          
          <div class="flex gap-12 items-start border-b border-line pb-16">
            <div class="w-16 flex-shrink-0">
              <div class="w-12 h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-xl font-light text-ink-lighter">2</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-2xl font-light mb-4 tracking-tight">Read at your own pace</h3>
              <p class="text-lg font-light text-ink-light leading-relaxed mb-4">
                No reading time estimates. No progress bars. No artificial urgency. The text is patient. Take as long as you need.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                Some pieces are meant to be read in twenty minutes. Others might take an hour, or require multiple sessions. Trust your instinct.
              </p>
            </div>
          </div>
          
          <div class="flex gap-12 items-start border-b border-line pb-16">
            <div class="w-16 flex-shrink-0">
              <div class="w-12 h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-xl font-light text-ink-lighter">3</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-2xl font-light mb-4 tracking-tight">Nothing will interrupt you</h3>
              <p class="text-lg font-light text-ink-light leading-relaxed mb-4">
                No pop-ups asking for your email. No cookie banners. No chat widgets. No analytics tracking your scroll depth. You're here to read, and we respect that.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                If you want to stay connected, there's a simple option at the end of each essay. One click, no pressure.
              </p>
            </div>
          </div>
          
          <div class="flex gap-12 items-start border-b border-line pb-16">
            <div class="w-16 flex-shrink-0">
              <div class="w-12 h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-xl font-light text-ink-lighter">4</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-2xl font-light mb-4 tracking-tight">Trust the silence</h3>
              <p class="text-lg font-light text-ink-light leading-relaxed mb-4">
                White space isn't wasted space. The pauses between paragraphs give you room to think. The margins give your eyes a place to rest.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                This emptiness is intentional. It's part of the reading experience.
              </p>
            </div>
          </div>
          
          <div class="flex gap-12 items-start">
            <div class="w-16 flex-shrink-0">
              <div class="w-12 h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-xl font-light text-ink-lighter">5</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-2xl font-light mb-4 tracking-tight">Leave when you're ready</h3>
              <p class="text-lg font-light text-ink-light leading-relaxed mb-4">
                If an essay isn't resonating, you can leave at any time. No guilt, no friction. Your attention is yours to give.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                The work that matters will find you when the timing is right.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Final Invitation -->
    <div id="final-invitation" class="w-full min-h-screen bg-paper px-8 py-32">
      <div class="max-w-3xl mx-auto text-center">
        <div id="closing-statement" class="mb-16">
          <h2 class="text-5xl font-light mb-8 tracking-tight leading-tight">
            Take your time.<br/>The words will wait.
          </h2>
          <p class="text-xl font-light text-ink-light leading-relaxed max-w-2xl mx-auto">
            When you're ready to begin, choose an essay. Or come back tomorrow. Or next week. There's no urgency here.
          </p>
        </div>
        
        <div id="final-actions" class="flex flex-col items-center gap-6 mb-20">
          <router-link
            to="/home"
            class="group relative"
          >
            <span class="text-lg tracking-widest uppercase font-sans font-light text-ink group-hover:text-ink-light">
              Begin Reading
            </span>
            <span class="absolute bottom-0 left-0 w-full h-px bg-ink"></span>
          </router-link>
          
          <div class="flex gap-8 text-sm tracking-wide font-sans text-ink-lighter">
            <router-link to="/signup" class="hover:text-ink">Sign Up</router-link>
            <router-link to="/signin" class="hover:text-ink">Sign In</router-link>
            <router-link to="/home" class="hover:text-ink">Browse</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client'
import { appConfig } from '../config/app'
import type { Theme } from '../domain/Theme'
import type { WritingBlock } from '../domain/WritingBlock'
import type { ApiResponse } from '@shared/ApiResponses'

const themes = ref<Theme[]>([])
const writings = ref<WritingBlock[]>([])

const featuredThemes = computed(() => {
  return themes.value.slice(0, 3)
})

const getThemeCount = (themeId: string): number => {
  return writings.value.filter(w => w.themeIds.includes(themeId)).length
}

const loadThemes = async () => {
  try {
    const response = await api.get<ApiResponse<Theme[]>>('/themes')
    themes.value = response.data
  } catch (err) {
    console.error('Failed to load themes:', err)
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

onMounted(() => {
  loadThemes()
  loadWritings()
})
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
}
</style>
