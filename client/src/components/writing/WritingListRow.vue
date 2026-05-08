<template>
  <article
    class="frag-row group"
    :class="{ 'is-recently-read': isRecentlyRead }"
  >
    <router-link
      :to="`/read/${writing.id}`"
      class="frag-row-link"
      @click="handleClick"
    >
      <span class="frag-row-title" :title="writing.title">
        {{ writing.title || 'Untitled' }}
      </span>
      <span v-if="themes.length" class="frag-row-themes" :title="themesTitle">
        <span
          v-for="(t, i) in themes.slice(0, 2)"
          :key="t.id"
          class="frag-row-theme"
        >{{ t.name }}<span v-if="i < Math.min(themes.length, 2) - 1">, </span></span>
        <span v-if="themes.length > 2" class="frag-row-theme-more">+{{ themes.length - 2 }}</span>
      </span>
      <span class="frag-row-meta-group">
        <span v-if="isSpa" class="frag-row-spa-badge">Interactive</span>
        <template v-else>
          <span class="frag-row-meta">{{ wordCount }}w</span>
          <span class="frag-row-meta-sep" aria-hidden="true">·</span>
          <span class="frag-row-meta">{{ readTime }}m</span>
        </template>
        <span class="frag-row-meta-sep" aria-hidden="true">·</span>
        <span class="frag-row-meta frag-row-date">{{ formattedDate }}</span>
        <span v-if="isRecentlyRead" class="frag-row-recent-dot" aria-label="Recently read"></span>
      </span>
    </router-link>
    <div v-if="canModify" class="frag-row-actions" @click.stop>
      <router-link
        :to="`/write/${writing.id}`"
        class="frag-row-action"
        aria-label="Edit"
        title="Edit"
      >
        <svg class="frag-row-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </router-link>
      <button
        type="button"
        @click="handleDelete"
        :disabled="deleting"
        class="frag-row-action"
        aria-label="Delete"
        title="Delete"
      >
        <svg class="frag-row-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
// One-line list-view representation of a frag, paired with WritingCard for
// the detail view. Mirrors WritingCard's prop shape and emits so the host
// page can swap them based on viewMode without changing the surrounding
// list scaffolding.

import { computed, ref } from 'vue'
import { api } from '../../api/client'
import { useAuth } from '../../stores/auth'
import { useReadingStore } from '../../stores/reading'
import type { WritingBlock } from '../../domain/WritingBlock'
import type { Theme } from '../../domain/Theme'
import { markdownToText, isStandaloneHtmlDoc } from '../../utils/markdown'

interface Props {
  writing: WritingBlock
  themes: Theme[]
}

const emit = defineEmits<{ deleted: [writingId: string] }>()

const props = defineProps<Props>()

const { user, isAdmin } = useAuth()
const readingStore = useReadingStore()
const deleting = ref(false)

const isOwner = computed(() => !!user.value && props.writing.userId === user.value.id)
const canModify = computed(() => isOwner.value || isAdmin.value)
const isRecentlyRead = computed(() => readingStore.isRecentlyRead(props.writing.id))
const isSpa = computed(() => isStandaloneHtmlDoc(props.writing.body))

const wordCount = computed(() => {
  if (isSpa.value) return 0
  const text = markdownToText(props.writing.body)
  return text.split(/\s+/).filter(w => w.length > 0).length
})

const readTime = computed(() => Math.max(1, Math.round(wordCount.value / 280)))

const formattedDate = computed(() => {
  const date = new Date(props.writing.createdAt)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
})

const themesTitle = computed(() => props.themes.map(t => t.name).join(', '))

function handleClick() {
  readingStore.setCurrentReading(props.writing.id)
}

async function handleDelete() {
  if (!confirm(`Are you sure you want to delete "${props.writing.title}"? This action cannot be undone.`)) return
  try {
    deleting.value = true
    await api.delete(`/writing/${props.writing.id}`)
    emit('deleted', props.writing.id)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete writing')
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.frag-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid rgb(var(--color-line));
  padding: 0.55rem 0.25rem;
  min-height: 2.4rem;
  transition: background 200ms ease;
}
.frag-row:hover { background: rgb(var(--color-line) / 0.35); }
.frag-row.is-recently-read { opacity: 0.78; }

.frag-row-link {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.frag-row-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.95rem;
  font-weight: 400;
  color: rgb(var(--color-ink));
  letter-spacing: -0.005em;
}
.group:hover .frag-row-title { color: rgb(var(--color-ink-light)); }

.frag-row-themes {
  flex: 0 0 auto;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-ink-lighter));
  font-family: ui-sans-serif, system-ui, sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 14rem;
}
.frag-row-theme-more {
  margin-left: 0.25rem;
  font-size: 0.65rem;
  color: rgb(var(--color-ink-whisper));
}

.frag-row-meta-group {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 0.75rem;
  color: rgb(var(--color-ink-lighter));
  font-variant-numeric: tabular-nums;
}
.frag-row-meta-sep { color: rgb(var(--color-ink-whisper)); }
.frag-row-date { color: rgb(var(--color-ink-lighter)); }

.frag-row-spa-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  border: 1px solid rgb(var(--color-line));
  background: rgb(var(--color-line) / 0.4);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-ink-lighter));
}

.frag-row-recent-dot {
  display: inline-block;
  width: 6px; height: 6px; border-radius: 50%;
  background: rgb(var(--color-accent));
  margin-left: 0.3rem;
}

.frag-row-actions {
  display: flex; align-items: center; gap: 0.1rem;
  opacity: 0;
  transition: opacity 150ms ease;
}
.frag-row:hover .frag-row-actions,
.frag-row:focus-within .frag-row-actions { opacity: 1; }

.frag-row-action {
  display: inline-flex;
  width: 28px; height: 28px;
  align-items: center; justify-content: center;
  background: transparent; border: 0; cursor: pointer;
  color: rgb(var(--color-ink-lighter));
  text-decoration: none;
  border-radius: 2px;
}
.frag-row-action:hover:not(:disabled) {
  color: rgb(var(--color-ink));
  background: rgb(var(--color-line) / 0.5);
}
.frag-row-action[disabled] { opacity: 0.4; cursor: not-allowed; }
.frag-row-icon { width: 16px; height: 16px; }

@media (max-width: 640px) {
  .frag-row-themes { display: none; }
  .frag-row-meta-group { font-size: 0.7rem; gap: 0.3rem; }
}
</style>
