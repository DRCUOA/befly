<!--
  SpineSection — one node in the manuscript spine tree. Renders itself
  (header + item list) and, if the node has children, recurses for each
  child node below.

  Designed to be DOM-equivalent to the legacy inline spine markup in
  ManuscriptDetail.vue at depth=1: the same outer border, header layout,
  drag/drop wiring, and item-row markup. The recursive descent only adds
  DOM when `children.length > 0`, so a depth=1 manuscript renders the
  same nodes in the same order with the same classes — that's how Phase
  4 satisfies the plan's "byte-identical at flag-off" gate without
  forking the renderer.

  Layer label and per-level indent are ADDITIVE — they appear only when
  the parent passes a non-null `layerLabel` (typically when
  manuscript.spineDepth > 1 and the feature flag is on). At depth=1 the
  parent passes null and the chip slot stays empty, keeping the rendered
  DOM identical to today.

  We accept callback props rather than emits for the operations that
  carry context (renameSection, deleteSection, …): emit handlers fan
  out across the tree, and a single callback per action keeps the
  recursive parent → child wiring straightforward without re-emitting at
  every level.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type {
  ManuscriptItem,
  ManuscriptItemType,
  ManuscriptSection,
  ManuscriptSectionPurpose,
  ManuscriptStructuralRole,
  SpineNode,
} from '@shared/Manuscript'

interface Helpers {
  purposeLabel: (p: ManuscriptSectionPurpose) => string
  itemTypeLabel: (t: ManuscriptItemType) => string
  structuralRoleLabel: (r: ManuscriptStructuralRole) => string
  /** 0-based global index of the item across the whole manuscript. */
  globalIndex: (item: ManuscriptItem) => number
}

const props = defineProps<{
  /** This section's row data. */
  section: ManuscriptSection
  /** Items attached to THIS section (already filtered + sorted). */
  items: ManuscriptItem[]
  /** Child tree nodes; empty for leaves and for depth=1 manuscripts. */
  children: SpineNode[]
  /**
   * Items keyed by sectionId — used when recursing into children so the
   * subtree can find its own item lists without re-running the filter
   * at every level. Each subtree is a leaf-only consumer of this map.
   */
  itemsBySectionId: Map<string, ManuscriptItem[]>
  /**
   * Layer label to render in the header chip. Pass null to suppress —
   * that path keeps the depth=1 UI byte-identical to the legacy markup.
   */
  layerLabel: string | null
  /** Whether the current user has write access to this manuscript. */
  canModify: boolean
  /** Current drag-over item id (shared across the whole tree so highlight is consistent). */
  dragOverItemId: string | null
  /** Manuscript's configured spine depth — used to know which level is the leaf. */
  manuscriptSpineDepth: number
  /** Label functions + globalIndex from the parent (already bound). */
  helpers: Helpers
  /** All per-action callbacks the parent provides; recursive children re-pass these unchanged. */
  onRenameSection: (section: ManuscriptSection) => void
  onDeleteSection: (section: ManuscriptSection) => void
  onDeleteItem: (item: ManuscriptItem) => void
  onDropOnSection: (event: DragEvent, sectionId: string | null) => void
  onDropBeforeItem: (event: DragEvent, item: ManuscriptItem) => void
  onDragStart: (event: DragEvent, itemId: string) => void
  /** Mouse moves into / out of an item row; parent owns the highlight state. */
  onDragOverItem: (itemId: string) => void
  onDragLeaveItem: () => void
  /** Pass-through label resolver for child nodes (parent computes from spineLayerLabels[level-1]). */
  resolveLayerLabel: (level: number) => string | null
}>()

/**
 * True when this section is at the manuscript's deepest level. Items
 * may only attach to deepest-level sections — the central invariant
 * from the Configurable Spine Depth Refactor. The drop-on-section
 * handler uses this to reject item drops into non-leaf containers.
 */
const isLeafContainer = computed(() => props.section.level === props.manuscriptSpineDepth)

/**
 * Per-level indent. Inline style rather than a Tailwind class so the
 * value can be computed: Tailwind's JIT only picks up class names
 * present as literals in source files, which forbids the obvious
 * `ml-${level * 4}` pattern. Zero indent at level 1 (or when no layer
 * label is supplied) keeps depth=1 manuscripts byte-identical.
 */
const indentStyle = computed<Record<string, string>>(() => {
  if (!props.layerLabel || props.section.level <= 1) return {} as Record<string, string>
  // Cap visual indent so deep trees don't push the card off-screen on
  // narrow viewports. Step is 1rem per layer; 3 layers of indent
  // covers MAX_SPINE_DEPTH=4 (level 1..4).
  const step = Math.min(props.section.level - 1, 3)
  return { marginLeft: `${step}rem` }
})

/**
 * Wrap the parent's onDropOnSection to enforce the items-only-at-leaf
 * invariant client-side. Without this check the server would still
 * reject the move, but the user would see a flash of optimistic state
 * before the error rolls back. Catching it before the API call keeps
 * the UI honest and avoids a wasted round-trip.
 */
function handleDropOnSection(event: DragEvent) {
  if (!isLeafContainer.value) {
    // The drop is silently swallowed at non-leaf containers. The visual
    // affordance (item rows only inside leaves) should make this rare;
    // a future enhancement could surface a toast here.
    event.preventDefault()
    return
  }
  props.onDropOnSection(event, props.section.id)
}
</script>

<template>
  <!--
    Outer card. The same border + paper styling as today's flat spine.
    The per-level left margin is conditional on `layerLabel` rather than
    `section.level > 1` so depth=1 manuscripts stay byte-identical (no
    margin offset when the parent decides not to show layer labels).
  -->
  <div
    class="border border-line bg-paper"
    :style="indentStyle"
    @dragover.prevent
    @drop="handleDropOnSection"
  >
    <header class="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <!--
          Layer-label chip — additive, only when the parent decided this
          tree is deep enough to warrant labels. Suppressed by `v-if` so
          depth=1 DOM is identical to the legacy markup (no empty
          element, no extra classes).
        -->
        <span
          v-if="layerLabel"
          class="text-[10px] uppercase tracking-widest text-ink-lighter/80 font-sans shrink-0 px-1.5 py-0.5 border border-line rounded-sm"
          :title="`Layer: ${layerLabel}`"
        >{{ layerLabel }}</span>
        <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans shrink-0">
          {{ helpers.purposeLabel(section.purpose) }}
        </span>
        <h3 class="text-lg font-light tracking-tight truncate">{{ section.title }}</h3>
      </div>
      <div v-if="canModify" class="flex items-center gap-1 shrink-0">
        <button
          type="button"
          @click="onRenameSection(section)"
          class="p-1 text-ink-lighter hover:text-ink"
          title="Rename"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button
          type="button"
          @click="onDeleteSection(section)"
          class="p-1 text-ink-lighter hover:text-red-600"
          title="Delete (items remain, unassigned)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </header>

    <!--
      Items list. Rendered only at leaf containers — for non-leaf
      sections (i.e. those at level < spineDepth) the contents are the
      child SpineSections below, not item rows. At depth=1 every
      section is a leaf so this matches the legacy behaviour exactly.
    -->
    <ul v-if="isLeafContainer" class="divide-y divide-line">
      <li
        v-for="item in items"
        :key="item.id"
        class="px-5 py-4 flex items-start gap-3 transition-colors"
        :class="{
          'cursor-grab': canModify,
          'bg-surface': dragOverItemId === item.id,
        }"
        :draggable="canModify"
        @dragstart="onDragStart($event, item.id)"
        @dragover.prevent="onDragOverItem(item.id)"
        @dragleave="onDragLeaveItem"
        @drop.stop="onDropBeforeItem($event, item)"
      >
        <span class="text-xs text-ink-lighter font-sans w-6 shrink-0 mt-1">{{ helpers.globalIndex(item) + 1 }}</span>
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-baseline gap-2">
            <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
              {{ helpers.itemTypeLabel(item.itemType) }}
            </span>
            <span v-if="item.structuralRole" class="text-xs text-ink-lighter italic">
              &middot; {{ helpers.structuralRoleLabel(item.structuralRole) }}
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
            title="Read frag"
            @click.stop
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </router-link>
          <button
            type="button"
            @click.stop="onDeleteItem(item)"
            class="p-1 text-ink-lighter hover:text-red-600"
            title="Remove from manuscript"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </li>
      <li
        v-if="items.length === 0"
        class="px-5 py-6 text-sm text-ink-lighter italic text-center"
      >
        Empty section. Drop an item here.
      </li>
    </ul>

    <!--
      Recursive descent for non-leaf containers. Each child SpineSection
      receives the same callback bag plus its own item slice from the
      shared map. The component imports itself by name (Vue 3 supports
      this directly in script-setup SFCs).
    -->
    <div v-if="children.length > 0" class="space-y-3 px-3 py-3 bg-surface/30">
      <SpineSection
        v-for="child in children"
        :key="child.section.id"
        :section="child.section"
        :items="itemsBySectionId.get(child.section.id) ?? []"
        :children="child.children"
        :items-by-section-id="itemsBySectionId"
        :layer-label="resolveLayerLabel(child.section.level)"
        :can-modify="canModify"
        :drag-over-item-id="dragOverItemId"
        :manuscript-spine-depth="manuscriptSpineDepth"
        :helpers="helpers"
        :on-rename-section="onRenameSection"
        :on-delete-section="onDeleteSection"
        :on-delete-item="onDeleteItem"
        :on-drop-on-section="onDropOnSection"
        :on-drop-before-item="onDropBeforeItem"
        :on-drag-start="onDragStart"
        :on-drag-over-item="onDragOverItem"
        :on-drag-leave-item="onDragLeaveItem"
        :resolve-layer-label="resolveLayerLabel"
      />
    </div>
  </div>
</template>
