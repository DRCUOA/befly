<template>
  <div class="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
    <div class="flex items-start justify-between mb-2">
      <router-link
        :to="`/read/${writing.id}`"
        class="flex-1"
      >
        <h2 class="text-xl font-semibold mb-2 text-gray-900 hover:text-blue-600">{{ writing.title }}</h2>
      </router-link>
      <div v-if="isOwner" class="flex items-center space-x-2 ml-4">
        <router-link
          :to="`/write/${writing.id}`"
          class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
          title="Edit"
          @click.stop
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </router-link>
        <button
          @click.stop="handleDelete"
          :disabled="deleting"
          class="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
          title="Delete"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
    <router-link
      :to="`/read/${writing.id}`"
      class="block"
    >
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api/client'
import { useAuth } from '../../stores/auth'
import type { WritingBlock } from '../../domain/WritingBlock'
import type { Theme } from '../../domain/Theme'
import ThemeTag from './ThemeTag.vue'
import { markdownToText } from '../../utils/markdown'

interface Props {
  writing: WritingBlock
  themes: Theme[]
}

const props = defineProps<Props>()
const router = useRouter()
const { user } = useAuth()
const deleting = ref(false)

const isOwner = computed(() => {
  return user.value && props.writing.userId === user.value.id
})

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
