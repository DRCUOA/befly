<template>
  <div class="bg-paper border border-line p-4 sm:p-6 max-w-2xl w-full">
    <div class="flex items-start justify-between mb-4 gap-3">
      <h3 class="text-lg font-light tracking-tight">{{ title }}</h3>
      <button @click="emit('cancel')" class="text-ink-lighter hover:text-ink p-1" aria-label="Cancel">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Identity row -->
    <div class="flex gap-4 mb-4">
      <div class="shrink-0">
        <div class="w-20 h-28 sm:w-24 sm:h-32 border border-line bg-surface overflow-hidden flex items-center justify-center">
          <img
            v-if="form.thumbnail"
            :src="form.thumbnail"
            :alt="form.title"
            class="w-full h-full object-cover"
          />
          <span v-else class="text-[9px] tracking-widest uppercase text-ink-lighter text-center px-2">
            No cover
          </span>
        </div>
        <div class="flex gap-1 mt-1.5">
          <button
            type="button"
            @click="triggerCoverPicker"
            :disabled="busy || coverUploading"
            class="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-line text-ink-light hover:text-ink hover:bg-surface transition-colors disabled:opacity-50"
            :title="form.thumbnail ? 'Replace cover image' : 'Upload a custom cover'"
          >
            {{ coverUploading ? 'Up…' : (form.thumbnail ? 'Replace' : 'Upload') }}
          </button>
          <button
            v-if="form.thumbnail"
            type="button"
            @click="clearCover"
            :disabled="busy || coverUploading"
            class="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-line text-ink-light hover:text-red-600 transition-colors disabled:opacity-50"
            title="Remove the cover"
          >Clear</button>
        </div>
        <input
          ref="coverFileInput"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          class="hidden"
          @change="onCoverFilePicked"
        />
      </div>
      <div class="flex-1 min-w-0 text-sm">
        <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-0.5">ISBN</p>
        <p class="font-mono text-ink">{{ form.isbn || '—' }}</p>
        <p v-if="form.provider" class="text-xs text-ink-lighter mt-1">via {{ form.provider }}</p>
        <p v-if="coverError" class="text-xs text-red-700 mt-2">{{ coverError }}</p>
      </div>
    </div>

    <!-- Bibliographic fields -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      <label class="block sm:col-span-2">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Title</span>
        <input v-model="form.title" type="text" class="input" />
      </label>

      <label class="block sm:col-span-2">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Authors (comma-separated)</span>
        <input v-model="authorsText" type="text" class="input" />
      </label>

      <label class="block">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Publisher</span>
        <input v-model="form.publisher" type="text" class="input" />
      </label>

      <label class="block">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Published date</span>
        <input v-model="form.publishedDate" type="text" placeholder="YYYY or YYYY-MM-DD" class="input" />
      </label>

      <label class="block">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Page count</span>
        <input v-model.number="pageCountInput" type="number" min="0" class="input" />
      </label>

      <label class="block">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Language</span>
        <input v-model="form.language" type="text" placeholder="en" class="input" />
      </label>

      <label class="block sm:col-span-2">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">
          Cover URL <span class="text-ink-lighter normal-case tracking-normal">(uploaded covers fill this automatically)</span>
        </span>
        <input v-model="form.thumbnail" type="url" class="input" placeholder="https://… or /uploads/cover/…" />
      </label>

      <label class="block sm:col-span-2">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Categories (comma-separated)</span>
        <input v-model="categoriesText" type="text" class="input" />
      </label>

      <label class="block sm:col-span-2">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Description</span>
        <textarea v-model="form.description" rows="3" class="input"></textarea>
      </label>
    </div>

    <!-- Personal fields -->
    <div class="border-t border-line pt-4 mb-4">
      <p class="text-xs uppercase tracking-widest text-ink-lighter mb-3">Your appraisal</p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <label class="flex items-center gap-3 cursor-pointer">
          <span class="text-xs uppercase tracking-widest text-ink-lighter">Read</span>
          <button
            type="button"
            role="switch"
            :aria-checked="form.read"
            @click="form.read = !form.read"
            class="toggle"
            :class="form.read ? 'toggle-on' : ''"
          >
            <span class="toggle-knob" />
          </button>
          <span class="text-sm text-ink">{{ form.read ? 'Read' : 'Not read' }}</span>
        </label>

        <label class="block">
          <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Owner</span>
          <input v-model="form.owner" type="text" placeholder="e.g. me, study shelf" class="input" />
        </label>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <RangeSlider
          v-model="form.readMotivation"
          label="Read motivation"
          low-label="Don't want to"
          high-label="Strongly want to"
        />
        <RangeSlider
          v-model="form.physicalCondition"
          label="Physical condition"
          low-label="Wrecked"
          high-label="Mint"
        />
      </div>

      <label class="block">
        <span class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Notes</span>
        <textarea
          v-model="form.notes"
          rows="3"
          placeholder="Why this book matters to your project…"
          class="input"
        ></textarea>
      </label>
    </div>

    <div v-if="errorMessage" class="text-sm text-red-700 mb-3">{{ errorMessage }}</div>

    <div class="flex gap-2 justify-end">
      <button
        @click="emit('cancel')"
        class="px-4 py-2 text-sm tracking-wide font-sans border border-line text-ink-light hover:text-ink"
        :disabled="busy"
      >
        Cancel
      </button>
      <button
        @click="onSave"
        :disabled="busy"
        class="px-4 py-2 bg-ink text-paper text-sm tracking-wide font-sans hover:bg-ink-light transition-colors disabled:opacity-50"
      >
        {{ busy ? 'Saving…' : saveLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, watch, ref } from 'vue'
import type { LibraryBook, LibraryBookLookup } from '@shared/LibraryBook'
import RangeSlider from './RangeSlider.vue'
import { libraryApi } from '../../api/library'

const MAX_COVER_BYTES = 10 * 1024 * 1024 // matches server's multer limit

export interface EditorForm {
  isbn: string
  title: string
  authors: string[]
  publisher: string
  publishedDate: string
  description: string
  pageCount: number | null
  thumbnail: string
  categories: string[]
  language: string
  provider: string
  /** Carried through unchanged — never shown in the form, never edited. */
  raw: Record<string, unknown> | null
  read: boolean
  readMotivation: number
  physicalCondition: number
  owner: string
  notes: string
}

/** Accept either a saved book (edit) or a lookup result (entry). */
type EditorInput = Partial<LibraryBook> & Partial<LibraryBookLookup>

const props = defineProps<{
  /** Starting values. */
  initial: EditorInput
  /** Header copy. */
  title: string
  /** Primary action label. */
  saveLabel: string
  /** Disable buttons while parent is saving. */
  busy: boolean
  /** Optional error string from the parent. */
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  save: [form: EditorForm]
  cancel: []
}>()

const form = reactive<EditorForm>({
  isbn: props.initial.isbn ?? '',
  title: props.initial.title ?? '',
  authors: [...(props.initial.authors ?? [])],
  publisher: props.initial.publisher ?? '',
  publishedDate: props.initial.publishedDate ?? '',
  description: props.initial.description ?? '',
  pageCount: props.initial.pageCount ?? null,
  thumbnail: props.initial.thumbnail ?? '',
  categories: [...(props.initial.categories ?? [])],
  language: props.initial.language ?? '',
  provider: props.initial.provider ?? '',
  raw: props.initial.raw ?? null,
  read: (props.initial as Partial<LibraryBook>).read ?? false,
  readMotivation: (props.initial as Partial<LibraryBook>).readMotivation ?? 50,
  physicalCondition: (props.initial as Partial<LibraryBook>).physicalCondition ?? 100,
  owner: (props.initial as Partial<LibraryBook>).owner ?? '',
  notes: (props.initial as Partial<LibraryBook>).notes ?? '',
})

// Bind comma-separated text to array fields for ergonomic editing.
const authorsText = computed({
  get: () => form.authors.join(', '),
  set: (v: string) => {
    form.authors = v.split(',').map(s => s.trim()).filter(Boolean)
  },
})
const categoriesText = computed({
  get: () => form.categories.join(', '),
  set: (v: string) => {
    form.categories = v.split(',').map(s => s.trim()).filter(Boolean)
  },
})

const pageCountInput = computed({
  get: () => form.pageCount,
  set: (v) => {
    form.pageCount = typeof v === 'number' && !Number.isNaN(v) ? v : null
  },
})

// Re-seed when the parent swaps the book under us (e.g. opening the editor
// on a different row without unmounting).
watch(() => props.initial, (next) => {
  Object.assign(form, {
    isbn: next.isbn ?? '',
    title: next.title ?? '',
    authors: [...(next.authors ?? [])],
    publisher: next.publisher ?? '',
    publishedDate: next.publishedDate ?? '',
    description: next.description ?? '',
    pageCount: next.pageCount ?? null,
    thumbnail: next.thumbnail ?? '',
    categories: [...(next.categories ?? [])],
    language: next.language ?? '',
    provider: next.provider ?? '',
    raw: next.raw ?? null,
    read: (next as Partial<LibraryBook>).read ?? false,
    readMotivation: (next as Partial<LibraryBook>).readMotivation ?? 50,
    physicalCondition: (next as Partial<LibraryBook>).physicalCondition ?? 100,
    owner: (next as Partial<LibraryBook>).owner ?? '',
    notes: (next as Partial<LibraryBook>).notes ?? '',
  })
})

function onSave() {
  emit('save', { ...form, authors: [...form.authors], categories: [...form.categories] })
}

// --- Custom cover upload --------------------------------------------------
//
// User picks an image, we POST it as multipart to /api/library/upload, the
// server persists the bytes in the uploaded_files PostgreSQL table (so it
// survives Heroku dyno restarts), and returns the served path which we drop
// into form.thumbnail. The "Cover URL" text input is still there as the
// canonical store for the URL — it just gets filled in for the user.

const coverFileInput = ref<HTMLInputElement | null>(null)
const coverUploading = ref(false)
const coverError = ref<string | null>(null)

function triggerCoverPicker() {
  coverError.value = null
  coverFileInput.value?.click()
}

function clearCover() {
  form.thumbnail = ''
  coverError.value = null
  if (coverFileInput.value) coverFileInput.value.value = ''
}

async function onCoverFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  // Reset the input so the same filename can be re-selected after a clear.
  input.value = ''

  if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type)) {
    coverError.value = 'Use JPEG, PNG, GIF, or WebP.'
    return
  }
  if (file.size > MAX_COVER_BYTES) {
    coverError.value = `Image is too large (${Math.round(file.size / 1024 / 1024)}MB). Max is 10MB.`
    return
  }

  coverUploading.value = true
  coverError.value = null
  try {
    form.thumbnail = await libraryApi.uploadCover(file)
  } catch (err) {
    coverError.value = err instanceof Error ? err.message : 'Upload failed'
  } finally {
    coverUploading.value = false
  }
}
</script>

<style scoped>
.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-line, #d6d3d1);
  background: var(--color-paper, #fafaf9);
  color: var(--color-ink, #1c1917);
  font-size: 0.875rem;
}
.input::placeholder {
  color: var(--color-ink-lighter, #a8a29e);
}
.input:focus {
  outline: none;
  border-color: var(--color-ink, #1c1917);
}

.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: #d6d3d1;
  transition: background-color 0.2s;
}
.toggle-on {
  background: var(--color-ink, #1c1917);
}
.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.toggle-on .toggle-knob {
  transform: translateX(18px);
}
</style>
