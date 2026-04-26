<template>
  <div class="manuscript-detail-page">
    <!-- Header -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-6xl mx-auto">
        <router-link
          to="/manuscripts"
          class="inline-flex items-center gap-2 text-sm font-sans text-ink-lighter hover:text-ink transition-colors duration-300 mb-8"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          All manuscripts
        </router-link>

        <div v-if="manuscript">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div class="flex-1">
              <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-3 leading-tight">
                {{ manuscript.title }}
              </h1>
              <p v-if="manuscript.workingSubtitle" class="text-lg sm:text-xl font-light italic text-ink-light mb-4">
                {{ manuscript.workingSubtitle }}
              </p>
              <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-ink-lighter font-sans">
                <span>{{ formLabel(manuscript.form) }}</span>
                <span>&middot;</span>
                <span>{{ statusLabel(manuscript.status) }}</span>
                <span v-if="manuscript.visibility !== 'private'">&middot;</span>
                <span v-if="manuscript.visibility !== 'private'">{{ manuscript.visibility }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                @click="openExportDialog"
                class="px-4 py-2 text-sm tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors duration-300"
              >
                Export
              </button>
              <router-link
                v-if="canModify"
                :to="`/manuscripts/edit/${manuscript.id}`"
                class="px-4 py-2 text-sm tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors duration-300"
              >
                Edit details
              </router-link>
            </div>
          </div>

          <!-- Source themes -->
          <div v-if="manuscript.sourceThemeIds.length > 0" class="mt-6 flex flex-wrap gap-2">
            <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans mr-2 mt-1">Drawn from</span>
            <router-link
              v-for="themeId in manuscript.sourceThemeIds"
              :key="themeId"
              :to="`/themes/${themeId}`"
              class="text-sm px-3 py-1 bg-surface text-ink-light rounded-sm border border-line hover:border-ink-lighter transition-colors"
            >
              {{ themeName(themeId) }}
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-paper">
      <div class="max-w-6xl mx-auto">
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading the Book Room…</p>
        </div>

        <div v-else-if="!manuscript" class="text-center py-16">
          <p class="text-lg font-light text-ink-light mb-4">Manuscript not found.</p>
          <router-link to="/manuscripts" class="text-sm font-sans text-ink-lighter hover:text-ink">Browse all manuscripts</router-link>
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <!-- LEFT: literary direction panel -->
          <aside class="lg:col-span-1 space-y-8">
            <section>
              <h2 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">Central question</h2>
              <p v-if="manuscript.centralQuestion" class="text-base font-light text-ink leading-relaxed">
                {{ manuscript.centralQuestion }}
              </p>
              <p v-else class="text-sm font-light italic text-ink-lighter">
                Not set. The Book Room works best once you have one.
              </p>
            </section>

            <section v-if="manuscript.throughLine">
              <h2 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">Through-line</h2>
              <p class="text-sm font-light text-ink-light leading-relaxed">{{ manuscript.throughLine }}</p>
            </section>

            <section v-if="manuscript.emotionalArc">
              <h2 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">Emotional arc</h2>
              <p class="text-sm font-light text-ink-light leading-relaxed">{{ manuscript.emotionalArc }}</p>
            </section>

            <section v-if="manuscript.narrativePromise">
              <h2 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">Narrative promise</h2>
              <p class="text-sm font-light text-ink-light leading-relaxed">{{ manuscript.narrativePromise }}</p>
            </section>

            <section>
              <h2 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-2">Counts</h2>
              <p class="text-sm font-light text-ink-light">
                {{ sections.length }} {{ sections.length === 1 ? 'section' : 'sections' }} &middot;
                {{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}
              </p>
              <p v-if="unassignedItems.length > 0" class="text-sm font-light text-ink-lighter mt-1">
                {{ unassignedItems.length }} unassigned
              </p>
            </section>
          </aside>

          <!-- RIGHT: the spine -->
          <div class="lg:col-span-2">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-light tracking-tight">The Spine</h2>
              <div v-if="canModify" class="flex items-center gap-2">
                <button
                  type="button"
                  @click="addSectionPrompt"
                  class="px-3 py-1.5 text-xs tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors"
                >
                  + Section
                </button>
                <button
                  type="button"
                  @click="openAddItemPanel"
                  class="px-3 py-1.5 text-xs tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
                >
                  + Item
                </button>
              </div>
            </div>

            <p class="text-sm text-ink-lighter italic mb-6">
              Drag items to reorder them, or drag them between sections.
              Sections give the manuscript its macro shape; items are the essays, bridges, and placeholders that fill them.
            </p>

            <!-- Sections + their items -->
            <div class="space-y-8">
              <div
                v-for="section in sortedSections"
                :key="section.id"
                class="border border-line bg-paper"
                @dragover.prevent
                @drop="onDropOnSection($event, section.id)"
              >
                <header class="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans shrink-0">
                      {{ purposeLabel(section.purpose) }}
                    </span>
                    <h3 class="text-lg font-light tracking-tight truncate">{{ section.title }}</h3>
                  </div>
                  <div v-if="canModify" class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      @click="renameSectionPrompt(section)"
                      class="p-1 text-ink-lighter hover:text-ink"
                      title="Rename"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button
                      type="button"
                      @click="deleteSection(section)"
                      class="p-1 text-ink-lighter hover:text-red-600"
                      title="Delete (items remain, unassigned)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </header>

                <ul class="divide-y divide-line">
                  <li
                    v-for="item in itemsBySection.get(section.id) ?? []"
                    :key="item.id"
                    class="px-5 py-4 flex items-start gap-3 transition-colors"
                    :class="{
                      'cursor-grab': canModify,
                      'bg-surface': dragOverItemId === item.id,
                    }"
                    :draggable="canModify"
                    @dragstart="onDragStart($event, item.id)"
                    @dragover.prevent="dragOverItemId = item.id"
                    @dragleave="dragOverItemId = null"
                    @drop.stop="onDropBeforeItem($event, item)"
                  >
                    <span class="text-xs text-ink-lighter font-sans w-6 shrink-0 mt-1">{{ globalIndex(item) + 1 }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-wrap items-baseline gap-2">
                        <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
                          {{ itemTypeLabel(item.itemType) }}
                        </span>
                        <span v-if="item.structuralRole" class="text-xs text-ink-lighter italic">
                          &middot; {{ structuralRoleLabel(item.structuralRole) }}
                        </span>
                      </div>
                      <p class="text-base font-light text-ink mt-1">{{ item.title }}</p>
                      <p v-if="item.summary" class="text-sm text-ink-light mt-1 line-clamp-2">{{ item.summary }}</p>
                    </div>
                    <div v-if="canModify" class="flex items-center gap-1 shrink-0">
                      <router-link
                        v-if="item.writingBlockId"
                        :to="`/read/${item.writingBlockId}`"
                        class="p-1 text-ink-lighter hover:text-ink"
                        title="Read essay"
                        @click.stop
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </router-link>
                      <button
                        type="button"
                        @click.stop="deleteItem(item)"
                        class="p-1 text-ink-lighter hover:text-red-600"
                        title="Remove from manuscript"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </li>
                  <li
                    v-if="(itemsBySection.get(section.id) ?? []).length === 0"
                    class="px-5 py-6 text-sm text-ink-lighter italic text-center"
                  >
                    Empty section. Drop an item here.
                  </li>
                </ul>
              </div>

              <!-- Unassigned items -->
              <div
                v-if="unassignedItems.length > 0 || sections.length === 0"
                class="border border-dashed border-line bg-surface/50"
                @dragover.prevent
                @drop="onDropOnSection($event, null)"
              >
                <header class="px-5 py-3 border-b border-line">
                  <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Unassigned</span>
                </header>
                <ul class="divide-y divide-line">
                  <li
                    v-for="item in unassignedItems"
                    :key="item.id"
                    class="px-5 py-4 flex items-start gap-3"
                    :class="{ 'cursor-grab': canModify }"
                    :draggable="canModify"
                    @dragstart="onDragStart($event, item.id)"
                  >
                    <div class="flex-1 min-w-0">
                      <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
                        {{ itemTypeLabel(item.itemType) }}
                      </span>
                      <p class="text-base font-light text-ink mt-1">{{ item.title }}</p>
                    </div>
                    <button
                      v-if="canModify"
                      type="button"
                      @click.stop="deleteItem(item)"
                      class="p-1 text-ink-lighter hover:text-red-600"
                      title="Remove"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </li>
                  <li
                    v-if="unassignedItems.length === 0"
                    class="px-5 py-6 text-sm text-ink-lighter italic text-center"
                  >
                    No unassigned items.
                  </li>
                </ul>
              </div>

              <div v-if="sections.length === 0 && items.length === 0" class="text-center py-16">
                <p class="text-lg font-light text-ink-light mb-4">
                  The spine is empty.
                </p>
                <p class="text-sm text-ink-lighter">
                  Add a section to start shaping the macro structure, or add an item to begin gathering material.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Export dialog -->
    <div
      v-if="showExport && manuscript"
      class="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-40"
      @click.self="showExport = false"
    >
      <div class="bg-paper w-full sm:max-w-lg sm:rounded shadow-lg p-6 space-y-4">
        <div>
          <h3 class="text-lg font-light tracking-tight">Export manuscript</h3>
          <p class="text-sm text-ink-light mt-1">
            Downloads as Markdown. Open it in any editor, or pipe through pandoc to get DOCX/PDF.
          </p>
        </div>

        <fieldset class="space-y-3">
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              v-model="exportOpts.includeFrontMatter"
              type="checkbox"
              class="mt-1 rounded border-line text-ink focus:ring-ink"
            />
            <span class="text-sm">
              <span class="font-medium block">Include literary direction</span>
              <span class="text-ink-light">Title block, central question, through-line, emotional arc, narrative promise.</span>
            </span>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              v-model="exportOpts.includeToc"
              type="checkbox"
              class="mt-1 rounded border-line text-ink focus:ring-ink"
            />
            <span class="text-sm">
              <span class="font-medium block">Table of contents</span>
              <span class="text-ink-light">Generated from sections and items.</span>
            </span>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              v-model="exportOpts.includePlaceholders"
              type="checkbox"
              class="mt-1 rounded border-line text-ink focus:ring-ink"
            />
            <span class="text-sm">
              <span class="font-medium block">Placeholders</span>
              <span class="text-ink-light">Show essays not yet written as italic stubs, so the structure is visible.</span>
            </span>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              v-model="exportOpts.includeNotes"
              type="checkbox"
              class="mt-1 rounded border-line text-ink focus:ring-ink"
            />
            <span class="text-sm">
              <span class="font-medium block">Working notes</span>
              <span class="text-ink-light">Off by default &mdash; notes are usually for the writer, not the reader.</span>
            </span>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              v-model="exportOpts.includeFragments"
              type="checkbox"
              class="mt-1 rounded border-line text-ink focus:ring-ink"
            />
            <span class="text-sm">
              <span class="font-medium block">Fragments</span>
              <span class="text-ink-light">Include items marked as fragments.</span>
            </span>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              v-model="exportOpts.includeAiNotes"
              type="checkbox"
              class="mt-1 rounded border-line text-ink focus:ring-ink"
            />
            <span class="text-sm">
              <span class="font-medium block">Author/AI notes per item</span>
              <span class="text-ink-light">Off by default per the spec. Useful for review mode.</span>
            </span>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              v-model="exportOpts.numberItems"
              type="checkbox"
              class="mt-1 rounded border-line text-ink focus:ring-ink"
            />
            <span class="text-sm">
              <span class="font-medium block">Number essays</span>
              <span class="text-ink-light">Prefix essay headings with 1., 2., &hellip; in document order.</span>
            </span>
          </label>
        </fieldset>

        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            @click="showExport = false"
            class="px-4 py-2 text-sm tracking-wide font-sans text-ink-light hover:text-ink"
          >
            Cancel
          </button>
          <a
            :href="exportUrl"
            :download="exportFilename"
            @click="showExport = false"
            class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
          >
            Download .md
          </a>
        </div>
      </div>
    </div>

    <!-- Add Item panel (fixed bottom-right) -->
    <div
      v-if="showAddItem && canModify"
      class="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-40"
      @click.self="showAddItem = false"
    >
      <div class="bg-paper w-full sm:max-w-lg sm:rounded shadow-lg p-6 space-y-4">
        <h3 class="text-lg font-light tracking-tight">Add to spine</h3>

        <div>
          <label class="block text-sm font-medium mb-1">Type</label>
          <select v-model="newItem.itemType" class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink">
            <option value="essay">Essay (link to one in your library)</option>
            <option value="placeholder">Placeholder (essay not written yet)</option>
            <option value="bridge">Bridge (connective tissue between essays)</option>
            <option value="note">Note (working note for yourself)</option>
            <option value="fragment">Fragment</option>
          </select>
        </div>

        <div v-if="newItem.itemType === 'essay'">
          <label class="block text-sm font-medium mb-1">Essay</label>
          <select v-model="newItem.writingBlockId" class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink">
            <option :value="null">— pick an essay —</option>
            <option v-for="w in availableWritingBlocks" :key="w.id" :value="w.id">{{ w.title }}</option>
          </select>
          <p class="mt-1 text-xs text-ink-lighter">Title will be filled from the essay.</p>
        </div>

        <div v-else>
          <label class="block text-sm font-medium mb-1">Title</label>
          <input
            v-model="newItem.title"
            type="text"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
            :placeholder="newItem.itemType === 'bridge' ? 'Short label for this bridge' : 'Working title'"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Section</label>
          <select v-model="newItem.sectionId" class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink">
            <option :value="null">Unassigned</option>
            <option v-for="s in sortedSections" :key="s.id" :value="s.id">{{ s.title }}</option>
          </select>
        </div>

        <div v-if="addItemError" class="text-sm text-red-700">{{ addItemError }}</div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            @click="showAddItem = false"
            class="px-4 py-2 text-sm tracking-wide font-sans text-ink-light hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="addingItem"
            @click="confirmAddItem"
            class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light disabled:opacity-50"
          >
            {{ addingItem ? 'Adding…' : 'Add to spine' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { manuscriptsApi } from '../api/manuscripts'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { ApiResponse } from '@shared/ApiResponses'
import type { Theme } from '../domain/Theme'
import type { WritingBlock } from '../domain/WritingBlock'
import type {
  ManuscriptProject,
  ManuscriptSection,
  ManuscriptItem,
  ManuscriptForm,
  ManuscriptStatus,
  ManuscriptItemType,
  ManuscriptSectionPurpose,
  ManuscriptStructuralRole,
} from '@shared/Manuscript'

const route = useRoute()
const { user, isAdmin } = useAuth()

const loading = ref(true)
const manuscript = ref<ManuscriptProject | null>(null)
const sections = ref<ManuscriptSection[]>([])
const items = ref<ManuscriptItem[]>([])
const themes = ref<Theme[]>([])
const writingBlocks = ref<WritingBlock[]>([])

const showAddItem = ref(false)
const addingItem = ref(false)
const addItemError = ref<string | null>(null)
const newItem = ref<{
  itemType: ManuscriptItemType
  title: string
  sectionId: string | null
  writingBlockId: string | null
}>({
  itemType: 'essay',
  title: '',
  sectionId: null,
  writingBlockId: null,
})

const dragOverItemId = ref<string | null>(null)

// ---- export ----
const showExport = ref(false)
const exportOpts = ref({
  includeFrontMatter: true,
  includeToc: false,
  includePlaceholders: true,
  includeNotes: false,
  includeFragments: false,
  includeAiNotes: false,
  numberItems: false,
})

function openExportDialog() {
  showExport.value = true
}

const exportUrl = computed(() => {
  if (!manuscript.value) return '#'
  // Server expects 1/0 strings for boolean coercion. Always pass them so the
  // user's checkbox state survives even if the server's defaults change.
  const o = exportOpts.value
  const params = new URLSearchParams({
    format: 'markdown',
    frontMatter:  o.includeFrontMatter  ? '1' : '0',
    toc:          o.includeToc          ? '1' : '0',
    placeholders: o.includePlaceholders ? '1' : '0',
    notes:        o.includeNotes        ? '1' : '0',
    fragments:    o.includeFragments    ? '1' : '0',
    aiNotes:      o.includeAiNotes      ? '1' : '0',
    number:       o.numberItems         ? '1' : '0',
  })
  return `/api/manuscripts/${manuscript.value.id}/export?${params.toString()}`
})

const exportFilename = computed(() => {
  if (!manuscript.value) return 'manuscript.md'
  const slug = manuscript.value.title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'manuscript'
  return `${slug}.md`
})

const canModify = computed(() => {
  if (!manuscript.value || !user.value) return false
  return manuscript.value.userId === user.value.id || isAdmin.value
})

const sortedSections = computed(() =>
  [...sections.value].sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
)

const itemsBySection = computed(() => {
  const map = new Map<string, ManuscriptItem[]>()
  for (const s of sections.value) map.set(s.id, [])
  for (const item of items.value) {
    if (item.sectionId && map.has(item.sectionId)) {
      map.get(item.sectionId)!.push(item)
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
  }
  return map
})

const unassignedItems = computed(() => {
  return items.value
    .filter(i => !i.sectionId || !sections.value.some(s => s.id === i.sectionId))
    .sort((a, b) => a.orderIndex - b.orderIndex)
})

const orderedItems = computed(() => {
  // Used for global numbering: walk sections in order, then unassigned.
  const out: ManuscriptItem[] = []
  for (const s of sortedSections.value) {
    const list = itemsBySection.value.get(s.id) ?? []
    out.push(...list)
  }
  out.push(...unassignedItems.value)
  return out
})

const globalIndex = (item: ManuscriptItem) => orderedItems.value.findIndex(i => i.id === item.id)

const themeName = (id: string) => themes.value.find(t => t.id === id)?.name ?? 'unknown theme'

const FORM_LABELS: Record<ManuscriptForm, string> = {
  memoir: 'Memoir',
  essay_collection: 'Essay collection',
  long_form_essay: 'Long-form essay',
  creative_nonfiction: 'Creative nonfiction',
  hybrid: 'Hybrid',
  fictionalised_memoir: 'Fictionalised memoir',
}
const STATUS_LABELS: Record<ManuscriptStatus, string> = {
  gathering: 'Gathering',
  structuring: 'Structuring',
  drafting: 'Drafting',
  bridging: 'Bridging',
  revising: 'Revising',
  finalising: 'Finalising',
}
const PURPOSE_LABELS: Record<ManuscriptSectionPurpose, string> = {
  opening: 'Opening',
  setup: 'Setup',
  deepening: 'Deepening',
  turning_point: 'Turning point',
  contrast: 'Contrast',
  resolution: 'Resolution',
  ending: 'Ending',
  appendix: 'Appendix',
  unassigned: 'Section',
}
const ITEM_TYPE_LABELS: Record<ManuscriptItemType, string> = {
  essay: 'Essay',
  bridge: 'Bridge',
  placeholder: 'Placeholder',
  note: 'Note',
  fragment: 'Fragment',
}
const STRUCTURAL_ROLE_LABELS: Record<ManuscriptStructuralRole, string> = {
  introduces_theme: 'introduces theme',
  complicates_theme: 'complicates theme',
  personal_example: 'personal example',
  turning_point: 'turning point',
  counterpoint: 'counterpoint',
  deepening: 'deepening',
  release: 'release',
  conclusion: 'conclusion',
}
const formLabel = (f: ManuscriptForm) => FORM_LABELS[f] ?? f
const statusLabel = (s: ManuscriptStatus) => STATUS_LABELS[s] ?? s
const purposeLabel = (p: ManuscriptSectionPurpose) => PURPOSE_LABELS[p] ?? p
const itemTypeLabel = (t: ManuscriptItemType) => ITEM_TYPE_LABELS[t] ?? t
const structuralRoleLabel = (r: ManuscriptStructuralRole) => STRUCTURAL_ROLE_LABELS[r] ?? r

const availableWritingBlocks = computed(() => {
  // Show essays the user can use. We don't filter out already-linked ones because
  // a single essay might legitimately appear under multiple manuscripts.
  return [...writingBlocks.value].sort((a, b) => a.title.localeCompare(b.title))
})

async function loadAll() {
  const id = route.params.id as string
  if (!id) return
  try {
    loading.value = true
    const [spine, themesRes, blocksRes] = await Promise.all([
      manuscriptsApi.getSpine(id),
      api.get<ApiResponse<Theme[]>>('/themes').catch(() => ({ data: [] as Theme[] })),
      api.get<ApiResponse<WritingBlock[]>>('/writing').catch(() => ({ data: [] as WritingBlock[] })),
    ])
    manuscript.value = spine.manuscript
    sections.value = spine.sections
    items.value = spine.items
    themes.value = themesRes.data
    writingBlocks.value = blocksRes.data
  } catch (err) {
    console.error('Failed to load manuscript:', err)
    manuscript.value = null
  } finally {
    loading.value = false
  }
}

// ---- section actions ----
async function addSectionPrompt() {
  const title = window.prompt('Section title', 'New section')
  if (!title || !title.trim()) return
  try {
    const created = await manuscriptsApi.createSection(manuscript.value!.id, { title: title.trim() })
    sections.value.push(created)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to add section')
  }
}

async function renameSectionPrompt(s: ManuscriptSection) {
  const title = window.prompt('Section title', s.title)
  if (!title || !title.trim() || title.trim() === s.title) return
  try {
    const updated = await manuscriptsApi.updateSection(s.id, { title: title.trim() })
    const i = sections.value.findIndex(x => x.id === s.id)
    if (i >= 0) sections.value[i] = updated
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to rename section')
  }
}

async function deleteSection(s: ManuscriptSection) {
  if (!confirm(`Delete section "${s.title}"? Its items will become unassigned, not deleted.`)) return
  try {
    await manuscriptsApi.deleteSection(s.id)
    sections.value = sections.value.filter(x => x.id !== s.id)
    // Locally null out section_id on items that pointed at it; the server already did so.
    items.value = items.value.map(i => i.sectionId === s.id ? { ...i, sectionId: null } : i)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete section')
  }
}

// ---- item actions ----
function openAddItemPanel() {
  newItem.value = {
    itemType: writingBlocks.value.length > 0 ? 'essay' : 'placeholder',
    title: '',
    sectionId: sortedSections.value[0]?.id ?? null,
    writingBlockId: null,
  }
  addItemError.value = null
  showAddItem.value = true
}

async function confirmAddItem() {
  if (!manuscript.value) return
  addItemError.value = null

  let title = newItem.value.title.trim()
  let writingBlockId: string | null = null

  if (newItem.value.itemType === 'essay') {
    if (!newItem.value.writingBlockId) {
      addItemError.value = 'Pick an essay from your library'
      return
    }
    writingBlockId = newItem.value.writingBlockId
    const block = writingBlocks.value.find(w => w.id === writingBlockId)
    title = block?.title ?? title
    if (!title) {
      addItemError.value = 'Selected essay has no title'
      return
    }
  } else {
    if (!title) {
      addItemError.value = 'Title is required for non-essay items'
      return
    }
  }

  try {
    addingItem.value = true
    const created = await manuscriptsApi.createItem(manuscript.value.id, {
      title,
      itemType: newItem.value.itemType,
      sectionId: newItem.value.sectionId,
      writingBlockId,
    })
    items.value.push(created)
    showAddItem.value = false
  } catch (err) {
    addItemError.value = err instanceof Error ? err.message : 'Failed to add item'
  } finally {
    addingItem.value = false
  }
}

async function deleteItem(item: ManuscriptItem) {
  if (!confirm(`Remove "${item.title}" from the manuscript?\n\nThe underlying essay (if any) is not deleted.`)) return
  try {
    await manuscriptsApi.deleteItem(item.id)
    items.value = items.value.filter(i => i.id !== item.id)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to remove item')
  }
}

// ---- drag & drop ----
function onDragStart(e: DragEvent, itemId: string) {
  if (!canModify.value) return
  e.dataTransfer?.setData('text/plain', itemId)
  e.dataTransfer!.effectAllowed = 'move'
}

/**
 * Drop on the empty space inside a section header (i.e. add to end of that section)
 * OR on the unassigned bucket (sectionId === null).
 */
async function onDropOnSection(e: DragEvent, sectionId: string | null) {
  if (!canModify.value) return
  const itemId = e.dataTransfer?.getData('text/plain')
  if (!itemId) return
  await moveItem(itemId, sectionId, /* targetIndexInSection */ Number.MAX_SAFE_INTEGER)
  dragOverItemId.value = null
}

/**
 * Drop on a specific item: insert *before* that item in its section.
 */
async function onDropBeforeItem(e: DragEvent, target: ManuscriptItem) {
  if (!canModify.value) return
  const itemId = e.dataTransfer?.getData('text/plain')
  if (!itemId || itemId === target.id) {
    dragOverItemId.value = null
    return
  }
  const targetSectionId = target.sectionId ?? null
  const list = (targetSectionId
    ? itemsBySection.value.get(targetSectionId) ?? []
    : unassignedItems.value
  ).filter(i => i.id !== itemId) // remove the dragged item if it's already in this section
  const indexInSection = list.findIndex(i => i.id === target.id)
  await moveItem(itemId, targetSectionId, indexInSection)
  dragOverItemId.value = null
}

/**
 * Compute the new ordering and POST a reorder request. We send moves for every
 * item whose orderIndex changes; this is small (max ~50 items) and avoids server
 * having to guess.
 */
async function moveItem(itemId: string, targetSectionId: string | null, targetIndex: number) {
  const item = items.value.find(i => i.id === itemId)
  if (!item) return

  // Build the new ordering for the target section (with the dragged item inserted).
  const targetList = targetSectionId
    ? (itemsBySection.value.get(targetSectionId) ?? []).filter(i => i.id !== itemId)
    : unassignedItems.value.filter(i => i.id !== itemId)

  const insertAt = Math.min(Math.max(targetIndex, 0), targetList.length)
  const moves: { id: string; orderIndex: number; sectionId?: string | null }[] = []

  // Renumber the target section densely so order_index reflects the new sequence.
  let cursor = 0
  for (let i = 0; i <= targetList.length; i++) {
    if (i === insertAt) {
      moves.push({
        id: item.id,
        orderIndex: cursor++,
        sectionId: targetSectionId ?? null,
      })
    }
    if (i < targetList.length) {
      const t = targetList[i]
      if (t.orderIndex !== cursor || (t.sectionId ?? null) !== (targetSectionId ?? null)) {
        moves.push({ id: t.id, orderIndex: cursor })
      } else {
        // Section unchanged AND order unchanged - skip.
      }
      cursor++
    }
  }

  // If the dragged item used to live in another section, also renumber the *source*
  // section to remove the gap.
  const sourceSectionId = item.sectionId ?? null
  if (sourceSectionId !== (targetSectionId ?? null)) {
    const sourceList = sourceSectionId
      ? (itemsBySection.value.get(sourceSectionId) ?? []).filter(i => i.id !== itemId)
      : unassignedItems.value.filter(i => i.id !== itemId)
    sourceList.forEach((t, i) => {
      if (t.orderIndex !== i) moves.push({ id: t.id, orderIndex: i })
    })
  }

  if (moves.length === 0) return

  // Optimistic update.
  const snapshot = items.value
  items.value = items.value.map(existing => {
    const m = moves.find(mm => mm.id === existing.id)
    if (!m) return existing
    return {
      ...existing,
      orderIndex: m.orderIndex,
      sectionId: m.sectionId !== undefined ? m.sectionId : existing.sectionId,
    }
  })

  try {
    const fresh = await manuscriptsApi.reorderItems(manuscript.value!.id, moves)
    items.value = fresh
  } catch (err) {
    // Revert.
    items.value = snapshot
    alert(err instanceof Error ? err.message : 'Failed to save new order')
  }
}

onMounted(loadAll)
watch(() => route.params.id, loadAll)
</script>

<style scoped>
.manuscript-detail-page {
  min-height: 100vh;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
