<template>
  <div class="library-page">
    <!-- Hero -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-24 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6 sm:mb-8 leading-tight">
          My Library
        </h1>
        <p class="text-base sm:text-lg md:text-xl font-light text-ink-light leading-relaxed max-w-2xl mx-auto px-4">
          The books behind your writing. Scan a back-cover barcode &mdash; we&rsquo;ll
          catch the ISBN and fill in the rest.
        </p>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-6 border-b border-line bg-paper">
      <div class="max-w-7xl mx-auto flex flex-wrap items-center gap-3 sm:gap-4">
        <button
          @click="openScanner"
          class="inline-flex items-center gap-2 px-4 py-2 bg-ink text-paper text-sm tracking-wide font-sans hover:bg-ink-light transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h2v12H4zM8 6h1v12H8zM11 6h2v12h-2zM15 6h1v12h-1zM18 6h2v12h-2zM3 4h2M3 20h2M19 4h2M19 20h2" />
          </svg>
          Scan ISBN
        </button>

        <input
          v-model="search"
          type="search"
          placeholder="Search title, author, ISBN, owner"
          class="flex-1 min-w-[12rem] px-3 py-2 border border-line bg-paper text-ink text-sm placeholder:text-ink-lighter"
        />

        <div class="ml-auto inline-flex border border-line" role="group" aria-label="View toggle">
          <button
            @click="viewMode = 'cards'"
            :aria-pressed="viewMode === 'cards'"
            class="px-3 py-2 text-sm font-sans tracking-wide flex items-center gap-1.5 transition-colors"
            :class="viewMode === 'cards' ? 'bg-ink text-paper' : 'bg-paper text-ink-light hover:text-ink'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
            </svg>
            <span class="hidden sm:inline">Cards</span>
          </button>
          <button
            @click="viewMode = 'list'"
            :aria-pressed="viewMode === 'list'"
            class="px-3 py-2 text-sm font-sans tracking-wide flex items-center gap-1.5 border-l border-line transition-colors"
            :class="viewMode === 'list' ? 'bg-ink text-paper' : 'bg-paper text-ink-light hover:text-ink'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span class="hidden sm:inline">List</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Scanner modal -->
    <div
      v-if="scannerOpen"
      class="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      @click.self="closeScanner"
    >
      <div class="w-full max-w-2xl mt-8 sm:mt-0">
        <IsbnScanner
          v-if="!lookupBusy && !pendingLookup"
          @detected="handleDetected"
          @close="closeScanner"
        />

        <div v-else-if="lookupBusy" class="bg-paper border border-line p-6 text-center">
          <p class="text-sm text-ink-light">Looking up ISBN {{ pendingIsbn }}&hellip;</p>
        </div>

        <BookEditor
          v-else-if="pendingLookup"
          :initial="pendingLookup"
          :title="'Add this book?'"
          :save-label="'Add to library'"
          :busy="saving"
          :error-message="saveError"
          @save="onCreateSave"
          @cancel="closeScanner"
        />
      </div>
    </div>

    <!-- Edit modal -->
    <div
      v-if="editing"
      class="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      @click.self="cancelEdit"
    >
      <BookEditor
        :initial="editing"
        :title="'Edit book'"
        :save-label="'Save changes'"
        :busy="saving"
        :error-message="saveError"
        @save="onUpdateSave"
        @cancel="cancelEdit"
      />
    </div>

    <!-- JSON modal -->
    <BookJsonModal
      v-if="jsonViewing"
      :data="jsonViewing.raw ?? jsonFallback(jsonViewing)"
      :heading="jsonViewing.title || jsonViewing.isbn"
      :subhead="jsonViewing.provider ? `ISBN ${jsonViewing.isbn} · via ${jsonViewing.provider}` : `ISBN ${jsonViewing.isbn}`"
      @close="jsonViewing = null"
    />

    <!-- Body -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-10 sm:py-14 bg-paper">
      <div class="max-w-7xl mx-auto">
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading library&hellip;</p>
        </div>

        <div v-else-if="error" class="bg-red-50 border border-red-200 p-6 mb-6">
          <p class="text-red-800">{{ error }}</p>
        </div>

        <div v-else-if="filteredBooks.length === 0" class="text-center py-16">
          <p class="text-lg font-light text-ink-light mb-4">
            <span v-if="books.length === 0">Your library is empty. Scan an ISBN to start.</span>
            <span v-else>Nothing matches your search.</span>
          </p>
          <button
            v-if="books.length === 0"
            @click="openScanner"
            class="inline-block px-6 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-500 text-sm tracking-wide font-sans"
          >
            Scan your first book
          </button>
        </div>

        <!-- CARDS -->
        <div
          v-else-if="viewMode === 'cards'"
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          <article
            v-for="b in filteredBooks"
            :key="b.id"
            class="library-card bg-paper border border-line p-4 flex flex-col group"
          >
            <div class="aspect-[2/3] mb-3 bg-surface flex items-center justify-center overflow-hidden">
              <img
                v-if="b.thumbnail"
                :src="b.thumbnail"
                :alt="b.title"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <span v-else class="text-xs text-ink-lighter font-sans tracking-widest uppercase px-2 text-center">
                No cover
              </span>
            </div>

            <h3 class="text-sm font-medium text-ink line-clamp-2 mb-1">{{ b.title || '(no title)' }}</h3>
            <p v-if="b.authors.length" class="text-xs text-ink-light line-clamp-1">
              {{ b.authors.join(', ') }}
            </p>
            <p class="text-[11px] text-ink-lighter mt-0.5">
              <span v-if="b.publishedDate">{{ b.publishedDate }}</span>
              <span v-if="b.publisher && b.publishedDate"> &middot; </span>
              <span v-if="b.publisher">{{ b.publisher }}</span>
            </p>
            <p v-if="b.owner" class="text-[11px] text-ink-light mt-0.5">
              Owner: {{ b.owner }}
            </p>

            <!-- Status chips -->
            <div class="flex flex-wrap gap-1.5 mt-2">
              <span
                class="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border"
                :class="b.read ? 'border-ink text-ink' : 'border-line text-ink-lighter'"
              >
                {{ b.read ? 'Read' : 'Unread' }}
              </span>
              <span class="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-line text-ink-light" :title="'Want-to-read score (0–100)'">
                Want {{ b.readMotivation }}
              </span>
              <span class="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-line text-ink-light" :title="'Physical condition (0–100)'">
                Cond {{ b.physicalCondition }}
              </span>
            </div>

            <p class="text-[10px] tracking-widest uppercase text-ink-lighter mt-2">
              ISBN {{ b.isbn }}
            </p>

            <!-- Action bar -->
            <div class="flex items-center justify-end gap-1 mt-2 -mb-1">
              <button @click="jsonViewing = b" class="icon-btn" :title="'View raw metadata'" aria-label="View raw metadata">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button @click="startEdit(b)" class="icon-btn" :title="'Edit book'" aria-label="Edit book">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="handleDelete(b)"
                :disabled="deleting === b.id"
                class="icon-btn hover:!text-red-600"
                :title="'Remove from library'"
                aria-label="Remove from library"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </article>
        </div>

        <!-- LIST -->
        <ul v-else class="divide-y divide-line border border-line">
          <li
            v-for="b in filteredBooks"
            :key="b.id"
            class="flex items-start sm:items-center gap-4 p-3 sm:p-4 hover:bg-surface transition-colors"
          >
            <img
              v-if="b.thumbnail"
              :src="b.thumbnail"
              :alt="b.title"
              class="w-12 h-16 object-cover border border-line shrink-0"
              loading="lazy"
            />
            <div v-else class="w-12 h-16 bg-surface border border-line shrink-0 flex items-center justify-center text-[9px] tracking-widest uppercase text-ink-lighter">
              No&nbsp;cover
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-ink truncate">{{ b.title || '(no title)' }}</p>
              <p v-if="b.authors.length" class="text-xs text-ink-light truncate">
                {{ b.authors.join(', ') }}
              </p>
              <p class="text-[11px] text-ink-lighter truncate">
                <span v-if="b.publishedDate">{{ b.publishedDate }}</span>
                <span v-if="b.publisher"> &middot; {{ b.publisher }}</span>
                <span v-if="b.pageCount"> &middot; {{ b.pageCount }} pp</span>
                <span v-if="b.language"> &middot; {{ b.language }}</span>
              </p>
              <p class="text-[10px] tracking-widest uppercase text-ink-lighter truncate">
                ISBN {{ b.isbn }}<span v-if="b.owner"> &middot; Owner: {{ b.owner }}</span>
              </p>
              <div class="flex flex-wrap gap-1.5 mt-1">
                <span
                  class="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border"
                  :class="b.read ? 'border-ink text-ink' : 'border-line text-ink-lighter'"
                >{{ b.read ? 'Read' : 'Unread' }}</span>
                <span class="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-line text-ink-light">Want {{ b.readMotivation }}</span>
                <span class="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-line text-ink-light">Cond {{ b.physicalCondition }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button @click="jsonViewing = b" class="icon-btn" :title="'View raw metadata'" aria-label="View raw metadata">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button @click="startEdit(b)" class="icon-btn" :title="'Edit book'" aria-label="Edit book">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="handleDelete(b)"
                :disabled="deleting === b.id"
                class="icon-btn hover:!text-red-600"
                :title="'Remove from library'"
                aria-label="Remove from library"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { libraryApi } from '../api/library'
import { ApiError } from '../api/client'
import type { LibraryBook, LibraryBookLookup, LibraryBookUpdate } from '@shared/LibraryBook'
import IsbnScanner, { type ScanDetectedPayload } from '../components/library/IsbnScanner.vue'
import BookEditor, { type EditorForm } from '../components/library/BookEditor.vue'
import BookJsonModal from '../components/library/BookJsonModal.vue'

type ViewMode = 'cards' | 'list'

const STORAGE_KEY_VIEW = 'mylibrary.viewMode'

const books = ref<LibraryBook[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const viewMode = ref<ViewMode>(((): ViewMode => {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_VIEW) : null
  return stored === 'list' ? 'list' : 'cards'
})())

// Scan / lookup state
const scannerOpen = ref(false)
const lookupBusy = ref(false)
const pendingIsbn = ref<string | null>(null)
const pendingLookup = ref<LibraryBookLookup | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const deleting = ref<string | null>(null)

// Edit / view state
const editing = ref<LibraryBook | null>(null)
const jsonViewing = ref<LibraryBook | LibraryBookLookup | null>(null)

const filteredBooks = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return books.value
  return books.value.filter(b =>
    b.title.toLowerCase().includes(q)
    || b.authors.some(a => a.toLowerCase().includes(q))
    || b.isbn.includes(q)
    || b.owner.toLowerCase().includes(q)
  )
})

watch(viewMode, v => {
  try { localStorage.setItem(STORAGE_KEY_VIEW, v) } catch { /* ignore */ }
})

async function load() {
  try {
    loading.value = true
    error.value = null
    books.value = await libraryApi.list()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load library'
  } finally {
    loading.value = false
  }
}

function openScanner() {
  scannerOpen.value = true
  lookupBusy.value = false
  pendingIsbn.value = null
  pendingLookup.value = null
  saveError.value = null
}

function closeScanner() {
  scannerOpen.value = false
  lookupBusy.value = false
  pendingIsbn.value = null
  pendingLookup.value = null
  saveError.value = null
}

async function handleDetected(payload: ScanDetectedPayload) {
  if (lookupBusy.value || pendingLookup.value) return
  pendingIsbn.value = payload.isbn

  // Log the scan-phase event (camera/manual reach).
  libraryApi.logScanEvent({
    phase: 'scan',
    isbn: payload.isbn,
    succeeded: true,
    durationMs: payload.durationMs,
    scanner: payload.scanner,
    provider: payload.format,
  })

  lookupBusy.value = true
  saveError.value = null
  try {
    pendingLookup.value = await libraryApi.lookup(payload.isbn)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Lookup failed'
    // Keep the editor open with a stub so the user can fill in by hand.
    pendingLookup.value = {
      isbn: payload.isbn,
      title: '',
      authors: [],
      publisher: '',
      publishedDate: '',
      description: '',
      pageCount: null,
      thumbnail: '',
      categories: [],
      language: '',
      provider: '',
      raw: null,
    }
  } finally {
    lookupBusy.value = false
  }
}

async function onCreateSave(form: EditorForm) {
  saving.value = true
  saveError.value = null
  try {
    const created = await libraryApi.create({
      isbn: form.isbn,
      title: form.title,
      authors: form.authors,
      publisher: form.publisher,
      publishedDate: form.publishedDate,
      description: form.description,
      pageCount: form.pageCount,
      thumbnail: form.thumbnail,
      categories: form.categories,
      language: form.language,
      provider: form.provider,
      raw: form.raw,
      read: form.read,
      readMotivation: form.readMotivation,
      physicalCondition: form.physicalCondition,
      owner: form.owner,
      notes: form.notes,
    })
    books.value = [created, ...books.value]
    closeScanner()
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      saveError.value = 'This ISBN is already in your library.'
    } else {
      saveError.value = err instanceof Error ? err.message : 'Could not save book'
    }
  } finally {
    saving.value = false
  }
}

function startEdit(b: LibraryBook) {
  editing.value = b
  saveError.value = null
}

function cancelEdit() {
  editing.value = null
  saveError.value = null
}

async function onUpdateSave(form: EditorForm) {
  if (!editing.value) return
  saving.value = true
  saveError.value = null
  try {
    const updates: LibraryBookUpdate = {
      title: form.title,
      authors: form.authors,
      publisher: form.publisher,
      publishedDate: form.publishedDate,
      description: form.description,
      pageCount: form.pageCount,
      thumbnail: form.thumbnail,
      categories: form.categories,
      language: form.language,
      read: form.read,
      readMotivation: form.readMotivation,
      physicalCondition: form.physicalCondition,
      owner: form.owner,
      notes: form.notes,
    }
    const updated = await libraryApi.update(editing.value.id, updates)
    books.value = books.value.map(x => x.id === updated.id ? updated : x)
    editing.value = null
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Could not save changes'
  } finally {
    saving.value = false
  }
}

async function handleDelete(b: LibraryBook) {
  if (!confirm(`Remove "${b.title || b.isbn}" from your library?`)) return
  try {
    deleting.value = b.id
    await libraryApi.delete(b.id)
    books.value = books.value.filter(x => x.id !== b.id)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to remove book')
  } finally {
    deleting.value = null
  }
}

/** Fallback for the JSON modal when raw_metadata is absent — synthesize a
 *  representative object from the saved columns so the inspector is never
 *  empty (older rows predate raw_metadata). */
function jsonFallback(b: LibraryBook | LibraryBookLookup): Record<string, unknown> {
  return {
    isbn: b.isbn,
    title: b.title,
    authors: b.authors,
    publisher: b.publisher,
    publishedDate: b.publishedDate,
    description: b.description,
    pageCount: b.pageCount,
    thumbnail: b.thumbnail,
    categories: b.categories,
    language: b.language,
    provider: b.provider,
  }
}

onMounted(load)
</script>

<style scoped>
.library-page {
  min-height: 100vh;
}
.library-card {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.library-card:hover {
  transform: translateY(-2px);
}
.icon-btn {
  padding: 0.25rem;
  color: var(--color-ink-lighter, #a8a29e);
  transition: color 0.2s;
}
.icon-btn:hover {
  color: var(--color-ink, #1c1917);
}
.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
