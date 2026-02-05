<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <section class="hero-section bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold text-gray-900 mb-6">
          Write, Share, Inspire
        </h1>
        <p class="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          A beautiful platform for writers to express their thoughts, organize ideas by themes, and connect with a community of readers.
        </p>
        <div class="flex justify-center space-x-4">
          <router-link
            to="/signup"
            class="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Get Started
          </router-link>
          <router-link
            to="/signin"
            class="inline-flex items-center px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Sign In
          </router-link>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section py-16 bg-white">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center text-gray-900 mb-12">
          Everything you need to write and share
        </h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div class="feature-card p-6">
            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Write Freely</h3>
            <p class="text-gray-600">
              Create beautiful writing blocks with markdown support. Organize your thoughts and ideas effortlessly.
            </p>
          </div>

          <div class="feature-card p-6">
            <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Organize by Themes</h3>
            <p class="text-gray-600">
              Categorize your writing with custom themes. Keep your work organized and easy to discover.
            </p>
          </div>

          <div class="feature-card p-6">
            <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Share & Connect</h3>
            <p class="text-gray-600">
              Share your writing with the community or keep it private. Appreciate others' work and build connections.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Public Writing Preview -->
    <section class="preview-section py-16 bg-gray-50">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center text-gray-900 mb-8">
          Explore Public Writing
        </h2>
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">Loading...</p>
        </div>
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p class="text-red-800">{{ error }}</p>
        </div>
        <div v-else-if="publicWritings.length === 0" class="text-center py-8">
          <p class="text-gray-500 mb-4">No public writing available yet.</p>
          <router-link
            to="/signup"
            class="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Be the First to Share
          </router-link>
        </div>
        <div v-else class="space-y-4">
          <WritingCard
            v-for="writing in publicWritings.slice(0, 3)"
            :key="writing.id"
            :writing="writing"
            :themes="getThemesForWriting(writing)"
          />
          <div class="text-center mt-8">
            <router-link
              to="/signup"
              class="inline-block px-6 py-3 text-base font-medium text-blue-600 hover:text-blue-700"
            >
              Sign up to see more →
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section py-16 bg-blue-600">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl font-bold text-white mb-4">
          Ready to start writing?
        </h2>
        <p class="text-xl text-blue-100 mb-8">
          Join our community of writers and share your voice.
        </p>
        <router-link
          to="/signup"
          class="inline-flex items-center px-8 py-3 text-base font-medium text-blue-600 bg-white rounded-md hover:bg-gray-50 transition-colors"
        >
          Create Your Account
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client'
import type { WritingBlock } from '../domain/WritingBlock'
import type { Theme } from '../domain/Theme'
import WritingCard from '../components/writing/WritingCard.vue'
import type { ApiResponse } from '@shared/ApiResponses'

const writings = ref<WritingBlock[]>([])
const themes = ref<Theme[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

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

const getThemesForWriting = (writing: WritingBlock): Theme[] => {
  return themes.value.filter(theme => writing.themeIds.includes(theme.id))
}

const publicWritings = computed(() => {
  return writings.value.filter(w => w.visibility === 'public')
})

onMounted(() => {
  loadWritings()
  loadThemes()
})
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
}

.hero-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.feature-card {
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}
</style>
