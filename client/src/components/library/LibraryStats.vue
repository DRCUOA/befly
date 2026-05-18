<template>
  <div class="library-stats bg-surface border border-line p-4">
    <div class="flex items-baseline justify-between mb-3">
      <p class="text-[10px] uppercase tracking-widest text-ink-lighter">Stats</p>
      <p class="text-xs text-ink-lighter">
        <span v-if="total === 0">No books yet</span>
        <span v-else-if="isFiltered">{{ total }} of {{ totalAll }} books in current view</span>
        <span v-else>{{ total }} books in your library</span>
      </p>
    </div>

    <template v-if="total > 0">
      <!-- Overview tiles -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <StatTile label="Books" :value="String(total)" />
        <StatTile label="Read" :value="String(readCount)" :hint="`${readPercent}%`" />
        <StatTile
          label="Pages"
          :value="formatNumber(totalPages)"
          :hint="avgPages > 0 ? `${avgPages} avg` : undefined"
        />
        <StatTile label="Authors" :value="String(uniqueAuthors)" />
      </div>

      <!-- Top categories with bars -->
      <section v-if="topCategories.length" class="mb-5">
        <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-2">Top categories</p>
        <ul class="space-y-1.5">
          <li
            v-for="c in topCategories"
            :key="c.name"
            class="flex items-center gap-3 text-sm"
          >
            <span class="w-28 sm:w-40 truncate text-ink" :title="c.name">{{ c.name }}</span>
            <div class="flex-1 h-1.5 bg-paper border border-line relative overflow-hidden">
              <div class="absolute inset-y-0 left-0 bg-ink" :style="{ width: c.percent + '%' }" />
            </div>
            <span class="tabular-nums text-xs text-ink-light w-8 text-right">{{ c.count }}</span>
          </li>
        </ul>
      </section>

      <!-- Want-to-read distribution -->
      <section class="mb-5">
        <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-2">Want-to-read</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="Avg" :value="`${avgMotivation} / 100`" />
          <StatTile label="High ≥75" :value="String(motivationHigh)" />
          <StatTile label="Medium" :value="String(motivationMid)" />
          <StatTile label="Low <25" :value="String(motivationLow)" />
        </div>
      </section>

      <!-- Coverage row (compact) -->
      <section>
        <p class="text-[10px] uppercase tracking-widest text-ink-lighter mb-1.5">Coverage</p>
        <p class="text-xs text-ink-light flex flex-wrap gap-x-3 gap-y-1">
          <span><span class="font-medium text-ink tabular-nums">{{ withCoverPercent }}%</span> with cover</span>
          <span aria-hidden="true">·</span>
          <span><span class="font-medium text-ink tabular-nums">{{ withDescriptionPercent }}%</span> with description</span>
          <span aria-hidden="true">·</span>
          <span>avg condition <span class="font-medium text-ink tabular-nums">{{ avgCondition }} / 100</span></span>
          <template v-if="topOwners.length > 1">
            <span aria-hidden="true">·</span>
            <span>
              most-stocked owner:
              <span class="font-medium text-ink">{{ topOwners[0].name }}</span>
              ({{ topOwners[0].count }})
            </span>
          </template>
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, type FunctionalComponent } from 'vue'
import type { LibraryBook } from '@shared/LibraryBook'

const props = withDefaults(defineProps<{
  books: LibraryBook[]
  /** Total library size (for context when `books` is filtered down). */
  totalAll?: number
}>(), {
  totalAll: 0,
})

const total = computed(() => props.books.length)
const totalAll = computed(() => props.totalAll || total.value)
const isFiltered = computed(() => totalAll.value > 0 && total.value !== totalAll.value)

const readCount = computed(() => props.books.filter(b => b.read).length)
const readPercent = computed(() => total.value === 0 ? 0 : Math.round(100 * readCount.value / total.value))

const totalPages = computed(() => props.books.reduce((s, b) => s + (b.pageCount ?? 0), 0))
const booksWithPages = computed(() => props.books.filter(b => b.pageCount != null && b.pageCount > 0).length)
const avgPages = computed(() => booksWithPages.value === 0 ? 0 : Math.round(totalPages.value / booksWithPages.value))

/** Distinct authors (case-insensitive, whitespace-trimmed). */
const uniqueAuthors = computed(() => {
  const set = new Set<string>()
  for (const b of props.books) {
    for (const a of b.authors) {
      const k = a.trim().toLowerCase()
      if (k) set.add(k)
    }
  }
  return set.size
})

interface CategoryRow { name: string; count: number; percent: number }

/** Top 5 categories by frequency. `percent` is relative to the busiest
 *  category so the bar widths visually compare counts. */
const topCategories = computed<CategoryRow[]>(() => {
  const counts = new Map<string, number>()
  for (const b of props.books) {
    for (const c of b.categories) {
      const k = c.trim()
      if (!k) continue
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const top = sorted.slice(0, 5)
  const max = top[0]?.[1] ?? 0
  return top.map(([name, count]) => ({
    name,
    count,
    percent: max ? Math.round(100 * count / max) : 0,
  }))
})

const avgMotivation = computed(() => {
  if (total.value === 0) return 0
  const sum = props.books.reduce((s, b) => s + b.readMotivation, 0)
  return Math.round(sum / total.value)
})
const motivationHigh = computed(() => props.books.filter(b => b.readMotivation >= 75).length)
const motivationMid  = computed(() => props.books.filter(b => b.readMotivation >= 25 && b.readMotivation < 75).length)
const motivationLow  = computed(() => props.books.filter(b => b.readMotivation < 25).length)

const avgCondition = computed(() => {
  if (total.value === 0) return 0
  const sum = props.books.reduce((s, b) => s + b.physicalCondition, 0)
  return Math.round(sum / total.value)
})

const withCover = computed(() => props.books.filter(b => b.thumbnail.trim()).length)
const withCoverPercent = computed(() => total.value === 0 ? 0 : Math.round(100 * withCover.value / total.value))
const withDescription = computed(() => props.books.filter(b => b.description.trim()).length)
const withDescriptionPercent = computed(() => total.value === 0 ? 0 : Math.round(100 * withDescription.value / total.value))

interface OwnerRow { name: string; count: number }
const topOwners = computed<OwnerRow[]>(() => {
  const counts = new Map<string, number>()
  for (const b of props.books) {
    const k = b.owner.trim()
    if (!k) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }))
})

function formatNumber(n: number): string {
  return n.toLocaleString()
}

/** Compact stat tile — small label above a large value, optional muted hint. */
const StatTile: FunctionalComponent<{ label: string; value: string; hint?: string }> = (innerProps) => {
  return h('div', { class: 'border border-line bg-paper px-3 py-2' }, [
    h('p', { class: 'text-[10px] uppercase tracking-widest text-ink-lighter' }, innerProps.label),
    h('p', { class: 'text-lg sm:text-xl font-light tabular-nums text-ink leading-tight' }, innerProps.value),
    innerProps.hint
      ? h('p', { class: 'text-[10px] text-ink-lighter mt-0.5' }, innerProps.hint)
      : null,
  ])
}
StatTile.props = ['label', 'value', 'hint']
</script>
