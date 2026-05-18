<template>
  <div
    class="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div class="bg-paper border border-line w-full max-w-2xl mt-8 sm:mt-0 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-line">
        <div class="min-w-0">
          <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-1">Book details</p>
          <h3 class="text-lg font-light tracking-tight text-ink truncate">{{ heading || 'Untitled' }}</h3>
          <p v-if="subhead" class="text-xs text-ink-light truncate mt-0.5">{{ subhead }}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            @click="copyRaw"
            class="text-xs px-2 py-1 border border-line text-ink-light hover:text-ink transition-colors"
            :title="copied ? 'Copied' : 'Copy raw JSON to clipboard'"
          >
            {{ copied ? 'Copied' : 'Copy JSON' }}
          </button>
          <button @click="emit('close')" class="text-ink-lighter hover:text-ink p-1" aria-label="Close">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto p-4 sm:p-6 space-y-6">
        <!-- Cover + bibliographic grid -->
        <div class="flex gap-4 items-start">
          <img
            v-if="book.thumbnail"
            :src="book.thumbnail"
            :alt="book.title || book.isbn"
            class="w-24 h-32 sm:w-28 sm:h-36 object-cover border border-line shrink-0"
          />
          <div
            v-else
            class="w-24 h-32 sm:w-28 sm:h-36 bg-surface border border-line shrink-0 flex items-center justify-center text-[10px] tracking-widest uppercase text-ink-lighter text-center px-2"
          >
            No cover
          </div>

          <dl class="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <DetailRow label="ISBN" :value="book.isbn" mono />
            <DetailRow label="Provider" :value="book.provider || '—'" />
            <DetailRow label="Title" :value="book.title || '—'" class="sm:col-span-2" />
            <DetailRow label="Authors" :value="book.authors.length ? book.authors.join(', ') : '—'" class="sm:col-span-2" />
            <DetailRow label="Publisher" :value="book.publisher || '—'" />
            <DetailRow label="Published" :value="book.publishedDate || '—'" />
            <DetailRow label="Pages" :value="book.pageCount != null ? String(book.pageCount) : '—'" />
            <DetailRow label="Language" :value="book.language || '—'" />
          </dl>
        </div>

        <!-- Preview link (when the provider gave us one) -->
        <section v-if="previewUrl">
          <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-2">Preview</p>
          <a
            :href="previewUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-ink hover:text-ink-light underline-offset-2 hover:underline"
          >
            <span>Open on {{ previewHost || 'provider' }}</span>
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5h5v5M19 5l-9 9M5 9v10h10" />
            </svg>
          </a>
        </section>

        <!-- Categories -->
        <section v-if="book.categories.length">
          <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-2">Categories</p>
          <CategoryChips :categories="book.categories" />
        </section>

        <!-- Description -->
        <section>
          <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-2">Description</p>
          <p
            v-if="book.description"
            class="text-sm font-light leading-relaxed text-ink-light whitespace-pre-line"
          >
            {{ book.description }}
          </p>
          <p v-else class="text-sm font-light italic text-ink-lighter leading-relaxed">
            No description was returned for this ISBN{{ book.provider ? ` by ${book.provider}` : '' }}.
            You can paste your own via the edit pencil on the book row.
          </p>
        </section>

        <!-- Personal fields (only when present — saved books) -->
        <section v-if="hasPersonal">
          <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-2">Your appraisal</p>
          <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <DetailRow label="Read" :value="bookAsSaved.read ? 'Yes' : 'No'" />
            <DetailRow label="Want" :value="`${bookAsSaved.readMotivation} / 100`" />
            <DetailRow label="Condition" :value="`${bookAsSaved.physicalCondition} / 100`" />
            <DetailRow label="Owner" :value="bookAsSaved.owner || '—'" />
            <DetailRow v-if="bookAsSaved.notes" label="Notes" :value="bookAsSaved.notes" class="sm:col-span-4" />
          </dl>
        </section>

        <!-- Collapsible raw provider response -->
        <details class="border border-line">
          <summary class="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-widest text-ink-lighter hover:text-ink select-none">
            Raw provider response
          </summary>
          <pre class="json-pre">{{ pretty }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LibraryBook, LibraryBookLookup } from '@shared/LibraryBook'
import DetailRow from './DetailRow.vue'
import CategoryChips from './CategoryChips.vue'

const props = defineProps<{
  /** Saved book or fresh lookup result. */
  book: LibraryBook | LibraryBookLookup
  heading: string
  subhead?: string
}>()

const emit = defineEmits<{ close: [] }>()

const bookAsSaved = computed(() => props.book as LibraryBook)
const hasPersonal = computed(() => {
  const b = props.book as Partial<LibraryBook>
  return typeof b.readMotivation === 'number'
})

/**
 * Pull a "read more / preview" URL out of the raw provider payload.
 * Google Books exposes `volumeInfo.previewLink` (preview, may say "no
 * preview available" but still a useful landing page) and `infoLink`;
 * @library-pals/isbn exposes a flat `link`. Returns null when none of
 * those are present.
 */
const previewUrl = computed<string | null>(() => {
  const raw = props.book.raw
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, any>
  const volume = r.volumeInfo as Record<string, unknown> | undefined
  const access = r.accessInfo as Record<string, unknown> | undefined
  const candidates = [
    typeof volume?.previewLink === 'string' ? volume.previewLink : '',
    typeof volume?.infoLink === 'string' ? volume.infoLink : '',
    typeof volume?.canonicalVolumeLink === 'string' ? volume.canonicalVolumeLink : '',
    typeof access?.webReaderLink === 'string' ? access.webReaderLink : '',
    typeof r.link === 'string' ? r.link : '',
  ]
  for (const c of candidates) {
    if (c && /^https?:\/\//i.test(c)) return c
  }
  return null
})

/** Hostname for the link label, so the user can see where they're going. */
const previewHost = computed<string>(() => {
  if (!previewUrl.value) return ''
  try { return new URL(previewUrl.value).hostname.replace(/^www\./, '') }
  catch { return '' }
})

const rawForJson = computed(() => props.book.raw ?? {
  isbn: props.book.isbn,
  title: props.book.title,
  authors: props.book.authors,
  publisher: props.book.publisher,
  publishedDate: props.book.publishedDate,
  description: props.book.description,
  pageCount: props.book.pageCount,
  thumbnail: props.book.thumbnail,
  categories: props.book.categories,
  language: props.book.language,
  provider: props.book.provider,
})

const pretty = computed(() => {
  try { return JSON.stringify(rawForJson.value, null, 2) }
  catch { return String(rawForJson.value) }
})

const copied = ref(false)
async function copyRaw() {
  try {
    await navigator.clipboard.writeText(pretty.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // Clipboard access can be blocked — silent fail is fine for a preview.
  }
}
</script>

<style scoped>
.json-pre {
  margin: 0;
  max-height: 40vh;
  overflow: auto;
  padding: 0.75rem 1rem;
  background: var(--color-surface, #f5f5f4);
  border-top: 1px solid var(--color-line, #d6d3d1);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  line-height: 1.4;
  color: var(--color-ink-light, #57534e);
  white-space: pre;
}
</style>
