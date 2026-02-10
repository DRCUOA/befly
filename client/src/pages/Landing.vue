<template>
  <div class="landing-page">
    <!-- Hero Section - Arrival -->
    <div id="arrival-container" class="w-full min-h-screen flex items-center justify-center relative overflow-hidden px-4 sm:px-6 md:px-8">
      <div id="central-content" class="text-center max-w-2xl">
        <div id="author-mark" class="mb-8 sm:mb-10 md:mb-12">
          <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-none">
            {{ appConfig.appName }}
          </h1>
        </div>
        
        <div id="context-line" class="mb-8 sm:mb-12 md:mb-16">
          <p class="text-base sm:text-lg md:text-xl font-light text-ink-light tracking-wide px-4">
            A place for slow reading and thoughtful writing
          </p>
        </div>
        
        <div id="entry-action" class="mb-12 sm:mb-16 md:mb-24">
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
      
      <div id="corner-mark" class="absolute top-4 left-4 sm:top-6 sm:left-6 md:top-8 md:left-8">
        <span class="text-xs tracking-widest uppercase font-sans text-ink-lighter">2026</span>
      </div>
    </div>

    <!-- Opening Statement -->
    <div id="threshold-section" class="w-full min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8 py-16 sm:py-24 md:py-32">
      <div class="max-w-3xl">
        <div id="opening-statement" class="mb-12 sm:mb-16 md:mb-24">
          <h2 class="text-3xl sm:text-4xl md:text-5xl font-light leading-tight mb-6 sm:mb-8 tracking-tight">
            Staying in the Arena
          </h2>
          <p class="text-base sm:text-lg md:text-xl font-light text-ink-light leading-relaxed mb-4 sm:mb-6">
            This is a place for people who think too much, feel deeply, and still believe responsibility matters — even when certainty has collapsed.
          </p>
          <p class="text-xl font-light text-ink-light leading-relaxed mb-6">
            I write about agency under pressure, identity after fracture, and what it means to stay human in an age of acceleration: technological, cultural, and personal. Some of this comes from philosophy, some from software and systems thinking, and some from lived experience that refused to stay theoretical.
          </p>
          <p class="text-xl font-light text-ink-light leading-relaxed mb-6">
            This isn't self-help.<br/>
            It isn't therapy.<br/>
            It isn't tech hype.
          </p>
          <p class="text-xl font-light text-ink-light leading-relaxed mb-6">
            It's an attempt to think clearly — and live honestly — when the old stories stop working.
          </p>
          <p class="text-xl font-light text-ink-light leading-relaxed mb-6">
            You don't need to agree with everything here.<br/>
            You don't need to be fixed, impressive, or optimistic.
          </p>
          <p class="text-xl font-light text-ink leading-relaxed">
            If you're trying to live responsibly anyway — you're welcome.
          </p>
        </div>
      </div>
    </div>

    <!-- Collection Preview -->
    <div id="navigation-emergence" class="w-full min-h-screen bg-gradient-to-b from-paper to-gray-50 px-4 sm:px-6 md:px-8 py-16 sm:py-24 md:py-32">
      <div class="max-w-4xl mx-auto">
        <div id="nav-introduction" class="text-center mb-12 sm:mb-16 md:mb-20">
          <h2 class="text-2xl sm:text-3xl md:text-4xl font-light mb-4 sm:mb-6 tracking-tight">What You'll Find Here</h2>
        </div>
        
        <div id="collection-cards" class="space-y-6 sm:space-y-8">
          <div class="bg-paper border border-line p-6 sm:p-8 md:p-12">
            <h3 class="text-2xl sm:text-3xl font-light mb-3 tracking-tight">Agency</h3>
            <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-4 sm:mb-6">
              What responsibility looks like when freedom feels unbearable.
            </p>
            <p class="text-base font-light text-ink-lighter italic">
              Each piece ends with a question. Not because I lack answers — but because connection starts there.
            </p>
          </div>
          
          <div class="bg-paper border border-line p-6 sm:p-8 md:p-12">
            <h3 class="text-2xl sm:text-3xl font-light mb-3 tracking-tight">Integration</h3>
            <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-4 sm:mb-6">
              Living without boxes — after they collapse.
            </p>
            <p class="text-base font-light text-ink-lighter italic">
              Each piece ends with a question. Not because I lack answers — but because connection starts there.
            </p>
          </div>
          
          <div class="bg-paper border border-line p-6 sm:p-8 md:p-12">
            <h3 class="text-2xl sm:text-3xl font-light mb-3 tracking-tight">Humanity in the AI Age</h3>
            <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-4 sm:mb-6">
              Why tools don't absolve us of authorship.
            </p>
            <p class="text-base font-light text-ink-lighter italic">
              Each piece ends with a question. Not because I lack answers — but because connection starts there.
            </p>
          </div>
          
          <div class="bg-paper border border-line p-6 sm:p-8 md:p-12">
            <h3 class="text-2xl sm:text-3xl font-light mb-3 tracking-tight">Words That Held</h3>
            <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-4 sm:mb-6">
              Fragments from others — and myself — that earned their place by surviving contact with reality.
            </p>
            <p class="text-base font-light text-ink-lighter italic">
              Each piece ends with a question. Not because I lack answers — but because connection starts there.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Reading Principles -->
    <div id="reading-principles" class="w-full min-h-screen bg-paper px-4 sm:px-6 md:px-8 py-16 sm:py-24 md:py-32">
      <div class="max-w-5xl mx-auto">
        <div id="principles-header" class="text-center mb-12 sm:mb-16 md:mb-24">
          <h2 class="text-2xl sm:text-3xl md:text-4xl font-light mb-4 sm:mb-6 tracking-tight">How to read here</h2>
          <p class="text-base sm:text-lg font-light text-ink-light max-w-2xl mx-auto px-4">
            This site is designed around a few simple principles that honor your time and attention
          </p>
        </div>
        
        <div id="principles-list" class="space-y-8 sm:space-y-12 md:space-y-16">
          <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 md:gap-12 items-start border-b border-line pb-8 sm:pb-12 md:pb-16">
            <div class="w-12 sm:w-16 flex-shrink-0">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-lg sm:text-xl font-light text-ink-lighter">1</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-xl sm:text-2xl font-light mb-3 sm:mb-4 tracking-tight">One essay at a time</h3>
              <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-3 sm:mb-4">
                When you open an essay, that's all you see. No sidebar of recommendations. No "related posts." No distractions competing for your attention. Just the piece you chose to read.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                The navigation reappears only when you finish or choose to leave.
              </p>
            </div>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 md:gap-12 items-start border-b border-line pb-8 sm:pb-12 md:pb-16">
            <div class="w-12 sm:w-16 flex-shrink-0">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-lg sm:text-xl font-light text-ink-lighter">2</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-xl sm:text-2xl font-light mb-3 sm:mb-4 tracking-tight">Read at your own pace</h3>
              <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-3 sm:mb-4">
                No reading time estimates. No progress bars. No artificial urgency. The text is patient. Take as long as you need.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                Some pieces are meant to be read in twenty minutes. Others might take an hour, or require multiple sessions. Trust your instinct.
              </p>
            </div>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 md:gap-12 items-start border-b border-line pb-8 sm:pb-12 md:pb-16">
            <div class="w-12 sm:w-16 flex-shrink-0">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-lg sm:text-xl font-light text-ink-lighter">3</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-xl sm:text-2xl font-light mb-3 sm:mb-4 tracking-tight">Nothing will interrupt you</h3>
              <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-3 sm:mb-4">
                No pop-ups asking for your email. No cookie banners. No chat widgets. No analytics tracking your scroll depth. You're here to read, and we respect that.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                If you want to stay connected, there's a simple option at the end of each essay. One click, no pressure.
              </p>
            </div>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 md:gap-12 items-start border-b border-line pb-8 sm:pb-12 md:pb-16">
            <div class="w-12 sm:w-16 flex-shrink-0">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-lg sm:text-xl font-light text-ink-lighter">4</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-xl sm:text-2xl font-light mb-3 sm:mb-4 tracking-tight">Trust the silence</h3>
              <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-3 sm:mb-4">
                White space isn't wasted space. The pauses between paragraphs give you room to think. The margins give your eyes a place to rest.
              </p>
              <p class="text-base font-light text-ink-lighter leading-relaxed">
                This emptiness is intentional. It's part of the reading experience.
              </p>
            </div>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 md:gap-12 items-start">
            <div class="w-12 sm:w-16 flex-shrink-0">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-ink-lighter flex items-center justify-center">
                <span class="text-lg sm:text-xl font-light text-ink-lighter">5</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-xl sm:text-2xl font-light mb-3 sm:mb-4 tracking-tight">Leave when you're ready</h3>
              <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-3 sm:mb-4">
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
    <div id="final-invitation" class="w-full min-h-screen bg-paper px-4 sm:px-6 md:px-8 py-16 sm:py-24 md:py-32">
      <div class="max-w-3xl mx-auto text-center">
        <div id="closing-statement" class="mb-12 sm:mb-16">
          <h2 class="text-3xl sm:text-4xl md:text-5xl font-light mb-6 sm:mb-8 tracking-tight leading-tight">
            Take your time.<br/>The words will wait.
          </h2>
          <p class="text-base sm:text-lg md:text-xl font-light text-ink-light leading-relaxed max-w-2xl mx-auto px-4">
            When you're ready to begin, choose an essay. Or come back tomorrow. Or next week. There's no urgency here.
          </p>
        </div>
        
        <div id="final-actions" class="flex flex-col items-center gap-4 sm:gap-6 mb-12 sm:mb-16 md:mb-20">
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
import { ref, onMounted } from 'vue'
import { api } from '../api/client'
import { appConfig } from '../config/app'
import type { Theme } from '../domain/Theme'
import type { WritingBlock } from '../domain/WritingBlock'
import type { ApiResponse } from '@shared/ApiResponses'

const themes = ref<Theme[]>([])
const writings = ref<WritingBlock[]>([])

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
