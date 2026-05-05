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
          Tap the cover to open it. From an open spread, tap the right page to
          turn forward, the left page to turn back.
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

      <!-- Type size -->
      <fieldset class="space-y-2">
        <legend class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">Type</legend>
        <label class="block">
          <span class="text-sm font-medium block mb-1">
            Body font size: <span class="text-ink-lighter">{{ bookFontSize }} px</span>
          </span>
          <input
            v-model.number="bookFontSize"
            type="range"
            min="11"
            max="22"
            step="1"
            class="w-full"
          />
          <span class="block text-xs text-ink-lighter mt-1">
            12&ndash;14&thinsp;px reads like a paperback. Larger sizes mimic large-print editions.
          </span>
        </label>
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

        <!-- Author name -->
        <label class="block">
          <span class="text-sm font-medium block mb-1">Author name</span>
          <input
            v-model.trim="opts.coverAuthor"
            type="text"
            placeholder="e.g. R. D. Clark"
            class="block w-full px-2 py-1 text-sm border border-line rounded-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink"
          />
          <span class="block text-xs text-ink-lighter mt-1">
            Appears on the front cover and beneath the title on the back. Leave blank to omit.
          </span>
        </label>

        <!-- Title: position, size, colour, alignment -->
        <div class="space-y-2 border border-line rounded-sm p-3">
          <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Title</span>

          <label class="block">
            <span class="text-sm font-medium block mb-1">
              Vertical position: <span class="text-ink-lighter">{{ opts.coverTitleY }}% from top</span>
            </span>
            <input
              v-model.number="opts.coverTitleY"
              type="range"
              min="5"
              max="95"
              step="1"
              class="w-full"
            />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-sm font-medium block mb-1">
                Size: <span class="text-ink-lighter">{{ opts.coverTitleSize }} px</span>
              </span>
              <input
                v-model.number="opts.coverTitleSize"
                type="range"
                min="12"
                max="72"
                step="1"
                class="w-full"
              />
            </label>
            <label class="block">
              <span class="text-sm font-medium block mb-1">Colour</span>
              <input
                v-model="opts.coverTitleColor"
                type="color"
                class="block w-full h-8 p-0 border border-line rounded-sm cursor-pointer bg-paper"
              />
            </label>
          </div>

          <div>
            <span class="text-sm font-medium block mb-1">Alignment</span>
            <div class="inline-flex border border-line rounded-sm overflow-hidden text-sm">
              <button
                v-for="a in ['left', 'center', 'right'] as const"
                :key="a"
                type="button"
                @click="opts.coverTitleAlign = a"
                :class="[
                  'px-3 py-1 capitalize transition-colors',
                  opts.coverTitleAlign === a
                    ? 'bg-ink text-paper'
                    : 'bg-paper text-ink-light hover:text-ink',
                ]"
              >
                {{ a }}
              </button>
            </div>
          </div>
        </div>

        <!-- Author: position, size, colour, alignment -->
        <div
          class="space-y-2 border border-line rounded-sm p-3"
          :class="{ 'opacity-50 pointer-events-none': !opts.coverAuthor }"
        >
          <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Author</span>

          <label class="block">
            <span class="text-sm font-medium block mb-1">
              Vertical position: <span class="text-ink-lighter">{{ opts.coverAuthorY }}% from top</span>
            </span>
            <input
              v-model.number="opts.coverAuthorY"
              type="range"
              min="5"
              max="95"
              step="1"
              :disabled="!opts.coverAuthor"
              class="w-full"
            />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-sm font-medium block mb-1">
                Size: <span class="text-ink-lighter">{{ opts.coverAuthorSize }} px</span>
              </span>
              <input
                v-model.number="opts.coverAuthorSize"
                type="range"
                min="10"
                max="48"
                step="1"
                :disabled="!opts.coverAuthor"
                class="w-full"
              />
            </label>
            <label class="block">
              <span class="text-sm font-medium block mb-1">Colour</span>
              <input
                v-model="opts.coverAuthorColor"
                type="color"
                :disabled="!opts.coverAuthor"
                class="block w-full h-8 p-0 border border-line rounded-sm cursor-pointer bg-paper"
              />
            </label>
          </div>

          <div>
            <span class="text-sm font-medium block mb-1">Alignment</span>
            <div class="inline-flex border border-line rounded-sm overflow-hidden text-sm">
              <button
                v-for="a in ['left', 'center', 'right'] as const"
                :key="a"
                type="button"
                @click="opts.coverAuthorAlign = a"
                :disabled="!opts.coverAuthor"
                :class="[
                  'px-3 py-1 capitalize transition-colors',
                  opts.coverAuthorAlign === a
                    ? 'bg-ink text-paper'
                    : 'bg-paper text-ink-light hover:text-ink',
                ]"
              >
                {{ a }}
              </button>
            </div>
          </div>
          <span class="block text-xs text-ink-lighter">
            Only used when an author name is set above.
          </span>
        </div>

        <!-- Back cover text -->
        <div class="space-y-2">
          <label class="block">
            <span class="text-sm font-medium block mb-1">Back cover text</span>
            <textarea
              v-model="opts.coverBackText"
              rows="4"
              placeholder="Blurb, quote, dedication — anything you'd like on the back cover."
              class="block w-full px-2 py-1 text-sm border border-line rounded-sm bg-paper focus:outline-none focus:ring-1 focus:ring-ink resize-y leading-snug"
            ></textarea>
            <span class="block text-xs text-ink-lighter mt-1">
              Appears between the title and author on the back cover. Line breaks are preserved; the size auto-fits.
            </span>
          </label>

          <label class="block max-w-xs" :class="{ 'opacity-50': !opts.coverBackText }">
            <span class="text-sm font-medium block mb-1">Back text colour</span>
            <input
              v-model="opts.coverBackTextColor"
              type="color"
              :disabled="!opts.coverBackText"
              class="block w-full h-8 p-0 border border-line rounded-sm cursor-pointer bg-paper"
            />
          </label>
        </div>
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
          <span v-else>{{ progressLabel }}</span>
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
          @click="openFromFront"
        >
          <div class="bp-cover-bg" :style="frontCoverBgStyle"></div>
          <div class="bp-cover-content">
            <div class="bp-cover-title-block" :style="coverTitleStyle">
              <h2 class="bp-cover-title" :style="coverTitleTextStyle">{{ manuscript.title }}</h2>
              <p v-if="manuscript.workingSubtitle" class="bp-cover-subtitle">
                {{ manuscript.workingSubtitle }}
              </p>
            </div>
            <div
              v-if="opts.coverAuthor"
              class="bp-cover-author-block"
              :style="coverAuthorStyle"
            >
              {{ opts.coverAuthor }}
            </div>
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
          <div class="bp-page bp-page-left" @click="prevSpread">
            <div
              class="bp-page-inner"
              :style="pageInnerStyle"
              v-if="isContentPage(currentSpread.left)"
              v-html="pageHtml(currentSpread.left)"
            ></div>
            <div class="bp-page-inner" :style="pageInnerStyle" v-else>
              <div class="bp-page-blank"></div>
            </div>
            <div class="bp-page-num" v-if="showFolio(currentSpread.left)">{{ folioFor(currentSpread.left) }}</div>
          </div>
          <div class="bp-spine-shadow"></div>
          <div class="bp-page bp-page-right" @click="nextSpread">
            <div
              class="bp-page-inner"
              :style="pageInnerStyle"
              v-if="isContentPage(currentSpread.right)"
              v-html="pageHtml(currentSpread.right)"
            ></div>
            <div class="bp-page-inner" :style="pageInnerStyle" v-else>
              <div class="bp-page-blank"></div>
            </div>
            <div class="bp-page-num" v-if="showFolio(currentSpread.right)">{{ folioFor(currentSpread.right) }}</div>
          </div>
        </div>

        <!-- Closed back cover -->
        <div
          v-else-if="bookState === 'closed-back'"
          class="bp-cover bp-cover-back"
          :style="{ width: pageWidth + 'px', height: pageHeight + 'px' }"
          @click="reopenFromBack"
        >
          <div class="bp-cover-bg" :style="backCoverBgStyle"></div>
          <div class="bp-cover-content">
            <div
              class="bp-cover-back-stack"
              :class="{ 'has-back-text': !!opts.coverBackText }"
            >
              <p class="bp-cover-back-title">{{ manuscript.title }}</p>
              <div
                v-if="opts.coverBackText"
                ref="backTextWrap"
                class="bp-cover-back-text-wrap"
              >
                <p
                  ref="backTextEl"
                  class="bp-cover-back-text"
                  :style="coverBackTextStyle"
                >{{ opts.coverBackText }}</p>
              </div>
              <p v-if="opts.coverAuthor" class="bp-cover-back-author">
                {{ opts.coverAuthor }}
              </p>
            </div>
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
            ...flowTypographyStyle,
          }"
          v-html="bookFlowHtml"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
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

// Viewport-driven page geometry. The book stage gets up to ~92% of the
// viewport height (minus the topbar) and we hold a paperback-ish 1.55:1
// aspect (height:width) per page. If two pages plus gutter would exceed the
// viewport width, we scale down so the spread always fits.
const viewportH = ref(typeof window !== 'undefined' ? window.innerHeight : 1000)
const viewportW = ref(typeof window !== 'undefined' ? window.innerWidth : 1600)

function onResize() {
  viewportH.value = window.innerHeight
  viewportW.value = window.innerWidth
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const TOPBAR_PX = 56
const VERT_PADDING_PX = 32
const HORIZ_PADDING_PX = 48
const GUTTER_PX = 12
const ASPECT = 1.55 // page-height / page-width

const pageDims = computed(() => {
  const availH = Math.max(360, viewportH.value - TOPBAR_PX - VERT_PADDING_PX)
  let pageH = availH
  let pageW = pageH / ASPECT
  const availW = Math.max(360, viewportW.value - HORIZ_PADDING_PX * 2)
  if (pageW * 2 + GUTTER_PX > availW) {
    pageW = (availW - GUTTER_PX) / 2
    pageH = pageW * ASPECT
  }
  return { pageW: Math.floor(pageW), pageH: Math.floor(pageH) }
})

const pageWidth = computed(() => pageDims.value.pageW)
const pageHeight = computed(() => pageDims.value.pageH)

// Page padding (the printed margin around the body type). Scales with the
// page so a smaller spread keeps a sensible margin ratio.
const padX = computed(() => Math.round(pageWidth.value * 0.085))
const padY = computed(() => Math.round(pageHeight.value * 0.075))
const contentWidth = computed(() => pageWidth.value - padX.value * 2)
const contentHeight = computed(() => pageHeight.value - padY.value * 2)

// Body font size in px. 14px ≈ 10.5pt — close to a paperback's running text.
// User can tune via the slider in the setup screen.
const bookFontSize = ref(14)
const lineHeight = 1.45

const flowTypographyStyle = computed(() => ({
  fontSize: bookFontSize.value + 'px',
  lineHeight: String(lineHeight),
}))

const pageInnerStyle = computed(() => ({
  top: padY.value + 'px',
  right: padX.value + 'px',
  bottom: padY.value + 'px',
  left: padX.value + 'px',
}))

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
// Cover-text positions are stored as percentages from the top of the cover.
// They drive `top: N%` on absolutely-positioned text blocks, with each block
// translated up by half its own height so the percentage refers to the block's
// VERTICAL CENTER. Defaults follow a classic trade-cover layout: title sits
// in the upper-third, author near the bottom.
//
// Title size/colour are bound to the .bp-cover-title h2 (size) and the title
// block (colour, which inherits down to the subtitle). Author size/colour are
// bound directly to .bp-cover-author-block, since that block IS the text.
const opts = ref({
  includeFrontMatter: true,
  includeToc: true,
  chapterTitlePages: true,
  coverOpacity: 0.85,
  coverAuthor: '',
  coverTitleY: 38,
  coverAuthorY: 82,
  coverTitleSize: 26,
  coverTitleColor: '#f4ecdd',
  coverAuthorSize: 16,
  coverAuthorColor: '#f4ecdd',
  coverTitleAlign: 'center' as 'left' | 'center' | 'right',
  coverAuthorAlign: 'center' as 'left' | 'center' | 'right',
  coverBackText: '',
  coverBackTextColor: '#f4ecdd',
})

const coverBackTextStyle = computed(() => ({
  color: opts.value.coverBackTextColor,
}))

const coverTitleStyle = computed(() => ({
  top: opts.value.coverTitleY + '%',
  color: opts.value.coverTitleColor,
  textAlign: opts.value.coverTitleAlign,
}))
const coverTitleTextStyle = computed(() => ({
  fontSize: opts.value.coverTitleSize + 'px',
}))
const coverAuthorStyle = computed(() => ({
  top: opts.value.coverAuthorY + '%',
  fontSize: opts.value.coverAuthorSize + 'px',
  color: opts.value.coverAuthorColor,
  textAlign: opts.value.coverAuthorAlign,
}))

// ---- Back-cover text auto-fit ----
// The user's blurb may be one short line or a long paragraph; either way it
// should sit comfortably on the back cover with breathing room. We wrap the
// text in a flex-1 div whose height = (cover height − title − author − the
// stack's top/bottom padding), then iteratively shrink the font size from
// MAX down to MIN until both `scrollHeight` and `scrollWidth` fit inside the
// wrapper. The shrink runs on a post-flush watcher so the DOM is up to date
// when we measure.
const backTextEl = ref<HTMLParagraphElement | null>(null)
const backTextWrap = ref<HTMLDivElement | null>(null)
const BACK_TEXT_MAX_FONT_PX = 18
const BACK_TEXT_MIN_FONT_PX = 7

function fitBackCoverText() {
  const textEl = backTextEl.value
  const wrap = backTextWrap.value
  if (!textEl || !wrap) return

  // Reset to the maximum size before measuring, otherwise a previous shrink
  // would lock us at the smaller size even after the text gets shorter.
  let size = BACK_TEXT_MAX_FONT_PX
  textEl.style.fontSize = size + 'px'
  // Force layout to settle before reading dimensions.
  void wrap.offsetHeight

  const availW = wrap.clientWidth
  const availH = wrap.clientHeight
  if (availW <= 0 || availH <= 0) return

  // Linear shrink at 0.5px steps. The font size range is small so this is
  // cheap; a binary search would be marginally faster but harder to reason
  // about (line wrapping makes the fit function non-monotonic in practice
  // only at the boundary, but linear from the top avoids the issue entirely).
  while (
    size > BACK_TEXT_MIN_FONT_PX &&
    (textEl.scrollHeight > availH || textEl.scrollWidth > availW)
  ) {
    size -= 0.5
    textEl.style.fontSize = size + 'px'
    void textEl.offsetHeight
  }
}

watch(
  [
    () => opts.value.coverBackText,
    () => opts.value.coverAuthor,
    () => bookState.value,
    pageWidth,
    pageHeight,
  ],
  async () => {
    if (bookState.value !== 'closed-back') return
    // Wait for the v-if to mount the wrapper after a state change.
    await nextTick()
    fitBackCoverText()
  },
  { flush: 'post' },
)

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
//
// Book typography conventions enforced here:
//   * The bound book opens to a spread whose LEFT page is the inside front
//     cover (a blank verso) and whose RIGHT page is the first numbered page
//     (a recto). Body content always begins on a recto.
//   * Odd page numbers fall on rectos (right). Even page numbers fall on
//     versos (left). In our 0-based `pages` array we model this directly:
//     index 0 is the blank inside-front-cover, then index 1 is page 1 (recto),
//     index 2 is page 2 (verso), and so on. Spread N pairs pages[2N] (left,
//     verso) with pages[2N+1] (right, recto).
//   * Chapter openings — and other major recto-only pages such as the
//     half-title, title page, and the start of the table of contents — must
//     fall on a recto. If a chapter would otherwise land on a verso, a blank
//     verso is inserted before it to push it to the next recto. This is the
//     conventional "blank facing page" of trade book printing.
//   * Folios (running page numbers) are suppressed on blanks and on chapter
//     opening pages (drop-folio convention).
type Page = { html: string; blank?: boolean; mustRecto?: boolean }

const measureContainer = ref<HTMLElement | null>(null)
const pages = ref<Page[]>([])
const currentSpreadIndex = ref(0)

// Total numbered positions in the book (everything in `pages` except the
// inside-front-cover slot at index 0).
const totalPages = computed(() => Math.max(0, pages.value.length - 1))
const totalSpreads = computed(() => Math.max(1, Math.ceil(pages.value.length / 2)))
const currentSpread = computed(() => ({
  left: currentSpreadIndex.value * 2,
  right: currentSpreadIndex.value * 2 + 1,
}))

// CSS selector for elements whose page MUST fall on a recto.
const RECTO_SELECTOR =
  '.bp-frontmatter, .bp-titlepage, .bp-toc, .bp-chapter-title, .bp-h2.bp-page-break-before'

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
  const cw = contentWidth.value
  const ch = contentHeight.value
  const total = el.scrollWidth
  const count = Math.max(1, Math.round(total / cw))

  // Identify which raw column indices contain a "must-be-recto" element.
  //
  // This is the tricky bit. The measurement container is declared as a single
  // column wide (`width: cw; column-width: cw`) and multi-column content
  // overflows it horizontally. In that overflow region, browsers are
  // inconsistent about `offsetLeft`/`getBoundingClientRect()` for multi-column
  // descendants — Chrome and Firefox have historically reported either the
  // static-flow position (column 0) or the visual column position depending
  // on the element type and ancestor chain.
  //
  // The reliable workaround is to do a second-pass measurement: temporarily
  // widen the container to `count * cw` so every column fits *inside* the
  // container's declared box (no overflow). With every column laid out within
  // the container's box, `getBoundingClientRect()` is well-defined for every
  // browser: the i-th column starts at `containerRect.left + i * cw`.
  const originalWidth = (el.style as CSSStyleDeclaration).width
  el.style.width = `${count * cw}px`
  // Force a synchronous reflow so the new width takes effect before we read
  // bounding rects. Reading offsetWidth flushes layout.
  void el.offsetWidth

  const rectoColumnIndices = new Set<number>()
  const containerRect = el.getBoundingClientRect()
  for (const rEl of Array.from(el.querySelectorAll<HTMLElement>(RECTO_SELECTOR))) {
    const rect = rEl.getBoundingClientRect()
    if (!rect.width && !rect.height) continue
    const x = rect.left - containerRect.left
    const colIdx = Math.max(0, Math.min(count - 1, Math.floor(x / cw)))
    rectoColumnIndices.add(colIdx)
  }

  // Restore the original measurement-container width.
  el.style.width = originalWidth

  // Each page re-renders the full flow at width = count * contentWidth so that
  // every column is laid out side-by-side and positioned. The surrounding
  // .bp-page-inner is overflow:hidden and only contentWidth wide, clipping
  // everything except the column the inner flow's translateX scrolls into view.
  const flowWidth = count * cw
  const flowHtml = el.innerHTML
  const fs = bookFontSize.value

  type RawPage = { html: string; mustRecto: boolean }
  const rawPages: RawPage[] = []
  for (let i = 0; i < count; i++) {
    rawPages.push({
      html:
        `<div class="bp-page-flow" style="width:${flowWidth}px;height:${ch}px;column-width:${cw}px;column-gap:0;column-fill:auto;transform:translateX(-${i * cw}px);font-size:${fs}px;line-height:${lineHeight};">` +
        flowHtml +
        `</div>`,
      mustRecto: rectoColumnIndices.has(i),
    })
  }

  // Build the final, recto-aware page list.
  //   * Index 0 is always a blank verso — the inside front cover. This guarantees
  //     the first numbered page (index 1) lands on a recto.
  //   * For every raw page tagged mustRecto, if it would land on an even index
  //     (a verso), we insert a blank verso before it to push it to the next
  //     odd index (a recto).
  //   * If the final length is odd, we add a trailing blank so the last
  //     spread always pairs cleanly (content on verso, blank on recto, or
  //     vice versa).
  const finalPages: Page[] = []
  finalPages.push({ html: '', blank: true })

  for (const rp of rawPages) {
    if (rp.mustRecto && finalPages.length % 2 === 0) {
      // Even index = verso; insert a blank to push the chapter onto a recto.
      finalPages.push({ html: '', blank: true })
    }
    finalPages.push({ html: rp.html, mustRecto: rp.mustRecto })
  }

  if (finalPages.length % 2 !== 0) {
    finalPages.push({ html: '', blank: true })
  }

  pages.value = finalPages

  // Clamp the current spread index in case the new pagination shrank the book.
  if (currentSpreadIndex.value > totalSpreads.value - 1) {
    currentSpreadIndex.value = Math.max(0, totalSpreads.value - 1)
  }
}

// Helpers used by the template.
function pageAt(idx: number): Page | null {
  return pages.value[idx] || null
}
function pageHtml(idx: number): string {
  return pageAt(idx)?.html || ''
}
function isContentPage(idx: number): boolean {
  const p = pageAt(idx)
  return !!p && !p.blank
}
function showFolio(idx: number): boolean {
  // Suppress the page number on the blank inside-front-cover slot, on any
  // inserted blanks, and on chapter / front-matter opening pages (drop-folio
  // convention).
  if (idx <= 0) return false
  const p = pageAt(idx)
  if (!p || p.blank || p.mustRecto) return false
  return true
}
function folioFor(idx: number): number {
  // Page numbers are 1-based and start at index 1 (since index 0 is the
  // blank inside-front-cover, not a numbered page).
  return idx
}

const progressLabel = computed(() => {
  const left = currentSpread.value.left
  const right = currentSpread.value.right
  const total = totalPages.value
  const lShown = isContentPage(left)
  const rShown = isContentPage(right)
  const lN = folioFor(left)
  const rN = folioFor(right)
  if (lShown && rShown) return `Pages ${lN}–${rN} of ${total}`
  if (lShown) return `Page ${lN} of ${total}`
  if (rShown) return `Page ${rN} of ${total}`
  return ''
})

watch(
  [bookFlowHtml, () => stage.value, bookFontSize, contentWidth, contentHeight],
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
  /* Children (.bp-cover-title-block, .bp-cover-author-block) are absolutely
     positioned via inline `top: N%` and centred horizontally. The previous
     flex-centering would override the slider-driven vertical positions, so
     it has been removed here. The back cover keeps a simple flex stack
     centred via .bp-cover-back-stack. */
  position: absolute;
  inset: 0;
  text-align: center;
  padding: 2rem;
  color: #f4ecdd;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
}
.bp-cover-title-block,
.bp-cover-author-block {
  position: absolute;
  left: 50%;
  /* `top` comes from the slider (inline style). We translate up by half the
     block's height so the slider value refers to the block's vertical centre. */
  transform: translate(-50%, -50%);
  width: calc(100% - 4rem);
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
.bp-cover-author-block {
  font-family: ui-serif, Georgia, serif;
  font-size: 1rem;
  font-style: italic;
  letter-spacing: 0.08em;
  opacity: 0.95;
}
.bp-cover-back-stack {
  /* Default layout (no back-cover blurb): title and author centred together
     in the middle of the cover. The padding here sits inside the cover edge
     and supplies the top/bottom breathing room around all back-cover text. */
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 2rem;
}
.bp-cover-back-stack.has-back-text {
  /* When the user has supplied a blurb, anchor the title at the top, the
     author at the bottom, and let the blurb wrapper grow to fill what's
     between them. */
  justify-content: space-between;
  gap: 1rem;
}
.bp-cover-back-text-wrap {
  flex: 1 1 auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Hide overflow while we measure / shrink the text to fit. */
  overflow: hidden;
}
.bp-cover-back-title {
  font-family: ui-serif, Georgia, serif;
  font-style: italic;
  font-size: 1rem;
  letter-spacing: 0.04em;
}
.bp-cover-back-author {
  font-family: ui-serif, Georgia, serif;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
}
.bp-cover-back-text {
  /* Free-form back-cover text: blurb, quote, dedication.
     The font-size here is just a starting point — fitBackCoverText() in the
     script picks the largest size between BACK_TEXT_MIN_FONT_PX and
     BACK_TEXT_MAX_FONT_PX where the text fits inside .bp-cover-back-text-wrap. */
  font-family: ui-serif, Georgia, serif;
  font-size: 16px;
  line-height: 1.5;
  /* Preserve user line breaks from the textarea while still wrapping long
     lines at the cover's edge. */
  white-space: pre-wrap;
  max-width: 28em;
  margin: 0;
  opacity: 0.92;
  text-align: center;
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
  /* inset values come from the inline `pageInnerStyle` so the printed margin
     scales with the page. */
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

/* The actual paginated flow lives inside .bp-page-inner via v-html.
   font-size and line-height are set inline so the slider can update them. */
.bp-page-inner :deep(.bp-page-flow) {
  font-family: ui-serif, Georgia, "Iowan Old Style", serif;
  color: #1f1a14;
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
  /* width/height/columnWidth/font-size/line-height are all set inline so the
     measurement matches the page-flow exactly when the user adjusts type. */
  column-gap: 0;
  column-fill: auto;
  font-family: ui-serif, Georgia, "Iowan Old Style", serif;
  overflow: hidden;
}

/* The layout-affecting rules above are scoped to `.bp-page-inner :deep(...)`
   for the rendered spread. The measurement flow has no `.bp-page-inner`
   ancestor, so we mirror the column-break and chapter-padding rules here
   so measurement and render produce the same column layout. Without this,
   `offsetLeft / contentWidth` reports the wrong column index for chapter
   openings, breaking the recto-detection logic. */
.bp-measure-flow :deep(.bp-page-break-before) { break-before: column; }
.bp-measure-flow :deep(.bp-page-break-after)  { break-after: column; }
.bp-measure-flow :deep(.bp-chapter-title) {
  text-align: center;
  padding-top: 30%;
  break-before: column;
  break-inside: avoid;
}
.bp-measure-flow :deep(.bp-frontmatter),
.bp-measure-flow :deep(.bp-titlepage),
.bp-measure-flow :deep(.bp-toc) {
  break-inside: avoid;
}
.bp-measure-flow :deep(.bp-half-title) {
  margin-top: 40%;
}
.bp-measure-flow :deep(.bp-titlepage) {
  padding-top: 18%;
}
.bp-measure-flow :deep(.bp-toc) {
  padding-top: 8%;
}
</style>
