<template>
  <div
    ref="clusterRootRef"
    class="writing-tools-cluster"
    role="toolbar"
    aria-label="Writing tools"
    aria-orientation="vertical"
    :class="[
      {
        'is-active': hasActiveMode || isHovering,
        'is-floating': !isFixed,
        'is-dragging': isDragging,
        'is-pinned': userPosition !== null,
        'is-horizontal': orientation === 'horizontal',
      },
    ]"
    :style="clusterStyle"
    @pointerdown="onPointerDown"
    @click.capture="onClickCapture"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
    @focusin="isHovering = true"
    @focusout="isHovering = false"
  >
    <!-- Rotation handles — small dots on the top and bottom of the
         border. Visible only when unlocked. Drag one to spin the cluster
         around its centre to any angle, including inverted. -->
    <div
      v-if="!isFixed"
      class="rotate-dot rotate-dot-top"
      role="button"
      aria-label="Rotate cluster"
      title="Drag to rotate"
      @pointerdown="(e) => onRotateDotPointerDown(e, 'top')"
    ></div>
    <div
      v-if="!isFixed"
      class="rotate-dot rotate-dot-bottom"
      role="button"
      aria-label="Rotate cluster"
      title="Drag to rotate"
      @pointerdown="(e) => onRotateDotPointerDown(e, 'bottom')"
    ></div>
    <!-- Group 1 — page actions (save, metadata, exit). These replace what
         used to be the bottom footer of Write.vue. Save sits on top as the
         primary action; metadata and exit follow. -->
    <button
      type="button"
      class="tool-button is-primary"
      :class="{ 'is-disabled': saveBusy || saveDisabled }"
      :aria-label="saveBusy ? 'Saving…' : (isEditing ? 'Update' : 'Publish')"
      :title="saveBusy ? 'Saving…' : (isEditing ? 'Update' : 'Publish')"
      :disabled="saveBusy || saveDisabled"
      @click="$emit('save')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 3h9l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M6 3v5h7V3" />
        <path d="M6 12h8" />
        <path d="M6 15h8" />
      </svg>
      <span class="tool-label">{{ saveBusy ? 'Saving…' : (isEditing ? 'Update' : 'Publish') }}</span>
    </button>

    <button
      type="button"
      class="tool-button"
      :class="{ 'is-active': metadataOpen }"
      aria-label="Metadata (cover, themes, visibility)"
      title="Metadata (cover, themes, visibility)"
      @click="$emit('metadata')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 5h12" />
        <circle cx="7" cy="5" r="1.6" fill="currentColor" stroke="none" />
        <path d="M4 10h12" />
        <circle cx="13" cy="10" r="1.6" fill="currentColor" stroke="none" />
        <path d="M4 15h12" />
        <circle cx="9" cy="15" r="1.6" fill="currentColor" stroke="none" />
      </svg>
      <span class="tool-label">Metadata</span>
    </button>

    <button
      type="button"
      class="tool-button"
      aria-label="Exit to essays"
      title="Exit to essays"
      @click="$emit('exit')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M11 4h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4" />
        <path d="M3 10h10" />
        <path d="M6 7l-3 3 3 3" />
      </svg>
      <span class="tool-label">Exit</span>
    </button>

    <!-- Visual separator between page actions and font controls -->
    <div class="cluster-divider" aria-hidden="true"></div>

    <!-- Font size up — bigger 'A' on top of the icon -->
    <button
      type="button"
      class="tool-button"
      aria-label="Increase body font size"
      title="Larger text"
      @click="$emit('font-up')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <text x="10" y="14" text-anchor="middle"
              font-family="Courier Prime, monospace"
              font-size="14" font-weight="700">A+</text>
      </svg>
      <span class="tool-label">Larger</span>
    </button>

    <!-- Font size down — smaller 'A' on top of the icon -->
    <button
      type="button"
      class="tool-button"
      aria-label="Decrease body font size"
      title="Smaller text"
      @click="$emit('font-down')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <text x="10" y="14" text-anchor="middle"
              font-family="Courier Prime, monospace"
              font-size="11" font-weight="700">A−</text>
      </svg>
      <span class="tool-label">Smaller</span>
    </button>

    <!-- Visual separator between font controls and AI tools -->
    <div class="cluster-divider" aria-hidden="true"></div>

    <!-- Group 2 — AI assist tools -->
    <button
      v-for="tool in aiTools"
      :key="tool.mode"
      type="button"
      class="tool-button"
      :class="{ 'is-active': activeMode === tool.mode, 'is-disabled': tool.requiresSelection && !hasSelection }"
      :aria-label="`${tool.label}${tool.requiresSelection ? ' — needs a text selection' : ''}`"
      :title="tool.tooltip"
      :disabled="tool.requiresSelection && !hasSelection"
      @click="$emit('select', tool.mode)"
    >
      <!-- Icons are inline SVG with currentColor strokes so they pick up
           text-color from CSS (theme-aware in light + dark). 18px icons. -->
      <svg
        v-if="tool.mode === 'coherence'"
        width="18" height="18" viewBox="0 0 20 20"
        fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <path d="M3.5 5.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8l-3.5 3v-3h-1a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
        <path d="M7 9h7" />
        <path d="M7 11.5h4.5" />
      </svg>
      <svg
        v-else-if="tool.mode === 'define'"
        width="18" height="18" viewBox="0 0 20 20"
        fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <path d="M4 3.5h9.5a1.5 1.5 0 0 1 1.5 1.5v11.5l-3-2-2.5 2-2.5-2-3 2V5a1.5 1.5 0 0 1 1.5-1.5z" />
        <path d="M7 7.5h6" />
        <path d="M7 10h4" />
      </svg>
      <svg
        v-else-if="tool.mode === 'focus'"
        width="18" height="18" viewBox="0 0 20 20"
        fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <circle cx="10" cy="10" r="6" />
        <circle cx="10" cy="10" r="2" />
        <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2" />
      </svg>
      <svg
        v-else-if="tool.mode === 'expand'"
        width="18" height="18" viewBox="0 0 20 20"
        fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4" />
        <path d="M7 7l-3-3M13 7l3-3M7 13l-3 3M13 13l3 3" />
      </svg>
      <svg
        v-else-if="tool.mode === 'proofread'"
        width="18" height="18" viewBox="0 0 20 20"
        fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <path d="M3 4.5h11" />
        <path d="M3 8.5h8" />
        <path d="M3 12.5h6" />
        <path d="M12 14l2 2 4-5" />
      </svg>
      <svg
        v-else-if="tool.mode === 'factcheck'"
        width="18" height="18" viewBox="0 0 20 20"
        fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <!-- magnifying glass with a checkmark inside the lens —
             reads as "scrutinise + verify" -->
        <circle cx="8.5" cy="8.5" r="5" />
        <path d="M6 8.5l2 2 3.5-4" />
        <path d="M12.5 12.5l4.5 4.5" />
      </svg>

      <!-- Label visible on hover/focus only — keeps the rest button-only -->
      <span class="tool-label">{{ tool.label }}</span>
    </button>

    <!-- ============================================================
         "Develop" sub-menu — single top-level button that opens a
         popover with the four breadth/depth modes. Grouped by register
         (fiction / non-fiction). Modelled on the model-picker popover
         so the cluster's interaction surface stays consistent: one
         click opens the layer, second click picks the action.

         Why a sub-menu and not four flat buttons? Each Develop mode is
         opinionated — fiction vs non-fiction, breadth vs depth — and
         flattening them into the toolbar would quadruple the visible
         icons. The sub-menu keeps the top layer at six AI buttons,
         which preserves the zen feel.
    ============================================================ -->
    <div class="develop-picker-wrapper">
      <button
        type="button"
        class="tool-button develop-picker-button"
        :class="{
          'is-active': developPickerOpen || isDevelopModeActive,
          'is-disabled': false,
        }"
        :aria-label="`Develop — broaden or deepen the piece. Currently: ${currentDevelopLabel}`"
        :aria-haspopup="true"
        :aria-expanded="developPickerOpen"
        title="Develop — broaden or deepen the piece"
        @click="developPickerOpen = !developPickerOpen"
      >
        <!-- Sapling-with-fork icon: trunk forking into two branches.
             Reads as "growing in two directions" — appropriate for
             the breadth/depth split. Chevron pip in the corner hints
             that this opens a sub-menu. -->
        <svg
          width="18" height="18" viewBox="0 0 20 20"
          fill="none" stroke="currentColor" stroke-width="1.4"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        >
          <!-- Trunk -->
          <path d="M10 17V9" />
          <!-- Left branch — broader/lower -->
          <path d="M10 12L5.5 7.5" />
          <path d="M5.5 7.5h2" />
          <path d="M5.5 7.5v2" />
          <!-- Right branch — deeper/higher -->
          <path d="M10 9L14.5 4.5" />
          <path d="M14.5 4.5h-2" />
          <path d="M14.5 4.5v2" />
          <!-- Tiny chevron pip bottom-right indicates 'opens a menu' -->
          <path d="M14.5 15.5l1.25 1.25L17 15.5" stroke-width="1.2" />
        </svg>
        <span class="tool-label">Develop</span>
      </button>

      <div
        v-if="developPickerOpen"
        class="develop-picker-popover"
        role="menu"
        @click.stop
      >
        <div class="develop-group">
          <p class="develop-group-heading">Fiction</p>
          <button
            v-for="opt in DEVELOP_OPTIONS_FICTION"
            :key="opt.mode"
            type="button"
            class="develop-option"
            :class="{ 'is-selected': activeMode === opt.mode }"
            role="menuitem"
            @click="selectDevelop(opt.mode)"
          >
            <span class="develop-option-label">{{ opt.label }}</span>
            <span class="develop-option-caption">{{ opt.caption }}</span>
          </button>
        </div>
        <div class="develop-group-divider" aria-hidden="true"></div>
        <div class="develop-group">
          <p class="develop-group-heading">Non-fiction</p>
          <button
            v-for="opt in DEVELOP_OPTIONS_NONFICTION"
            :key="opt.mode"
            type="button"
            class="develop-option"
            :class="{ 'is-selected': activeMode === opt.mode }"
            role="menuitem"
            @click="selectDevelop(opt.mode)"
          >
            <span class="develop-option-label">{{ opt.label }}</span>
            <span class="develop-option-caption">{{ opt.caption }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Divider before the model picker + fix/float toggle -->
    <div class="cluster-divider" aria-hidden="true"></div>

    <!-- Model picker — small button showing the current model number;
         click opens a popover listing the four allow-listed models. -->
    <div class="model-picker-wrapper">
      <button
        type="button"
        class="tool-button model-picker-button"
        :class="{ 'is-active': modelPickerOpen }"
        :aria-label="`AI model: ${currentModelLabel}. Click to change.`"
        :title="`Model: ${currentModelLabel}`"
        @click="modelPickerOpen = !modelPickerOpen"
      >
        <span class="model-badge">{{ currentModelBadge }}</span>
        <span class="tool-label">Model: {{ currentModelLabel }}</span>
      </button>
      <div
        v-if="modelPickerOpen"
        class="model-picker-popover"
        role="menu"
        @click.stop
      >
        <button
          v-for="opt in MODEL_OPTIONS"
          :key="opt.id"
          type="button"
          class="model-option"
          :class="{ 'is-selected': opt.id === model }"
          role="menuitemradio"
          :aria-checked="opt.id === model"
          @click="selectModel(opt.id)"
        >
          <span class="model-option-label">{{ opt.label }}</span>
          <span class="model-option-caption">{{ opt.caption }}</span>
        </button>
      </div>
    </div>

    <!-- Divider before the fix/float toggle -->
    <div class="cluster-divider" aria-hidden="true"></div>

    <!-- Fix/float toggle — padlock icon at the bottom of the rack.
         Closed shackle = locked in place (cluster stays bottom-right).
         Open shackle   = floating (cluster tracks the cursor's Y). -->
    <button
      type="button"
      class="tool-button"
      :class="{ 'is-active': !isFixed }"
      :aria-label="isFixed ? 'Unlock cluster (float with cursor)' : 'Lock cluster in place'"
      :title="isFixed ? 'Unlock — float with cursor' : (userPosition !== null ? 'Lock here' : 'Lock — stay in place')"
      @click="toggleLock"
    >
      <!-- Closed padlock — when isFixed -->
      <svg
        v-if="isFixed"
        width="18" height="18" viewBox="0 0 20 20"
        fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <rect x="4" y="9" width="12" height="8" rx="1.5" />
        <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
        <circle cx="10" cy="13" r="1" fill="currentColor" stroke="none" />
      </svg>
      <!-- Open padlock — when !isFixed -->
      <svg
        v-else
        width="18" height="18" viewBox="0 0 20 20"
        fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <rect x="4" y="9" width="12" height="8" rx="1.5" />
        <path d="M6.5 9V6.5a3.5 3.5 0 0 1 6.5-1.8" />
        <circle cx="10" cy="13" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span class="tool-label">{{ isFixed ? 'Locked' : 'Floating' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { WritingAssistMode } from '@shared/WritingAssist'

interface Props {
  /** True if the textarea has a non-empty selection. Drives disabled state on tools that require one. */
  hasSelection: boolean
  /** The currently-open AI mode, or null if the panel is closed. Used to highlight the active tool. */
  activeMode: WritingAssistMode | null
  /** Are we editing an existing essay (Update) or creating a new one (Publish)? */
  isEditing: boolean
  /** True while the save request is in flight. */
  saveBusy: boolean
  /** True when save should be disabled (e.g. nothing to save, loading). */
  saveDisabled: boolean
  /** True when the metadata side-panel is open. Highlights the metadata icon. */
  metadataOpen: boolean
  /**
   * Cursor's Y position in the viewport, in pixels. Used in float mode to
   * keep the cluster's bottom edge 10px above the cursor. Pass null when
   * the cursor isn't in the textarea (the cluster falls back to its
   * fixed position then).
   */
  cursorY: number | null
  /** Currently-selected OpenAI model id. v-model:model from the parent. */
  model: string
}

const props = defineProps<Props>()

/** Internal — controls whether the cluster is locked to its corner (true)
 *  or follows the cursor in the viewport (false). The padlock icon at the
 *  bottom of the rack toggles this. State is local since the parent
 *  doesn't need to know — it just keeps providing cursor Y. */
const isFixed = ref(true)

/** Custom position the writer dragged the cluster to. Takes precedence
 *  over both the default corner placement and cursor-tracking when set.
 *  Cleared whenever the writer unlocks the cluster (so each unlock starts
 *  fresh — they can either let it track the cursor again or drag it
 *  somewhere new and lock it). */
const userPosition = ref<{ left: number; top: number } | null>(null)

/** Visual flag for the drag in progress — adds is-dragging class so the
 *  cluster's CSS transition can be disabled while the pointer is moving. */
const isDragging = ref(false)

/** Template ref to the cluster element — used for measurement during drag
 *  (we read its bounding rect to compute the start position). */
const clusterRootRef = ref<HTMLElement | null>(null)

/** Cluster layout orientation. Auto-flips to horizontal when the writer
 *  drags the cluster so its center sits over the writing block's horizontal
 *  range — keeps the icons from covering too much vertical prose. */
const orientation = ref<'vertical' | 'horizontal'>('vertical')

/** Manual rotation in degrees. Driven by the top/bottom dot handles.
 *  0 is upright; positive rotates clockwise; 180 is inverted; any value
 *  is allowed. Stacks on top of orientation — i.e. a horizontal cluster
 *  rotated 90° still has a rotated-horizontal feel. */
const rotation = ref<number>(0)

/** Computed style. Three cases, in priority order:
 *   1. userPosition is set → use it (locked OR floating, doesn't matter
 *      — once dragged, the cluster stays put).
 *   2. !isFixed and cursorY is available → track 10px above the cursor.
 *   3. Otherwise → empty style; the static CSS (bottom: 28px right: 18px)
 *      applies and the cluster sits in its default corner. */
const clusterStyle = computed<Record<string, string>>(() => {
  // Build the position style first…
  let style: Record<string, string> = {}
  if (userPosition.value !== null) {
    style = {
      top:    `${userPosition.value.top}px`,
      left:   `${userPosition.value.left}px`,
      bottom: 'auto',
      right:  'auto',
    }
  } else if (!isFixed.value && props.cursorY !== null) {
    style = {
      bottom: `calc(100vh - ${props.cursorY}px + 10px)`,
      top:    'auto',
    }
  }
  // …then apply manual rotation on top of whatever positioning is active.
  // transform-origin defaults to the cluster's centre, so the visual
  // anchor stays put while the cluster spins around itself.
  if (rotation.value !== 0) {
    style.transform = `rotate(${rotation.value}deg)`
  }
  return style
})

/* ============================================================
 * Lock toggle. Clicking the padlock either locks the cluster in place
 * (preserving any custom userPosition) or unlocks it and CLEARS the
 * custom position so cursor-tracking resumes. This keeps the model
 * simple: each unlock starts a fresh float; drag if you want a custom
 * spot; lock to fix it.
 * ============================================================ */
function toggleLock() {
  if (isFixed.value) {
    // Unlocking — clear any prior dragged position AND rotation so the
    // cluster resumes following the cursor immediately, upright. If the
    // writer wants to lock it back at a custom spot or angle, they drag
    // / rotate and then lock.
    isFixed.value = false
    userPosition.value = null
    orientation.value = 'vertical'
    rotation.value = 0
  } else {
    // Locking — keep userPosition + rotation as-is (cluster stays at
    // dragged location and angle). If both are null/0, the cluster
    // reverts to its default corner upright.
    isFixed.value = true
  }
  saveStateToStorage()
}

/* ============================================================
 * Rotation handles. Two dots on the top and bottom of the border —
 * grab one, drag, the cluster rotates around its centre to follow the
 * pointer. Inverted (180°) is reachable; any angle in between works.
 * ============================================================ */

let rotateState: { dotSide: 'top' | 'bottom' } | null = null

function onRotateDotPointerDown(e: PointerEvent, side: 'top' | 'bottom') {
  if (e.button !== 0) return
  // Stop propagation so the cluster's own pointerdown (drag) handler
  // doesn't also trigger — this gesture is purely rotational.
  e.stopPropagation()
  e.preventDefault()
  rotateState = { dotSide: side }
  isDragging.value = true // suppress transitions during the rotation
  window.addEventListener('pointermove', onWindowRotateMove)
  window.addEventListener('pointerup',   onWindowRotateUp,   { once: false })
  window.addEventListener('pointercancel', onWindowRotateUp, { once: false })
}

function onWindowRotateMove(e: PointerEvent) {
  if (!rotateState) return
  const root = clusterRootRef.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top  + rect.height / 2
  // Angle from cluster centre to pointer, in degrees. atan2 returns
  // [-π, π]; right = 0°, down = +90°, up = −90°.
  const dx = e.clientX - centerX
  const dy = e.clientY - centerY
  const pointerAngle = Math.atan2(dy, dx) * (180 / Math.PI)
  // The dots sit on different cluster edges depending on orientation:
  //   vertical:   top → above centre (−90°), bottom → below (+90°)
  //   horizontal: top → left of centre (180°), bottom → right (0°)
  // For the pointer to land on the dot, rotation = pointerAngle − natural.
  let naturalAngle: number
  if (orientation.value === 'horizontal') {
    naturalAngle = rotateState.dotSide === 'top' ? 180 : 0
  } else {
    naturalAngle = rotateState.dotSide === 'top' ? -90 : 90
  }
  rotation.value = pointerAngle - naturalAngle
}

function onWindowRotateUp() {
  if (!rotateState) return
  rotateState = null
  // Re-enable transitions BEFORE snapping so the snap animates the short
  // way around instead of jumping. Vue batches the next reactive write
  // (rotation.value below) into the same DOM update, so the transform
  // transition picks it up.
  isDragging.value = false
  window.removeEventListener('pointermove', onWindowRotateMove)
  window.removeEventListener('pointerup',   onWindowRotateUp)
  window.removeEventListener('pointercancel', onWindowRotateUp)

  // Snap to the nearest 45° increment. Math.round((angle / 45)) * 45 picks
  // the closest multiple regardless of sign or magnitude — so 47° → 45°,
  // 100° → 90°, 358° → 360° (effectively 0°). We deliberately don't
  // normalize the absolute value here: keeping the raw rounded number
  // preserves the visual short-path between the writer's release angle
  // and the snapped target. Storage size is trivial either way.
  rotation.value = Math.round(rotation.value / 45) * 45

  saveStateToStorage()
}

/* ============================================================
 * Drag-to-reposition. Active only when unlocked. A 4px threshold
 * separates a click on a button from an actual drag, so the AI tools
 * + page actions still work normally with a single click.
 * ============================================================ */

const DRAG_THRESHOLD_PX = 4

interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startLeft: number
  startTop: number
  passedThreshold: boolean
}
let drag: DragState | null = null
/** Set true on pointerup when a drag actually moved past threshold,
 *  so the next click event (synthesized from the pointer interaction)
 *  is suppressed — otherwise the dragged button would fire its action. */
let suppressNextClick = false

function onPointerDown(e: PointerEvent) {
  if (isFixed.value) return // dragging only allowed when unlocked
  if (e.button !== 0) return // primary button only
  const root = clusterRootRef.value
  if (!root) return

  const rect = root.getBoundingClientRect()
  drag = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startLeft: rect.left,
    startTop: rect.top,
    passedThreshold: false,
  }

  // Listen on window so the drag continues even if the pointer leaves
  // the cluster's bounds. Removed in onWindowPointerUp.
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup',   onWindowPointerUp,   { once: false })
  window.addEventListener('pointercancel', onWindowPointerUp, { once: false })
}

function onWindowPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return

  const dx = e.clientX - drag.startClientX
  const dy = e.clientY - drag.startClientY

  if (!drag.passedThreshold) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    drag.passedThreshold = true
    isDragging.value = true
  }

  // Compute new position, clamped to viewport so the cluster never
  // disappears off-screen.
  const root = clusterRootRef.value
  const w = root?.offsetWidth ?? 0
  const h = root?.offsetHeight ?? 0
  const left = Math.max(0, Math.min(window.innerWidth  - w, drag.startLeft + dx))
  const top  = Math.max(0, Math.min(window.innerHeight - h, drag.startTop  + dy))
  userPosition.value = { left, top }
}

function onWindowPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return

  const wasDragging = drag.passedThreshold
  drag = null
  isDragging.value = false
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup',   onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)

  if (wasDragging) {
    // The synthesized click that follows pointerup must NOT fire on the
    // button the writer happened to start the drag from — they meant to
    // move the cluster, not run that tool. onClickCapture below will
    // swallow the next click event and reset the flag.
    suppressNextClick = true
    // Re-detect orientation now that the cluster has settled at its
    // new position; persist the whole state.
    refreshOrientation()
    saveStateToStorage()
  }
}

function onClickCapture(e: MouseEvent) {
  if (!suppressNextClick) return
  suppressNextClick = false
  e.stopPropagation()
  e.preventDefault()
}

/* ============================================================
 * Auto-orientation. When the dragged cluster's centre sits inside the
 * writing block's horizontal range, flip to a horizontal layout so the
 * icons stack across instead of down — that way the cluster occupies
 * one row of prose rather than blocking many lines vertically.
 *
 * Detection uses a global selector to find the textarea#body. Cheap
 * and resilient; falls back to vertical if the textarea isn't present.
 * ============================================================ */
function detectOrientation(): 'vertical' | 'horizontal' {
  // No custom position → default corner → always vertical.
  if (userPosition.value === null) return 'vertical'
  const ta = document.querySelector('textarea#body') as HTMLTextAreaElement | null
  if (!ta) return 'vertical'
  const taRect = ta.getBoundingClientRect()
  const root = clusterRootRef.value
  // Use current cluster width (which depends on current orientation —
  // that's fine: the centre-overlap test is robust to either width).
  const clusterW = root?.offsetWidth ?? 48
  const clusterCentre = userPosition.value.left + clusterW / 2
  return (clusterCentre >= taRect.left && clusterCentre <= taRect.right)
    ? 'horizontal'
    : 'vertical'
}

function refreshOrientation() {
  orientation.value = detectOrientation()
}

/* ============================================================
 * Persistence — isFixed + orientation + userPosition saved to
 * localStorage under one key. State survives page reload, app restart,
 * and route navigation. To reset to defaults: clear the storage entry
 * (DevTools → Application → Local Storage) or do a hard reload after
 * clearing site data.
 * ============================================================ */
const STORAGE_KEY = 'rambulations-cluster-state'

interface StoredClusterState {
  isFixed?: boolean
  orientation?: 'vertical' | 'horizontal'
  userPosition?: { left: number; top: number } | null
  rotation?: number
}

function loadStateFromStorage(): StoredClusterState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as StoredClusterState
  } catch {
    return null
  }
}

function saveStateToStorage() {
  try {
    const state: StoredClusterState = {
      isFixed: isFixed.value,
      orientation: orientation.value,
      userPosition: userPosition.value,
      rotation: rotation.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded or storage unavailable — ignore. Cluster still works,
    // just won't remember placement next session.
  }
}

/** Re-clamp a remembered position so it can't be off-screen after a
 *  viewport change between sessions (window resize, different display, etc.) */
function clampPositionToViewport(p: { left: number; top: number }): { left: number; top: number } {
  const root = clusterRootRef.value
  const w = root?.offsetWidth ?? 48
  const h = root?.offsetHeight ?? 350
  return {
    left: Math.max(0, Math.min(window.innerWidth  - w, p.left)),
    top:  Math.max(0, Math.min(window.innerHeight - h, p.top)),
  }
}

/* ============================================================
 * Lifecycle: load saved state on mount, listen for resize so a
 * remembered position re-clamps and orientation re-detects.
 * ============================================================ */
onMounted(async () => {
  const state = loadStateFromStorage()
  if (state) {
    if (typeof state.isFixed === 'boolean') isFixed.value = state.isFixed
    if (state.orientation === 'horizontal' || state.orientation === 'vertical') {
      orientation.value = state.orientation
    }
    if (typeof state.rotation === 'number' && Number.isFinite(state.rotation)) {
      rotation.value = state.rotation
    }
    if (state.userPosition
        && typeof state.userPosition.left === 'number'
        && typeof state.userPosition.top === 'number') {
      // Set orientation first so the cluster reflows to the right size;
      // wait for DOM to flush; then clamp position to current viewport.
      await nextTick()
      userPosition.value = clampPositionToViewport(state.userPosition)
    }
  }

  window.addEventListener('resize', onWindowResize)
  window.addEventListener('pointerdown', onWindowPointerDownForPicker)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('pointerdown', onWindowPointerDownForPicker)
})

function onWindowResize() {
  // Re-clamp the remembered position so the cluster stays on-screen,
  // and re-detect orientation in case the writing block moved relative
  // to the cluster.
  if (userPosition.value !== null) {
    userPosition.value = clampPositionToViewport(userPosition.value)
  }
  refreshOrientation()
}

const emit = defineEmits<{
  /** AI tool clicked. Parent opens the assist panel in this mode. */
  select: [WritingAssistMode]
  /** Save / Publish / Update clicked. */
  save: []
  /** Metadata icon clicked. */
  metadata: []
  /** Exit icon clicked — return to the writer's previous page. */
  exit: []
  /** Bump the body font size up by one step. */
  'font-up': []
  /** Bump the body font size down by one step. */
  'font-down': []
  /** Writer picked a different model from the popover. v-model:model. */
  'update:model': [string]
}>()

const isHovering = ref(false)

/** Develop sub-menu open/closed. Declared up here so the `hasActiveMode`
 *  computed below can reference it without a forward reference — Vue's
 *  computed is lazy at runtime, but some bundler configurations evaluate
 *  the closure earlier than expected, so we keep declaration order
 *  strict to avoid surprises. The full Develop-quadrant config and
 *  helpers live further down (DEVELOP_OPTIONS, selectDevelop, etc). */
const developPickerOpen = ref(false)

// Cluster is "active" (full opacity) whenever any panel/popover is open
// or an AI mode is currently selected. Including the Develop popover
// here means opening the sub-menu lights up the cluster the same way
// hovering does — the writer's eye doesn't have to hunt for the picker.
const hasActiveMode = computed(() =>
  props.activeMode !== null
  || props.metadataOpen
  || developPickerOpen.value
)

interface AiTool {
  mode: WritingAssistMode
  label: string
  tooltip: string
  /** True for tools that strictly need a selection (focus). Others fall back to whole-essay mode. */
  requiresSelection: boolean
}

/* ============================================================
 * Model selector — top 4 OpenAI models per platform.openai.com (2026
 * lineup). Keep this list in sync with ALLOWED_MODELS in
 * server/src/controllers/writing.controller.ts; if the two drift, the
 * server will silently ignore the client's choice and fall back to env.
 * ============================================================ */

interface ModelOption {
  id: string
  /** Long label shown in the popover. */
  label: string
  /** Short trailing description shown beneath the label. */
  caption: string
  /** Tiny number/string shown on the cluster icon when selected. */
  badge: string
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gpt-5.5',      label: 'GPT-5.5',      caption: 'Flagship — best quality, slowest',  badge: '5.5'  },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', caption: 'Balanced speed and quality',         badge: '5.4'  },
  { id: 'gpt-4.1',      label: 'GPT-4.1',      caption: 'Strong text + code, cheaper',        badge: '4.1'  },
  { id: 'gpt-4o-mini',  label: 'GPT-4o mini',  caption: 'Fast and inexpensive (default)',     badge: '4o'   },
]

const modelPickerOpen = ref(false)

const currentModelOption = computed<ModelOption>(() =>
  MODEL_OPTIONS.find(m => m.id === props.model) ?? MODEL_OPTIONS[3] // default to gpt-4o-mini if unrecognised
)
const currentModelLabel = computed(() => currentModelOption.value.label)
const currentModelBadge = computed(() => currentModelOption.value.badge)

function selectModel(id: string) {
  emit('update:model', id)
  modelPickerOpen.value = false
}

// Close any open popover (model picker OR develop sub-menu) when the
// writer clicks anywhere outside the cluster. Both popovers stop click
// propagation internally with @click.stop, so a click on the popover
// itself doesn't close it. Mounted/unmounted in the existing lifecycle
// below.
function onWindowPointerDownForPicker(e: PointerEvent) {
  if (!modelPickerOpen.value && !developPickerOpen.value) return
  const root = clusterRootRef.value
  if (!root) return
  if (root.contains(e.target as Node)) return
  modelPickerOpen.value = false
  developPickerOpen.value = false
}

const aiTools: AiTool[] = [
  {
    mode: 'coherence',
    label: 'Ask',
    tooltip: 'Ask a coherence question (character, arc, motif)',
    requiresSelection: false,
  },
  {
    mode: 'define',
    label: 'Define',
    tooltip: 'Define a word or phrase',
    requiresSelection: false,
  },
  {
    mode: 'focus',
    label: 'Focus',
    tooltip: 'Tighten the selection without losing voice',
    requiresSelection: true,
  },
  {
    mode: 'expand',
    label: 'Expand',
    tooltip: 'Add substance — never padding',
    requiresSelection: false,
  },
  {
    mode: 'proofread',
    label: 'Proofread',
    tooltip: 'Light spelling/grammar — preserves voice',
    requiresSelection: false,
  },
  {
    mode: 'factcheck',
    label: 'Fact-check',
    tooltip: 'Check factual claims (selection or whole essay)',
    requiresSelection: false,
  },
]

/* ============================================================
 * Develop sub-menu — four sister modes split across two registers
 * (fiction / non-fiction) and two axes (breadth / depth). Owned by
 * this component because the cluster is the only place they're
 * surfaced; the main aiTools array stays flat so the top toolbar
 * keeps its zen feel.
 *
 * Each option's `caption` is the one-line phrasing the writer reads
 * inside the popover — kept short on purpose; the full prompt-side
 * brief is in server/src/services/llm/prompts.ts.
 * ============================================================ */

interface DevelopOption {
  mode: WritingAssistMode
  label: string
  caption: string
}

const DEVELOP_OPTIONS_FICTION: DevelopOption[] = [
  {
    mode: 'fiction-breadth',
    label: 'Broaden the canvas',
    caption: 'Subplots, POVs, regions, supporting cast',
  },
  {
    mode: 'fiction-depth',
    label: 'Deepen the stakes',
    caption: 'Interiority, backstory, sensory atmosphere',
  },
]

const DEVELOP_OPTIONS_NONFICTION: DevelopOption[] = [
  {
    mode: 'nonfiction-breadth',
    label: 'Cast a wider net',
    caption: 'Adjacent topics, broader inquiry',
  },
  {
    mode: 'nonfiction-depth',
    label: 'Drill down',
    caption: 'Rigorous development of one specific point',
  },
]

/** Combined list — used for label lookup (popover-trigger aria text). */
const DEVELOP_OPTIONS: DevelopOption[] = [
  ...DEVELOP_OPTIONS_FICTION,
  ...DEVELOP_OPTIONS_NONFICTION,
]

/** True when the current activeMode is one of the four develop modes. Used
 *  to keep the trigger button highlighted while the panel is showing a
 *  Develop result, even after the popover has closed. */
const isDevelopModeActive = computed<boolean>(() =>
  props.activeMode != null
  && DEVELOP_OPTIONS.some(o => o.mode === props.activeMode)
)

/** Label shown in the Develop trigger's aria/title when a develop mode is
 *  currently the panel's active mode — gives the writer feedback on which
 *  Develop variant they last picked, without surfacing the full caption. */
const currentDevelopLabel = computed<string>(() => {
  const match = DEVELOP_OPTIONS.find(o => o.mode === props.activeMode)
  return match ? match.label : 'none'
})

/** Selecting an option closes the popover and bubbles the choice up via
 *  the existing `select` event so the parent (Write.vue) can dispatch
 *  the assist request. The popover open/closed state lives further up
 *  in the script (declared above `hasActiveMode` so the latter can
 *  reference it without a forward-reference). */
function selectDevelop(mode: WritingAssistMode) {
  emit('select', mode)
  developPickerOpen.value = false
}
</script>

<style scoped>
/* Floating cluster — bottom-right corner of the viewport.
   Positioned outside the prose so it never crosses what the writer is reading.
   Idle ~30% opacity so it lives quietly in the periphery; full on hover/focus. */
.writing-tools-cluster {
  position: fixed;
  right: 18px;
  /* With the bottom footer gone in zen mode, the cluster can sit closer to
     the corner — but we keep some breathing room so it doesn't kiss the edge. */
  bottom: 28px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 22px;
  background-color: rgb(var(--color-paper) / 0.6);
  /* Accent-color border at low opacity when idle so the cluster reads as
     "burnt-orange-trimmed paper" rather than a generic pill. */
  border: 1px solid rgb(var(--color-accent) / 0.4);
  backdrop-filter: blur(6px);
  opacity: 0.32;
  transition: opacity 220ms ease-out, background-color 220ms ease-out, border-color 220ms ease-out;
}

.writing-tools-cluster.is-active,
.writing-tools-cluster:focus-within {
  opacity: 1;
  background-color: rgb(var(--color-paper));
  border-color: rgb(var(--color-accent));
}

/* Float mode — cluster glides with the cursor. The transition on
   `bottom` smooths the per-keystroke jumps so the cluster reads as
   "following" the cursor rather than teleporting. The transform
   transition smooths the rotation snap-to-45° on dot-release.
   Honors reduced-motion. */
.writing-tools-cluster.is-floating {
  transition:
    bottom    220ms cubic-bezier(0.25, 0.1, 0.25, 1),
    top       220ms cubic-bezier(0.25, 0.1, 0.25, 1),
    left      220ms cubic-bezier(0.25, 0.1, 0.25, 1),
    transform 220ms cubic-bezier(0.25, 0.1, 0.25, 1),
    opacity   220ms ease-out,
    background-color 220ms ease-out,
    border-color    220ms ease-out;
  cursor: grab;
}

/* Pinned — userPosition is set, cluster sits at a custom drag location. */
.writing-tools-cluster.is-pinned {
  cursor: grab;
}

/* Active drag — kill the smooth transition so the cluster sticks to the
   pointer. Cursor flips to grabbing for grab-affordance feedback. */
.writing-tools-cluster.is-dragging {
  transition: none !important;
  cursor: grabbing;
  /* Slight scale + shadow to read as "lifted" while moving. Subtle. */
  box-shadow: 0 8px 18px rgb(var(--color-ink) / 0.18);
}
.writing-tools-cluster.is-dragging .tool-button {
  cursor: grabbing;
  pointer-events: none; /* block hover/focus during drag */
}

@media (prefers-reduced-motion: reduce) {
  .writing-tools-cluster.is-floating {
    transition: opacity 220ms ease-out;
  }
}

.cluster-divider {
  height: 1px;
  margin: 4px 6px;
  background-color: rgb(var(--color-line));
  opacity: 0.7;
}

/* ============================================================
 * Model picker — small button shows the current model number; click
 * opens a popover anchored to the cluster's left edge listing all four
 * model options.
 * ============================================================ */
.model-picker-wrapper {
  position: relative;
}
.model-picker-button .model-badge {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
}
.model-picker-popover {
  position: absolute;
  /* Anchor to the left of the button, with the same gap the tooltip uses. */
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  width: 220px;
  max-width: 240px;
  background-color: rgb(var(--color-paper));
  border: 1px solid rgb(var(--color-accent));
  border-radius: 8px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 50;
  box-shadow: 0 8px 18px rgb(var(--color-ink) / 0.18);
  pointer-events: auto;
}
.model-option {
  appearance: none;
  background: transparent;
  border: none;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background-color 120ms ease-out;
  font-family: 'Inter', sans-serif;
}
.model-option:hover,
.model-option:focus-visible {
  background-color: rgb(var(--color-accent-muted));
  outline: none;
}
.model-option.is-selected {
  background-color: rgb(var(--color-accent-muted));
}
.model-option-label {
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--cluster-icon-color));
}
.model-option.is-selected .model-option-label {
  color: rgb(var(--color-accent));
}
.model-option-caption {
  font-size: 11px;
  color: rgb(var(--color-ink-lighter));
  line-height: 1.3;
}

/* In horizontal mode the popover should pop ABOVE the button, not to its
   left, since the cluster sits horizontally and there's nothing to the
   left of it. */
.writing-tools-cluster.is-horizontal .model-picker-popover {
  right: auto;
  left: 50%;
  top: auto;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
}

/* ============================================================
 * Develop sub-menu — single trigger button + popover with the four
 * fiction/non-fiction × breadth/depth options. Visual language matches
 * the model-picker popover (same paper colour, accent border, anchor
 * positioning) so the cluster's two popovers feel like one system.
 * ============================================================ */
.develop-picker-wrapper {
  position: relative;
}
.develop-picker-popover {
  position: absolute;
  /* Anchor to the LEFT of the trigger by default — the cluster lives
     in the bottom-right corner so we open inward. The horizontal-mode
     override below pops it ABOVE the trigger instead. */
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  /* Wider than the model picker because each option's caption needs a
     comfortable line for the breadth/depth phrasing. Capped so the
     popover never cuts the writing block in half on narrow screens. */
  width: 260px;
  max-width: min(280px, 90vw);
  background-color: rgb(var(--color-paper));
  border: 1px solid rgb(var(--color-accent));
  border-radius: 8px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 50;
  box-shadow: 0 8px 18px rgb(var(--color-ink) / 0.18);
  pointer-events: auto;
}
.develop-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.develop-group-heading {
  /* Same uppercase-tracker treatment used in the rest of the app for
     "section heading" text. Kept tight because each group only has two
     options. */
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-ink-lighter));
  padding: 6px 10px 2px;
  margin: 0;
}
.develop-group-divider {
  height: 1px;
  margin: 4px 6px;
  background-color: rgb(var(--color-line));
  opacity: 0.6;
}
.develop-option {
  appearance: none;
  background: transparent;
  border: none;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background-color 120ms ease-out;
  font-family: 'Inter', sans-serif;
}
.develop-option:hover,
.develop-option:focus-visible {
  background-color: rgb(var(--color-accent-muted));
  outline: none;
}
.develop-option.is-selected {
  background-color: rgb(var(--color-accent-muted));
}
.develop-option-label {
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--cluster-icon-color));
}
.develop-option.is-selected .develop-option-label {
  color: rgb(var(--color-accent));
}
.develop-option-caption {
  font-size: 11px;
  color: rgb(var(--color-ink-lighter));
  line-height: 1.3;
}

/* Horizontal-mode anchor: pop ABOVE the trigger (cluster is laid out
   horizontally and there's no horizontal space for a side popover). */
.writing-tools-cluster.is-horizontal .develop-picker-popover {
  right: auto;
  left: 50%;
  top: auto;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
}

/* ============================================================
 * Rotation handle dots — only shown when unlocked. Drag a dot to spin
 * the cluster around its centre. Sit half-on-half-off the border so
 * they read as proper grip points.
 * ============================================================ */
.rotate-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: rgb(var(--color-accent));
  border: 1.5px solid rgb(var(--color-paper));
  cursor: grab;
  z-index: 2;
  pointer-events: auto;
  transition: transform 120ms ease-out, background-color 120ms ease-out;
  /* Inherit no rotation from the cluster's transform — they ARE inside the
     rotated container, so they rotate with it. That's correct: each dot
     stays attached to "its" border edge. */
}
.rotate-dot:hover,
.rotate-dot:active {
  background-color: rgb(var(--color-accent-hover));
  cursor: grabbing;
}
.rotate-dot-top {
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
}
.rotate-dot-bottom {
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
}
.rotate-dot-top:hover,
.rotate-dot-top:active {
  transform: translateX(-50%) scale(1.25);
}
.rotate-dot-bottom:hover,
.rotate-dot-bottom:active {
  transform: translateX(-50%) scale(1.25);
}

/* In horizontal orientation the cluster's "top" and "bottom" become the
   short edges. Move the dots to those edges so they remain grippable. */
.writing-tools-cluster.is-horizontal .rotate-dot-top {
  top: 50%;
  left: -5px;
  transform: translateY(-50%);
}
.writing-tools-cluster.is-horizontal .rotate-dot-bottom {
  top: 50%;
  left: auto;
  right: -5px;
  bottom: auto;
  transform: translateY(-50%);
}
.writing-tools-cluster.is-horizontal .rotate-dot-top:hover,
.writing-tools-cluster.is-horizontal .rotate-dot-top:active {
  transform: translateY(-50%) scale(1.25);
}
.writing-tools-cluster.is-horizontal .rotate-dot-bottom:hover,
.writing-tools-cluster.is-horizontal .rotate-dot-bottom:active {
  transform: translateY(-50%) scale(1.25);
}

/* ============================================================
 * Horizontal orientation — kicks in when the writer drags the cluster
 * across the writing block. Icons stack across instead of down so the
 * cluster occupies one row of prose, not many.
 * ============================================================ */
.writing-tools-cluster.is-horizontal {
  flex-direction: row;
  /* Pill stays pill — same border-radius works for the stretched shape. */
}
.writing-tools-cluster.is-horizontal .cluster-divider {
  /* Vertical bar instead of horizontal line. */
  width: 1px;
  height: 24px;
  margin: 6px 4px;
}
.writing-tools-cluster.is-horizontal .tool-label {
  /* Tooltip pops above the button instead of to its left. */
  right: auto;
  left: 50%;
  bottom: calc(100% + 8px);
  top: auto;
  transform: translateX(-50%) translateY(0);
}

.tool-button {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  /* --cluster-icon-color is theme-aware and interpolated by the
     brightness slider: dark green in light mode, silver-white in dark. */
  color: rgb(var(--cluster-icon-color));
  cursor: pointer;
  position: relative;
  transition: color 160ms ease-out, background-color 160ms ease-out, transform 160ms ease-out;
}
.tool-button:hover:not(.is-disabled),
.tool-button:focus-visible {
  color: rgb(var(--color-accent));
  background-color: rgb(var(--color-accent-muted));
  outline: none;
}
.tool-button:focus-visible {
  box-shadow: 0 0 0 2px rgb(var(--color-accent));
}
.tool-button:hover:not(.is-disabled) {
  transform: scale(1.06);
}
.tool-button.is-active {
  color: rgb(var(--color-accent));
  background-color: rgb(var(--color-accent-muted));
}
.tool-button.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Primary action (Save) gets a subtle accent ring at rest so the writer
   can find it without scanning labels. Still discreet, still zen. */
.tool-button.is-primary {
  color: rgb(var(--color-accent));
}
.tool-button.is-primary:hover:not(.is-disabled),
.tool-button.is-primary:focus-visible {
  background-color: rgb(var(--color-accent));
  color: rgb(var(--color-paper));
}

/* Label — slides out to the LEFT on hover, only visible when cluster is active.
   Positioned absolutely so the buttons themselves stay perfectly square. */
.tool-label {
  position: absolute;
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  letter-spacing: 0.02em;
  /* Same theme-aware color as the icons so labels read as silver-white
     in dark mode too. */
  color: rgb(var(--cluster-icon-color));
  background-color: rgb(var(--color-paper));
  border: 1px solid rgb(var(--color-accent) / 0.5);
  border-radius: 4px;
  padding: 3px 8px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 140ms ease-out 250ms; /* small delay before tooltip appears */
}
.tool-button:hover:not(.is-disabled) .tool-label,
.tool-button:focus-visible .tool-label {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .writing-tools-cluster,
  .tool-button,
  .tool-label {
    transition: none;
  }
  .tool-button:hover:not(.is-disabled) {
    transform: none;
  }
}

/* On narrow screens (mobile), keep the cluster but pull it inward and shrink it slightly. */
@media (max-width: 640px) {
  .writing-tools-cluster {
    right: 10px;
    bottom: 16px;
  }
  .tool-button {
    width: 32px;
    height: 32px;
  }
}
</style>
