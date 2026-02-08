<template>
  <article
    class="essay-card border-b border-line py-8 sm:py-12 md:py-16 group cursor-pointer"
    :class="{ 'read-marker': isRecentlyRead }"
  >
    <router-link
      :to="`/read/${writing.id}`"
      class="flex flex-col md:flex-row gap-6 md:gap-16 items-start block"
      @click="handleClick"
    >
      <div class="flex-1 w-full">
        <div class="mb-3 sm:mb-4">
          <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
            <ThemeTag
              v-for="theme in themes"
              :key="theme.id"
              :name="theme.name"
              class="text-xs tracking-widest uppercase font-sans text-ink-lighter"
            />
            <span v-if="isRecentlyRead" class="text-xs tracking-widest uppercase font-sans text-ink-whisper">
              Recently Read
            </span>
            <span class="text-xs text-ink-lighter mx-2 sm:mx-3">·</span>
            <span class="text-xs font-sans text-ink-lighter">{{ formattedDate }}</span>
          </div>
        </div>
        <h2 class="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-4 sm:mb-6 leading-tight group-hover:text-ink-light">
          {{ writing.title }}
        </h2>
        <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed mb-4 sm:mb-6">
          {{ preview }}
        </p>
        <div class="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-sans text-ink-lighter">
          <span>{{ wordCount }} words</span>
          <span>·</span>
          <span>{{ readTime }} min read</span>
        </div>
      </div>
      <div
        v-if="showImage"
        class="hidden md:block w-64 h-64 flex-shrink-0 bg-gray-200 overflow-hidden rounded-sm"
      >
        <div class="w-full h-full bg-gradient-to-br from-line to-ink-lighter opacity-30 group-hover:opacity-40"></div>
      </div>
    </router-link>
    <div
      v-if="canModify"
      class="flex items-center gap-2 mt-4"
      @click.stop
    >
      <router-link
        :to="`/write/${writing.id}`"
        class="p-2 text-ink-lighter hover:text-ink"
        title="Edit"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </router-link>
      <button
        @click="handleDelete"
        :disabled="deleting"
        class="p-2 text-ink-lighter hover:text-red-600 disabled:opacity-50"
        title="Delete"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '../../api/client'
import { useAuth } from '../../stores/auth'
import { useReadingStore } from '../../stores/reading'
import type { WritingBlock } from '../../domain/WritingBlock'
import type { Theme } from '../../domain/Theme'
import ThemeTag from './ThemeTag.vue'
import { markdownToText } from '../../utils/markdown'

interface Props {
  writing: WritingBlock
  themes: Theme[]
  showImage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showImage: false,
})

const { user, isAdmin } = useAuth()
const readingStore = useReadingStore()
const deleting = ref(false)

const isOwner = computed(() => {
  return user.value && props.writing.userId === user.value.id
})

/**
 * Can edit/delete: owner or admin
 */
const canModify = computed(() => {
  return isOwner.value || isAdmin.value
})

const isRecentlyRead = computed(() => {
  return readingStore.isRecentlyRead(props.writing.id)
})

const preview = computed(() => {
  const text = markdownToText(props.writing.body)
  return text.substring(0, 200) + (text.length > 200 ? '...' : '')
})

const wordCount = computed(() => {
  const text = markdownToText(props.writing.body)
  return text.split(/\s+/).filter(word => word.length > 0).length
})

const readTime = computed(() => {
  // Estimate at 280 words per minute
  return Math.max(1, Math.round(wordCount.value / 280))
})

const formattedDate = computed(() => {
  const date = new Date(props.writing.createdAt)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  })
})

const handleClick = () => {
  readingStore.setCurrentReading(props.writing.id)
}

const handleDelete = async () => {
  if (!confirm(`Are you sure you want to delete "${props.writing.title}"? This action cannot be undone.`)) {
    return
  }

  try {
    deleting.value = true
    await api.delete(`/writing/${props.writing.id}`)
    // Emit event to parent to refresh list
    window.location.reload()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete writing')
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.essay-card:hover {
  transform: translateY(-4px);
}

.essay-card.read-marker {
  opacity: 0.9;
  position: relative;
}

.essay-card.read-marker::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #B8B8B8;
  opacity: 0;
}

.essay-card.read-marker:hover::before {
  opacity: 1;
}
</style>
