<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
    @click.self="closeIfSetup"
  >
    <!-- ============ STAGE 1 — Setup ============ -->
    <div
      v-if="stage === 'setup'"
      class="bg-paper w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded shadow-lg p-6 space-y-6"
    >
      <div>
        <h3 class="text-xl font-light tracking-tight">Preview as a book</h3>
        <p class="text-sm text-ink-light mt-1">
          Choose what to include, optionally add cover artwork, then open the book.
          Double-tap the cover to open it. From an open spread, double-tap the
          right page to turn forward, the left page to turn back.
        </p>
      </div>

      <!-- Sections / items -->
      <fieldset class="space-y-3">
        <legend class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">
          Chapters &amp; items
        </legend>

        <div class="flex items-center gap-3 text-xs">
          <button type="button" class="text-ink-light hover:text-ink underline" @click="selectAll">Select all</button>
          <span class="text-ink-lighter">·</span>
          <button type="button" class="text-ink-light hover:text-ink underline" @click="clearAll">Clear all</button>
        </div>

        <div v-if="!sections.length && !unassignedItems.length" class="text-sm italic text-ink-lighter">
          Nothing in the spine yet.
        </div>

        <ul class="space-y-3">
          <li v-for="s in sortedSections" :key="s.id" class="border border-line rounded-sm p-3">
            <label class="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                :checked="isSectionFullySelected(s.id)"
                :indeterminate.prop="isSectionPartiallySelected(s.id)"
                @change="onSectionCheckboxChange(s.id, $event)"
                class="mt-1 rounded border-line text-ink focus:ring-ink"
              />
              <span class="text-sm flex-1">
                <span class="font-medium block">{{ s.title || 'Untitled section' }}</span>
                <span class="text-ink-lighter text-xs">
                  {{ (itemsBySection.get(s.id) || []).length }} item(s) · chapter
                </span>
              </span>
            </label>

            <ul v-if="(itemsBySection.get(s.id) || []).length" class="mt-2 ml-7 space-y-1">
              <li v-for="it in (itemsBySection.get(s.id) || [])" :key="it.id">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="selectedItemIds"
                    :value="it.id"
                    class="rounded border-line text-ink focus:ring-ink"
                  />
                  <span class="text-ink-light truncate">
                    {{ it.title || 'Untitled' }}
                    <span class="text-ink-lighter text-xs italic">· {{ it.itemType }}</span>
                  </span>
                </label>
              </li>
            </ul>
          </li>

          <li v-if="unassignedItems.length" class="border border-line rounded-sm p-3">
            <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Unassigned</span>
            <ul class="mt-2 space-y-1">
              <li v-for="it in unassignedItems" :key="it.id">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="selectedItemIds"
                    :value="it.id"
                    class="rounded border-line text-ink focus:ring-ink"
                  />
                  <span class="text-ink-light truncate">
                    {{ it.title || 'Untitled' }}
                    <span class="text-ink-lighter text-xs italic">· {{ it.itemType }}</span>
                  </span>
                </label>
              </li>
            </ul>
          </li>
        </ul>
      </fieldset>

      <!-- Layout options -->
      <fieldset class="space-y-2">
        <legend class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">Layout</legend>
        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="opts.includeFrontMatter" type="checkbox" class="mt-1 rounded border-line text-ink focus:ring-ink" />
          <span class="text-sm">
            <span class="font-medium block">Title page &amp; literary direction</span>
            <span class="text-ink-light">Half-title, title page, central question, through-line.</span>
          </span>
        </label>
        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="opts.includeToc" type="checkbox" class="mt-1 rounded border-line text-ink focus:ring-ink" />
          <span class="text-sm">
            <span class="font-medium block">Table of contents</span>
            <span class="text-ink-light">A contents page listing each chapter.</span>
          </span>
        </label>
        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="opts.chapterTitlePages" type="checkbox" class="mt-1 rounded border-line text-ink focus:ring-ink" />
          <span class="text-sm">
            <span class="font-medium block">Chapter title pages</span>
            <span class="text-ink-light">Each chapter starts on its own page with a centered title.</span>
          </span>
        </label>
      </fieldset>

      <!-- Covers -->
      <fieldset class="space-y-3">
        <legend class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">Covers</legend>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium block mb-1">Front cover image</span>
            <input type="file" accept="image/*" @change="onFrontCoverChosen" class="block text-sm" />
            <span v-if="frontCoverUrl" class="text-xs text-ink-lighter">Loaded.</span>
          </label>

          <label class="block">
            <span class="text-sm font-medium block mb-1">Back cover image</span>
            <input type="file" accept="image/*" @change="onBackCoverChosen" class="block text-sm" />
            <span v-if="backCoverUrl" class="text-xs text-ink-lighter">Loaded.</span>
          </label>
        </div>

        <label class="block">
          <span class="text-sm font-medium block mb-1">
            Cover image transparency: <span class="text-ink-lighter">{{ Math.round(opts.coverOpacity * 100) }}%</span>
          </span>
          <input
            v-model.number="opts.coverOpacity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="w-full"
          />
          <span class="block text-xs text-ink-lighter mt-1">
            Lower values let the book&rsquo;s base colour show through the artwork.
          </span>
        </label>
      </fieldset>

      <div v-if="loadError" class="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
        {{ loadError }}
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <button
          type="button"
          @click="$emit('close')"
          class="px-4 py-2 text-sm tracking-wide font-sans text-ink-light hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="loadingBodies || selectedItemIds.length === 0"
          @click="openBook"
          class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors disabled:opacity-50"
        >
          {{ loadingBodies ? 'Loading…' : 'Open book' }}
        </button>
      </div>
    </div>

    <!-- ============ STAGE 2 — Book ============ -->
    <div
      v-else-if="stage === 'book'"
      class="bp-stage"
      @click.self="$emit('close')"
    >
      <!-- Top bar -->
      <div class="bp-topbar">
        <button type="button" class="bp-btn" @click="stage = 'setup'">&larr; Options</button>
        <div class="bp-progress">
          <span v-if="bookState === 'closed-front'">Front cover</span>
          <span v-else-if="bookState === 'closed-back'">Back cover</span>
          <span v-else>Pages {{ currentSpread.left + 1 }}&ndash;{{ currentSpread.right + 1 }} of {{ totalPages }}</span>
        </div>
        <button type="button" class="bp-btn" @click="$emit('close')">Close</button>
      </div>

      <!-- Book stage -->
      <div class="bp-book-wrap">
        <!-- Closed front cover -->
        <div
          v-if="bookState === 'closed-front'"
          class="bp-cover bp-cover-front"
          :style="{ width: pageWidth + 'px', height: pageHeight + 'px' }"
          @dblclick="openFromFront"
        >
          <div class="bp-cover-bg" :style="frontCoverBgStyle"></div>
          <div class="bp-cover-content">
            <h2 class="bp-cover-title">{{ manuscript.title }}</h2>
            <p v-if="manuscript.workingSubtitle" class="bp-cover-subtitle">
              {{ manuscript.workingSubtitle }}
            </p>
            <p class="bp-cover-hint">Double-tap to open</p>
          </div>
          <div class="bp-cover-spine"></div>
        </div>

        <!-- Open spread -->
        <div
          v-else-if="bookState === 'open'"
          class="bp-spread"
          :style="{
            width: (pageWidth * 2) + 'px',
            height: pageHeight + 'px',
          }"
        >
          <div class="bp-page bp-page-left" @dblclick="prevSpread">
            <div class="bp-page-inner" v-if="pages[currentSpread.left]" v-html="pages[currentSpread.left].html"></div>
            <div class="bp-page-inner" v-else>
              <div class="bp-page-blank"></div>
            </div>
            <div class="bp-page-num" v-if="pages[currentSpread.left]">{{ currentSpread.left + 1 }}</div>
          </div>
          <div class="bp-spine-shadow"></div>
          <div class="bp-page bp-page-right" @dblclick="nextSpread">
            <div class="bp-page-inner" v-if="pages[currentSpread.right]" v-html="pages[currentSpread.right].html"></div>
            <div class="bp-page-inner" v-else>
              <div class="bp-page-blank"></div>
            </div>
            <div class="bp-page-num" v-if="pages[currentSpread.right]">{{ currentSpread.right + 1 }}</div>
          </div>
        </div>

        <!-- Closed back cover -->
        <div
          v-else-if="bookState === 'closed-back'"
          class="bp-cover bp-cover-back"
          :style="{ width: pageWidth + 'px', height: pageHeight + 'px' }"
          @dblclick="reopenFromBack"
        >
          <div class="bp-cover-bg" :style="backCoverBgStyle"></div>
          <div class="bp-cover-content">
            <p class="bp-cover-back-title">{{ manuscript.title }}</p>
            <p class="bp-cover-hint">Double-tap to return</p>
          </div>
          <div class="bp-cover-spine bp-cover-spine-back"></div>
        </div>
      </div>

      <!-- Hidden measurement layer used to paginate every chapter via CSS columns -->
      <div class="bp-measure" aria-hidden="true">
        <div
          ref="measureContainer"
          class="bp-measure-flow"
          :style="{
            width: contentWidth + 'px',
            height: contentHeight + 'px',
            columnWidth: contentWidth + 'px',
          }"
          v-html="bookFlowHtml"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { api } from '../../api/client'
import { renderMarkdown } from '../../utils/markdown'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
  ManuscriptProject,
  ManuscriptSection,
  ManuscriptItem,
} from '@shared/Manuscript'
import type { WritingBlock } from '../../domain/WritingBlock'

const props = defineProps<{
  open: boolean
  manuscript: ManuscriptProject
  sections: ManuscriptSection[]
  items: ManuscriptItem[]
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const stage = ref<'setup' | 'book'>('setup')
const bookState = ref<'closed-front' | 'open' | 'closed-back'>('closed-front')

const pageWidth = 380
const pageHeight = 560
// Page padding (must match `.bp-page-inner` inset below). The flow that does
// the actual CSS-column pagination is sized to the content box, not the page.
const padX = 32
const padY = 36
const contentWidth = pageWidth - padX * 2
const contentHeight = pageHeight - padY * 2

const sortedSections = computed(() =>
  [...props.sections].sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
)

const itemsBySection = computed(() => {
  const map = new Map<string, ManuscriptItem[]>()
  for (const s of props.sections) map.set(s.id, [])
  for (const it of props.items) {
    if (it.sectionId && map.has(it.sectionId)) map.get(it.sectionId)!.push(it)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
  }
  return map
})

const unassignedItems = computed(() =>
  props.items
    .filter(i => !i.sectionId || !props.sections.some(s => s.id === i.sectionId))
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
)

const allSelectableItemIds = computed(() => [
  ...sortedSections.value.flatMap(s => (itemsBySection.value.get(s.id) || []).map(i => i.id)),
  ...unassignedItems.value.map(i => i.id),
])

const selectedItemIds = ref<string[]>([])

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      stage.value = 'setup'
      bookState.value = 'closed-front'
      currentSpreadIndex.value = 0
      // Default: select everything.
      selectedItemIds.value = [...allSelectableItemIds.value]
    }
  },
  { immediate: true },
)

function selectAll() {
  selectedItemIds.value = [...allSelectableItemIds.value]
}
function clearAll() {
  selectedItemIds.value = []
}
function isSectionFullySelected(sectionId: string): boolean {
  const ids = (itemsBySection.value.get(sectionId) || []).map(i => i.id)
  return ids.length > 0 && ids.every(id => selectedItemIds.value.includes(id))
}
function isSectionPartiallySelected(sectionId: string): boolean {
  const ids = (itemsBySection.value.get(sectionId) || []).map(i => i.id)
  const selected = ids.filter(id => selectedItemIds.value.includes(id)).length
  return selected > 0 && selected < ids.length
}
function onSectionCheckboxChange(sectionId: string, ev: Event) {
  const target = ev.target as HTMLInputElement
  toggleSection(sectionId, target.checked)
}

function toggleSection(sectionId: string, on: boolean) {
  const ids = (itemsBySection.value.get(sectionId) || []).map(i => i.id)
  if (on) {
    const merged = new Set([...selectedItemIds.value, ...ids])
    selectedItemIds.value = [...merged]
  } else {
    const drop = new Set(ids)
    selectedItemIds.value = selectedItemIds.value.filter(id => !drop.has(id))
  }
}

// ---- Layout options ----
const opts = ref({
  includeFrontMatter: true,
  includeToc: true,
  chapterTitlePages: true,
  coverOpacity: 0.85,
})

// ---- Cover images (loaded as data URLs so the preview is fully local) ----
const frontCoverUrl = ref<string | null>(null)
const backCoverUrl = ref<string | null>(null)

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

async function onFrontCoverChosen(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  frontCoverUrl.value = await readFileAsDataUrl(f)
}
async function onBackCoverChosen(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  backCoverUrl.value = await readFileAsDataUrl(f)
}

const frontCoverBgStyle = computed(() => {
  if (!frontCoverUrl.value) return { background: '#3a2f24' }
  return {
    backgroundImage: `url('${frontCoverUrl.value}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: opts.value.coverOpacity,
  }
})
const backCoverBgStyle = computed(() => {
  if (!backCoverUrl.value) return { background: '#3a2f24' }
  return {
    backgroundImage: `url('${backCoverUrl.value}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: opts.value.coverOpacity,
  }
})

// ---- Loading essay bodies on demand ----
const loadingBodies = ref(false)
const loadError = ref<string | null>(null)
const bodyById = ref<Map<string, string>>(new Map())

async function loadBodiesForSelected(): Promise<void> {
  loadingBodies.value = true
  loadError.value = null
  try {
    const essayItems = props.items.filter(
      it => selectedItemIds.value.includes(it.id) && it.itemType === 'essay' && it.writingBlockId,
    )
    const need = essayItems
      .map(it => it.writingBlockId!)
      .filter(id => !bodyById.value.has(id))
    const fresh = await Promise.all(
      need.map(id =>
        api
          .get<ApiResponse<WritingBlock>>(`/writing/${id}`)
          .then(r => ({ id, body: r.data?.body || '' }))
          .catch(() => ({ id, body: '' })),
      ),
    )
    const next = new Map(bodyById.value)
    for (const { id, body } of fresh) next.set(id, body)
    bodyById.value = next
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load essay content'
  } finally {
    loadingBodies.value = false
  }
}

// ---- Build the book's HTML flow (front matter + chapters) ----
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const bookFlowHtml = computed(() => {
  if (stage.value !== 'book') return ''
  const m = props.manuscript
  const parts: string[] = []

  // -- Front matter --
  if (opts.value.includeFrontMatter) {
    parts.push(
      `<section class="bp-frontmatter bp-page-break-after">
         <div class="bp-half-title">${escapeHtml(m.title)}</div>
       </section>`,
    )
    const dirBits: string[] = []
    if (m.centralQuestion) dirBits.push(`<p><em>Central question.</em> ${escapeHtml(m.centralQuestion)}</p>`)
    if (m.throughLine) dirBits.push(`<p><em>Through-line.</em> ${escapeHtml(m.throughLine)}</p>`)
    if (m.emotionalArc) dirBits.push(`<p><em>Emotional arc.</em> ${escapeHtml(m.emotionalArc)}</p>`)
    if (m.narrativePromise) dirBits.push(`<p><em>Narrative promise.</em> ${escapeHtml(m.narrativePromise)}</p>`)
    parts.push(
      `<section class="bp-titlepage bp-page-break-after">
         <h1 class="bp-book-title">${escapeHtml(m.title)}</h1>
         ${m.workingSubtitle ? `<p class="bp-book-subtitle">${escapeHtml(m.workingSubtitle)}</p>` : ''}
         ${dirBits.length ? `<div class="bp-direction">${dirBits.join('')}</div>` : ''}
       </section>`,
    )
  }

  // -- Determine the chapter list from selected items, grouped by section --
  const selSet = new Set(selectedItemIds.value)
  const chapters: { title: string; items: ManuscriptItem[] }[] = []
  for (const s of sortedSections.value) {
    const list = (itemsBySection.value.get(s.id) || []).filter(i => selSet.has(i.id))
    if (list.length) chapters.push({ title: s.title || 'Untitled', items: list })
  }
  const orphans = unassignedItems.value.filter(i => selSet.has(i.id))
  if (orphans.length) chapters.push({ title: 'Other', items: orphans })

  // -- Table of contents --
  if (opts.value.includeToc && chapters.length) {
    const lis = chapters
      .map(
        (c, i) => `<li><span class="bp-toc-num">${i + 1}.</span> ${escapeHtml(c.title)}</li>`,
      )
      .join('')
    parts.push(
      `<section class="bp-toc bp-page-break-after">
         <h2 class="bp-h2">Contents</h2>
         <ol class="bp-toc-list">${lis}</ol>
       </section>`,
    )
  }

  // -- Chapters --
  for (let ci = 0; ci < chapters.length; ci++) {
    const c = chapters[ci]
    const titleBlock = opts.value.chapterTitlePages
      ? `<section class="bp-chapter-title bp-page-break-before bp-page-break-after">
           <span class="bp-chapter-num">Chapter ${ci + 1}</span>
           <h2 class="bp-chapter-h">${escapeHtml(c.title)}</h2>
         </section>`
      : `<h2 class="bp-h2 bp-page-break-before">${escapeHtml(c.title)}</h2>`
    parts.push(titleBlock)

    for (const it of c.items) {
      let inner = ''
      if (it.itemType === 'essay' && it.writingBlockId) {
        const body = bodyById.value.get(it.writingBlockId) || ''
        const rendered = body ? renderMarkdown(body) : '<p><em>(Essay body not loaded.)</em></p>'
        inner =
          `<h3 class="bp-h3">${escapeHtml(it.title || 'Untitled')}</h3>` + rendered
      } else if (it.itemType === 'placeholder') {
        inner =
          `<h3 class="bp-h3">${escapeHtml(it.title || 'Untitled')}</h3>` +
          `<p class="bp-placeholder"><em>${escapeHtml(it.summary || 'Placeholder — not yet written.')}</em></p>`
      } else if (it.itemType === 'bridge') {
        inner =
          `<div class="bp-bridge"><p><em>${escapeHtml(it.title || 'Bridge')}</em></p>` +
          (it.summary ? `<p>${escapeHtml(it.summary)}</p>` : '') +
          `</div>`
      } else {
        inner =
          `<h3 class="bp-h3">${escapeHtml(it.title || 'Untitled')}</h3>` +
          (it.summary ? `<p>${escapeHtml(it.summary)}</p>` : '')
      }
      parts.push(`<article class="bp-item">${inner}</article>`)
    }
  }

  return parts.join('\n')
})

// ---- Pagination (CSS columns, measured) ----
const measureContainer = ref<HTMLElement | null>(null)
const pages = ref<{ html: string }[]>([])
const currentSpreadIndex = ref(0)

const totalPages = computed(() => pages.value.length)
const totalSpreads = computed(() => Math.max(1, Math.ceil(totalPages.value / 2)))
const currentSpread = computed(() => ({
  left: currentSpreadIndex.value * 2,
  right: currentSpreadIndex.value * 2 + 1,
}))

async function paginate() {
  await nextTick()
  const el = measureContainer.value
  if (!el) {
    pages.value = []
    return
  }
  // Force layout to settle (images, fonts) then read scrollWidth.
  // The flow uses column-width = pageWidth + height = pageHeight, so the
  // browser splits into N columns of pageWidth, and scrollWidth ~= N * pageWidth.
  await new Promise(r => requestAnimationFrame(() => r(null)))
  await new Promise(r => requestAnimationFrame(() => r(null)))
  const total = el.scrollWidth
  const count = Math.max(1, Math.round(total / contentWidth))

  // Each page re-renders the full flow at width = count * contentWidth so that
  // every column is laid out side-by-side and positioned. The surrounding
  // .bp-page-inner is overflow:hidden and only contentWidth wide, clipping
  // everything except the column the inner flow's translateX scrolls into view.
  const flowWidth = count * contentWidth
  const flowHtml = el.innerHTML
  const out: { html: string }[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      html:
        `<div class="bp-page-flow" style="width:${flowWidth}px;height:${contentHeight}px;column-width:${contentWidth}px;column-gap:0;column-fill:auto;transform:translateX(-${i * contentWidth}px);">` +
        flowHtml +
        `</div>`,
    })
  }
  pages.value = out
}

watch(
  [bookFlowHtml, () => stage.value],
  async ([html, st]) => {
    if (st === 'book' && html) {
      await paginate()
    }
  },
)

async function openBook() {
  await loadBodiesForSelected()
  if (loadError.value) return
  stage.value = 'book'
  bookState.value = 'closed-front'
  currentSpreadIndex.value = 0
  // Pagination triggers via the watcher once bookFlowHtml is computed.
}

function openFromFront() {
  bookState.value = 'open'
  currentSpreadIndex.value = 0
}

function reopenFromBack() {
  bookState.value = 'open'
  currentSpreadIndex.value = totalSpreads.value - 1
}

function nextSpread() {
  if (currentSpreadIndex.value < totalSpreads.value - 1) {
    currentSpreadIndex.value++
  } else {
    bookState.value = 'closed-back'
  }
}
function prevSpread() {
  if (currentSpreadIndex.value > 0) {
    currentSpreadIndex.value--
  } else {
    bookState.value = 'closed-front'
  }
}

function closeIfSetup() {
  if (stage.value === 'setup') emit('close')
}
</script>

<style scoped>
/* ============ Stage / scaffolding ============ */
.bp-stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at center, #2a2620 0%, #100d0a 70%, #050403 100%);
}

.bp-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  color: #d6cdbf;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 0.85rem;
  background: rgba(0, 0, 0, 0.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.bp-btn {
  background: transparent;
  color: #d6cdbf;
  padding: 0.35rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 2px;
  cursor: pointer;
}
.bp-btn:hover { border-color: rgba(255, 255, 255, 0.4); }
.bp-progress {
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.7rem;
  color: #b6ad9f;
}

.bp-book-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ============ Cover (closed) ============ */
.bp-cover {
  position: relative;
  border-radius: 4px 8px 8px 4px;
  box-shadow:
    0 30px 60px -20px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(0, 0, 0, 0.6) inset;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: transform 250ms ease;
}
.bp-cover:hover { transform: translateY(-2px); }
.bp-cover-back { border-radius: 8px 4px 4px 8px; }

.bp-cover-bg {
  position: absolute;
  inset: 0;
  background: #3a2f24;
}
.bp-cover-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  color: #f4ecdd;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
}
.bp-cover-title {
  font-family: ui-serif, Georgia, serif;
  font-size: 1.6rem;
  font-weight: 300;
  letter-spacing: 0.04em;
  line-height: 1.25;
}
.bp-cover-subtitle {
  font-style: italic;
  margin-top: 0.5rem;
  opacity: 0.9;
}
.bp-cover-hint {
  position: absolute;
  bottom: 1rem;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(244, 236, 221, 0.65);
}
.bp-cover-back-title {
  font-family: ui-serif, Georgia, serif;
  font-style: italic;
  font-size: 1rem;
  letter-spacing: 0.04em;
}

.bp-cover-spine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 14px;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.55),
    rgba(0, 0, 0, 0.15) 70%,
    transparent
  );
}
.bp-cover-spine-back {
  left: auto;
  right: 0;
  background: linear-gradient(
    to left,
    rgba(0, 0, 0, 0.55),
    rgba(0, 0, 0, 0.15) 70%,
    transparent
  );
}

/* ============ Spread ============ */
.bp-spread {
  display: flex;
  position: relative;
  background: #1a1612;
  box-shadow:
    0 30px 70px -20px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  overflow: hidden;
}

.bp-page {
  position: relative;
  flex: 1 1 50%;
  background: #f4ecdd;
  color: #1f1a14;
  user-select: text;
  cursor: pointer;
  overflow: hidden;
}
.bp-page-left {
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  background:
    linear-gradient(to right, rgba(0, 0, 0, 0.06), transparent 4%, transparent 96%, rgba(0, 0, 0, 0.06)),
    #f4ecdd;
}
.bp-page-right {
  background:
    linear-gradient(to right, rgba(0, 0, 0, 0.06), transparent 4%, transparent 96%, rgba(0, 0, 0, 0.06)),
    #f4ecdd;
}
.bp-spine-shadow {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 30px;
  transform: translateX(-50%);
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.32) 0%,
    rgba(0, 0, 0, 0) 70%
  );
}

.bp-page-inner {
  position: absolute;
  inset: 36px 32px 36px 32px;
  overflow: hidden;
}

.bp-page-num {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: ui-serif, Georgia, serif;
  font-size: 0.75rem;
  color: #5a4f3f;
}

.bp-page-blank {
  width: 100%;
  height: 100%;
}

/* The actual paginated flow lives inside .bp-page-inner via v-html. */
.bp-page-inner :deep(.bp-page-flow) {
  /* width/height/transform set inline; columns split content into pageWidth columns */
  overflow: hidden;
  font-family: ui-serif, Georgia, "Iowan Old Style", serif;
  font-size: 0.95rem;
  line-height: 1.55;
  color: #1f1a14;
  /* Reserve outer padding via .bp-page-inner; the flow itself is
     pageWidth × pageHeight then translated into view. We compensate the
     page padding by shrinking the flow block. */
  padding: 0;
}

/* Typographic styles inside the page flow */
.bp-page-inner :deep(h1),
.bp-page-inner :deep(h2),
.bp-page-inner :deep(h3) {
  font-family: ui-serif, Georgia, serif;
  font-weight: 400;
  break-inside: avoid;
}
.bp-page-inner :deep(.bp-h2) { font-size: 1.4rem; margin: 0 0 0.6rem 0; }
.bp-page-inner :deep(.bp-h3) { font-size: 1.1rem; margin: 1rem 0 0.4rem 0; font-style: italic; }
.bp-page-inner :deep(p) {
  margin: 0 0 0.6rem 0;
  text-align: justify;
  hyphens: auto;
}
.bp-page-inner :deep(p + p) { text-indent: 1.2em; margin-top: 0; }

.bp-page-inner :deep(.bp-half-title) {
  text-align: center;
  margin-top: 40%;
  font-family: ui-serif, Georgia, serif;
  font-size: 1.25rem;
  letter-spacing: 0.06em;
}
.bp-page-inner :deep(.bp-titlepage) {
  text-align: center;
  padding-top: 18%;
}
.bp-page-inner :deep(.bp-book-title) {
  font-family: ui-serif, Georgia, serif;
  font-size: 1.8rem;
  font-weight: 300;
  margin: 0 0 0.4rem 0;
}
.bp-page-inner :deep(.bp-book-subtitle) {
  font-style: italic;
  font-size: 1.05rem;
  color: #4a4030;
}
.bp-page-inner :deep(.bp-direction) {
  margin-top: 2rem;
  text-align: left;
  font-size: 0.85rem;
  color: #3a3022;
}
.bp-page-inner :deep(.bp-toc) { padding-top: 8%; }
.bp-page-inner :deep(.bp-toc-list) {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  font-size: 0.95rem;
}
.bp-page-inner :deep(.bp-toc-list li) { margin: 0.35rem 0; }
.bp-page-inner :deep(.bp-toc-num) {
  display: inline-block;
  width: 1.6em;
  color: #6a5f4d;
}
.bp-page-inner :deep(.bp-chapter-title) {
  text-align: center;
  padding-top: 30%;
  break-before: column;
}
.bp-page-inner :deep(.bp-chapter-num) {
  display: block;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #6a5f4d;
  margin-bottom: 0.5rem;
}
.bp-page-inner :deep(.bp-chapter-h) {
  font-family: ui-serif, Georgia, serif;
  font-size: 1.6rem;
  font-weight: 300;
  margin: 0;
}
.bp-page-inner :deep(.bp-page-break-before) { break-before: column; }
.bp-page-inner :deep(.bp-page-break-after)  { break-after: column; }
.bp-page-inner :deep(.bp-bridge) {
  margin: 0.6rem 1.2rem;
  padding: 0.6rem 0;
  border-top: 1px solid #c7bfae;
  border-bottom: 1px solid #c7bfae;
  text-align: center;
  font-style: italic;
}
.bp-page-inner :deep(.bp-placeholder) { font-style: italic; color: #6a5f4d; }
.bp-page-inner :deep(blockquote) {
  margin: 0.6rem 1.2rem;
  font-style: italic;
  color: #3a3022;
}
.bp-page-inner :deep(em) { font-style: italic; }
.bp-page-inner :deep(strong) { font-weight: 600; }

/* Hidden measurement layer (kept off-screen but laid out for measurement) */
.bp-measure {
  position: fixed;
  top: -10000px;
  left: -10000px;
  visibility: hidden;
  pointer-events: none;
}
.bp-measure-flow {
  /* width/height/columnWidth set inline; identical typography to the page flow */
  column-gap: 0;
  column-fill: auto;
  font-family: ui-serif, Georgia, "Iowan Old Style", serif;
  font-size: 0.95rem;
  line-height: 1.55;
  overflow: hidden;
}
</style>
