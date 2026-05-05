<template>
  <div class="admin-essays-page">
    <!-- Header -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-10 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center gap-4 mb-4 flex-wrap">
          <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter">
            Administration
          </p>
          <router-link to="/admin" class="text-sm text-blue-600 hover:text-blue-800 hover:underline">
            Users
          </router-link>
          <router-link to="/admin/rules" class="text-sm text-blue-600 hover:text-blue-800 hover:underline">
            Typography rules
          </router-link>
          <router-link to="/admin/ai-exchanges" class="text-sm text-blue-600 hover:text-blue-800 hover:underline">
            AI exchanges
          </router-link>
        </div>
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-2">
              Frag administration
            </h1>
            <p class="text-base font-light text-ink-light">
              Every frag across every user. Search, filter, edit, and prune.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <p class="text-sm text-ink-lighter font-sans">
              <span class="font-medium text-ink">{{ total.toLocaleString() }}</span>
              total
              <span v-if="filterActive">· {{ filteredCountLabel }} match{{ rows.length === 1 ? '' : 'es' }}</span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-4 border-b border-line bg-paper sticky top-0 z-10">
      <div class="max-w-7xl mx-auto flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[14rem]">
          <label class="block text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">Search</label>
          <input
            v-model="searchInput"
            type="search"
            placeholder="Title or body…"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
            @keyup.enter="applyFilters"
          />
        </div>
        <div class="min-w-[10rem]">
          <label class="block text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">Author</label>
          <select
            v-model="filter.userId"
            @change="applyFilters"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
          >
            <option value="">All users</option>
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.displayName || u.email }}
            </option>
          </select>
        </div>
        <div class="min-w-[10rem]">
          <label class="block text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">Visibility</label>
          <select
            v-model="filter.visibility"
            @change="applyFilters"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
          >
            <option value="">Any</option>
            <option value="private">Private</option>
            <option value="shared">Shared</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div class="min-w-[10rem]">
          <label class="block text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">Sort</label>
          <select
            v-model="sortKey"
            @change="applyFilters"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
          >
            <option value="created_at">Newest first</option>
            <option value="updated_at">Recently updated</option>
            <option value="title">Title (A→Z)</option>
            <option value="author">Author (A→Z)</option>
          </select>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            @click="applyFilters"
            class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
          >
            Apply
          </button>
          <button
            v-if="filterActive"
            type="button"
            @click="resetFilters"
            class="px-3 py-2 text-sm tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-6 bg-paper min-h-screen">
      <div class="max-w-7xl mx-auto">
        <p v-if="loading" class="text-center text-ink-light py-16">Loading frags…</p>
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          {{ error }}
          <button @click="load" class="ml-3 underline">Try again</button>
        </div>

        <div v-else-if="rows.length === 0" class="text-center py-16 text-ink-light">
          No frags match these filters.
        </div>

        <table v-else class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-left">
              <th class="p-3 border-b border-line text-xs uppercase tracking-widest text-ink-lighter font-sans">Title</th>
              <th class="p-3 border-b border-line text-xs uppercase tracking-widest text-ink-lighter font-sans">Author</th>
              <th class="p-3 border-b border-line text-xs uppercase tracking-widest text-ink-lighter font-sans">Visibility</th>
              <th class="p-3 border-b border-line text-xs uppercase tracking-widest text-ink-lighter font-sans text-right">Length</th>
              <th class="p-3 border-b border-line text-xs uppercase tracking-widest text-ink-lighter font-sans text-right">Engagement</th>
              <th class="p-3 border-b border-line text-xs uppercase tracking-widest text-ink-lighter font-sans">Created</th>
              <th class="p-3 border-b border-line text-xs uppercase tracking-widest text-ink-lighter font-sans">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="border-b border-line hover:bg-surface/50 transition-colors"
            >
              <td class="p-3 align-top max-w-md">
                <p class="text-ink font-medium truncate">{{ row.title || '(untitled)' }}</p>
                <p v-if="row.bodyPreview" class="text-xs text-ink-lighter italic line-clamp-2 mt-0.5">
                  {{ row.bodyPreview }}{{ row.bodyLength > 280 ? '…' : '' }}
                </p>
              </td>
              <td class="p-3 align-top">
                <p class="text-ink truncate">{{ row.authorDisplayName || '—' }}</p>
                <p v-if="row.authorEmail && row.authorEmail !== row.authorDisplayName" class="text-xs text-ink-lighter truncate">
                  {{ row.authorEmail }}
                </p>
              </td>
              <td class="p-3 align-top">
                <select
                  :value="row.visibility"
                  :disabled="updatingId === row.id"
                  @change="onChangeVisibility(row, ($event.target as HTMLSelectElement).value as 'private' | 'shared' | 'public')"
                  class="text-xs rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink disabled:opacity-50"
                  :class="visibilityClass(row.visibility)"
                >
                  <option value="private">Private</option>
                  <option value="shared">Shared</option>
                  <option value="public">Public</option>
                </select>
              </td>
              <td class="p-3 align-top text-right text-ink-light tabular-nums">
                {{ formatLength(row.bodyLength) }}
              </td>
              <td class="p-3 align-top text-right text-ink-light tabular-nums whitespace-nowrap">
                <span :title="`${row.viewCount} views`">{{ row.viewCount }}<span class="text-ink-lighter ml-0.5">v</span></span>
                <span class="text-ink-lighter mx-1">·</span>
                <span :title="`${row.commentCount} comments`">{{ row.commentCount }}<span class="text-ink-lighter ml-0.5">c</span></span>
                <span class="text-ink-lighter mx-1">·</span>
                <span :title="`${row.appreciationCount} appreciations`">{{ row.appreciationCount }}<span class="text-ink-lighter ml-0.5">a</span></span>
              </td>
              <td class="p-3 align-top text-ink-light text-xs whitespace-nowrap">
                <div>{{ formatDate(row.createdAt) }}</div>
                <div v-if="row.updatedAt && row.updatedAt !== row.createdAt" class="text-ink-lighter italic">
                  upd {{ formatDate(row.updatedAt) }}
                </div>
              </td>
              <td class="p-3 align-top">
                <div class="flex items-center gap-1">
                  <router-link
                    :to="`/read/${row.id}`"
                    class="px-2 py-1 text-xs font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors"
                    title="Read"
                  >
                    View
                  </router-link>
                  <router-link
                    :to="`/write/${row.id}`"
                    class="px-2 py-1 text-xs font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors"
                    title="Edit"
                  >
                    Edit
                  </router-link>
                  <button
                    type="button"
                    :disabled="updatingId === row.id"
                    @click="onDelete(row)"
                    class="px-2 py-1 text-xs font-sans border border-line text-ink-light hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div v-if="!loading && !error && total > limit" class="mt-6 flex items-center justify-between gap-3 text-sm">
          <p class="text-ink-light">
            Showing {{ offset + 1 }}–{{ Math.min(offset + rows.length, total) }} of {{ total }}
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="offset === 0"
              @click="goPage(offset - limit)"
              class="px-3 py-1.5 text-xs tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              :disabled="offset + limit >= total"
              @click="goPage(offset + limit)"
              class="px-3 py-1.5 text-xs tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminApi, type AdminEssayRow, type AdminEssayFilter } from '../api/admin'
import { api } from '../api/client'

interface AdminUserSlim {
  id: string
  email: string
  displayName: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref<string | null>(null)
const rows = ref<AdminEssayRow[]>([])
const total = ref(0)
const offset = ref(0)
const limit = 50
const updatingId = ref<string | null>(null)
const users = ref<AdminUserSlim[]>([])

const searchInput = ref('')
const sortKey = ref<NonNullable<AdminEssayFilter['sort']>>('created_at')
const filter = ref<{ userId: string; visibility: '' | 'private' | 'shared' | 'public' }>({
  userId: '',
  visibility: '',
})

const filterActive = computed(() =>
  Boolean(searchInput.value || filter.value.userId || filter.value.visibility || sortKey.value !== 'created_at')
)
const filteredCountLabel = computed(() => total.value.toLocaleString())

function visibilityClass(v: string): string {
  if (v === 'public') return 'text-emerald-700'
  if (v === 'shared') return 'text-blue-700'
  return 'text-ink-light'
}

function formatLength(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

/* ---- query-string sync so deep links to a filtered view work ---- */

function readQuery() {
  searchInput.value = (route.query.q as string) || ''
  filter.value.userId = (route.query.userId as string) || ''
  const v = route.query.visibility as string | undefined
  filter.value.visibility = (v === 'private' || v === 'shared' || v === 'public') ? v : ''
  const s = route.query.sort as string | undefined
  sortKey.value = (s === 'updated_at' || s === 'title' || s === 'author') ? s : 'created_at'
  offset.value = parseInt((route.query.offset as string) || '0', 10) || 0
}

function writeQuery() {
  const next: Record<string, string> = {}
  if (searchInput.value) next.q = searchInput.value
  if (filter.value.userId) next.userId = filter.value.userId
  if (filter.value.visibility) next.visibility = filter.value.visibility
  if (sortKey.value !== 'created_at') next.sort = sortKey.value
  if (offset.value > 0) next.offset = String(offset.value)
  router.replace({ query: next })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await adminApi.listEssays({
      q: searchInput.value || undefined,
      userId: filter.value.userId || undefined,
      visibility: filter.value.visibility || undefined,
      sort: sortKey.value,
      order: sortKey.value === 'title' || sortKey.value === 'author' ? 'asc' : 'desc',
      limit,
      offset: offset.value,
    })
    rows.value = res.data
    total.value = res.meta.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load frags'
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    // Reuse the admin users endpoint; tolerate failures since the user filter
    // is non-critical (it just falls back to a single "All users" option).
    const res = await api.get<{ data: AdminUserSlim[] }>('/admin/users', {
      params: { limit: '500' },
    })
    users.value = (res.data || []).sort((a, b) =>
      (a.displayName || a.email).localeCompare(b.displayName || b.email)
    )
  } catch {
    users.value = []
  }
}

function applyFilters() {
  offset.value = 0
  writeQuery()
  load()
}

function resetFilters() {
  searchInput.value = ''
  filter.value.userId = ''
  filter.value.visibility = ''
  sortKey.value = 'created_at'
  offset.value = 0
  writeQuery()
  load()
}

function goPage(newOffset: number) {
  offset.value = Math.max(0, newOffset)
  writeQuery()
  load()
  // Scroll to top of the table area for clarity.
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function onChangeVisibility(row: AdminEssayRow, visibility: 'private' | 'shared' | 'public') {
  if (visibility === row.visibility) return
  updatingId.value = row.id
  // Optimistic update.
  const before = row.visibility
  row.visibility = visibility
  try {
    await adminApi.setEssayVisibility(row.id, visibility)
  } catch (err) {
    row.visibility = before
    alert(err instanceof Error ? err.message : 'Failed to change visibility')
  } finally {
    updatingId.value = null
  }
}

async function onDelete(row: AdminEssayRow) {
  const ok = confirm(
    `Delete this frag?\n\n"${row.title || '(untitled)'}"\nby ${row.authorDisplayName || row.authorEmail}\n\nThis cannot be undone. The frag's comments, appreciations, and any manuscript-spine slots that referenced it will lose the link (slots remain in place).`
  )
  if (!ok) return
  updatingId.value = row.id
  try {
    await adminApi.deleteEssay(row.id)
    rows.value = rows.value.filter(r => r.id !== row.id)
    total.value = Math.max(0, total.value - 1)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete')
  } finally {
    updatingId.value = null
  }
}

onMounted(async () => {
  readQuery()
  await Promise.all([load(), loadUsers()])
})

watch(() => route.query, () => {
  readQuery()
  load()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
