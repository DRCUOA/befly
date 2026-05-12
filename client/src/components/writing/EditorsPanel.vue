<template>
  <div
    role="dialog"
    aria-label="Editor permissions"
    aria-modal="true"
    :aria-hidden="!modelValue"
    class="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-paper border-l border-line shadow-xl flex flex-col transform transition-transform duration-150 ease-out"
    :class="modelValue ? 'translate-x-0' : 'translate-x-full'"
    tabindex="-1"
    @keydown.escape="close"
  >
    <div class="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line shrink-0">
      <h2 class="text-lg font-sans font-medium text-ink">Editors</h2>
      <button
        type="button"
        class="p-2 -m-2 text-ink-lighter hover:text-ink rounded focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        aria-label="Close editors panel"
        @click="close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
      <p class="text-sm text-ink-lighter">
        Invite specific users to edit this frag. The original author and
        admins always have full access. Editors with <em>manage</em> rights
        can also add or remove other editors.
      </p>

      <!-- Invite -->
      <div>
        <label class="block text-sm font-medium text-ink-lighter mb-1" for="editor-search">
          Invite by name or email
        </label>
        <div class="relative">
          <input
            id="editor-search"
            v-model="searchQuery"
            type="text"
            autocomplete="off"
            placeholder="Search active users..."
            class="w-full px-3 py-2 text-sm border border-line rounded bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            @input="onSearchInput"
          />
          <div
            v-if="searchResults.length > 0"
            class="absolute z-10 left-0 right-0 mt-1 bg-paper border border-line rounded shadow-lg max-h-60 overflow-y-auto"
          >
            <button
              v-for="hit in searchResults"
              :key="hit.id"
              type="button"
              class="w-full px-3 py-2 text-left hover:bg-line focus:bg-line text-sm text-ink"
              @click="invite(hit)"
            >
              <div class="font-medium">{{ hit.displayName || hit.email }}</div>
              <div class="text-xs text-ink-lighter">{{ hit.email }}</div>
            </button>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-3">
          <label class="text-xs text-ink-lighter">Permission:</label>
          <select
            v-model="pendingPermission"
            class="text-sm border border-line rounded bg-paper text-ink px-2 py-1"
          >
            <option value="edit">Edit</option>
            <option value="manage">Manage</option>
          </select>
        </div>
        <p v-if="inviteError" class="mt-2 text-sm text-red-600">{{ inviteError }}</p>
      </div>

      <!-- Current grants -->
      <div>
        <h3 class="text-sm font-medium text-ink mb-2">Current editors</h3>
        <p v-if="!loading && editors.length === 0" class="text-sm text-ink-lighter">
          No editors yet. The frag is only editable by you and admins.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="ed in editors"
            :key="ed.id"
            class="border border-line rounded px-3 py-2 flex items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-ink truncate">
                {{ ed.userDisplayName || ed.userEmail || ed.userId }}
              </div>
              <div class="text-xs text-ink-lighter">
                Granted {{ formatDate(ed.createdAt) }}
                <span v-if="ed.grantedByDisplayName"> by {{ ed.grantedByDisplayName }}</span>
              </div>
            </div>
            <select
              :value="ed.permission"
              class="text-xs border border-line rounded bg-paper text-ink px-1.5 py-1"
              @change="onChangePermission(ed, ($event.target as HTMLSelectElement).value)"
            >
              <option value="edit">Edit</option>
              <option value="manage">Manage</option>
            </select>
            <button
              type="button"
              class="text-xs text-red-600 hover:underline"
              @click="onRemove(ed)"
            >
              Remove
            </button>
          </li>
        </ul>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { writingApi, userSearchApi, type UserSearchHit } from '@/api/writing'
import type {
  WritingBlockEditor,
  WritingBlockEditorPermission,
} from '@shared/WritingBlockEditor'

const props = defineProps<{
  modelValue: boolean
  writingId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const editors = ref<WritingBlockEditor[]>([])
const loading = ref(false)
const error = ref('')
const inviteError = ref('')

const searchQuery = ref('')
const searchResults = ref<UserSearchHit[]>([])
const pendingPermission = ref<WritingBlockEditorPermission>('edit')
let searchDebounce: ReturnType<typeof setTimeout> | null = null

function close() {
  emit('update:modelValue', false)
}

async function refresh() {
  if (!props.writingId) return
  loading.value = true
  error.value = ''
  try {
    editors.value = await writingApi.listEditors(props.writingId)
  } catch (e: any) {
    error.value = e?.message || 'Failed to load editors'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.writingId],
  ([open]) => {
    if (open) refresh()
  },
  { immediate: true }
)

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce)
  const q = searchQuery.value.trim()
  if (q.length < 2) {
    searchResults.value = []
    return
  }
  searchDebounce = setTimeout(async () => {
    try {
      searchResults.value = await userSearchApi.search(q)
    } catch {
      searchResults.value = []
    }
  }, 200)
}

async function invite(hit: UserSearchHit) {
  inviteError.value = ''
  try {
    await writingApi.upsertEditor(props.writingId, {
      userId: hit.id,
      permission: pendingPermission.value,
    })
    searchQuery.value = ''
    searchResults.value = []
    await refresh()
  } catch (e: any) {
    inviteError.value = e?.message || 'Failed to grant access'
  }
}

async function onChangePermission(ed: WritingBlockEditor, perm: string) {
  if (perm !== 'edit' && perm !== 'manage') return
  if (perm === ed.permission) return
  try {
    await writingApi.changeEditor(props.writingId, ed.userId, perm)
    await refresh()
  } catch (e: any) {
    error.value = e?.message || 'Failed to update permission'
  }
}

async function onRemove(ed: WritingBlockEditor) {
  const label = ed.userDisplayName || ed.userEmail || 'this editor'
  if (!confirm(`Remove ${label}'s access to this frag?`)) return
  try {
    await writingApi.removeEditor(props.writingId, ed.userId)
    await refresh()
  } catch (e: any) {
    error.value = e?.message || 'Failed to remove editor'
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>
