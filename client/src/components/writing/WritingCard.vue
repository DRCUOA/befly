<template>
  <router-link
    :to="`/read/${writing.id}`"
    class="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
  >
    <h2 class="text-xl font-semibold mb-2 text-gray-900">{{ writing.title }}</h2>
    <p class="text-gray-600 mb-4 line-clamp-3">{{ preview }}</p>
    <div class="flex items-center justify-between">
      <div class="flex flex-wrap gap-2 items-center">
        <ThemeTag
          v-for="theme in themes"
          :key="theme.id"
          :name="theme.name"
        />
        <span
          v-if="writing.visibility !== 'private'"
          class="px-2 py-1 text-xs rounded"
          :class="{
            'bg-green-100 text-green-800': writing.visibility === 'public',
            'bg-blue-100 text-blue-800': writing.visibility === 'shared'
          }"
        >
          {{ writing.visibility === 'public' ? 'Public' : 'Shared' }}
        </span>
      </div>
      <span class="text-sm text-gray-500">{{ formattedDate }}</span>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WritingBlock } from '../../domain/WritingBlock'
import type { Theme } from '../../domain/Theme'
import ThemeTag from './ThemeTag.vue'
import { markdownToText } from '../../utils/markdown'

interface Props {
  writing: WritingBlock
  themes: Theme[]
}

const props = defineProps<Props>()

const preview = computed(() => {
  return markdownToText(props.writing.body).substring(0, 150) + '...'
})

const formattedDate = computed(() => {
  const date = new Date(props.writing.createdAt)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
})
</script>
