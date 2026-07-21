<template>
  <div
    ref="toolbarRootRef"
    class="writing-toolbar print:hidden"
    role="toolbar"
    aria-label="Writing tools"
  >
    <!-- Save / Publish / Update — the primary action, always first. -->
    <button
      type="button"
      class="tool-button is-primary"
      :class="{ 'is-disabled': saveBusy || saveDisabled }"
      :aria-label="saveBusy ? 'Saving…' : (isEditing ? 'Update' : 'Publish')"
      :title="saveBusy ? 'Saving…' : (isEditing ? 'Update' : 'Publish')"
      :disabled="saveBusy || saveDisabled"
      @click="$emit('save')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 3h9l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M6 3v5h7V3" />
        <path d="M6 12h8" />
        <path d="M6 15h8" />
      </svg>
      <span class="tool-caption">{{ saveBusy ? 'Saving' : (isEditing ? 'Update' : 'Publish') }}</span>
    </button>

    <!-- AI menu — single button consolidating every assist tool, the
         Develop quadrant and the model picker into one sheet. -->
    <div class="menu-anchor">
      <button
        type="button"
        class="tool-button"
        :class="{ 'is-active': aiMenuOpen || activeMode !== null }"
        aria-label="AI writing tools"
        :aria-haspopup="true"
        :aria-expanded="aiMenuOpen"
        title="AI writing tools"
        @click="toggleAiMenu"
      >
        <!-- Sparkle — the conventional "AI" glyph. -->
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 3l1.6 3.9L15.5 8.5l-3.9 1.6L10 14l-1.6-3.9L4.5 8.5l3.9-1.6L10 3z" />
          <path d="M15.5 13l0.8 1.9 1.9 0.8-1.9 0.8-0.8 1.9-0.8-1.9-1.9-0.8 1.9-0.8 0.8-1.9z" />
        </svg>
        <span class="tool-caption">AI</span>
      </button>

      <!-- AI sheet — bottom sheet on mobile, anchored popover on desktop. -->
      <div
        v-if="aiMenuOpen"
        class="menu-sheet ai-sheet"
        role="menu"
        aria-label="AI tools"
        @click.stop
      >
        <div class="sheet-scroll">
          <p class="sheet-heading">Assist</p>
          <button
            v-for="tool in aiTools"
            :key="tool.mode"
            type="button"
            class="sheet-option"
            :class="{ 'is-selected': activeMode === tool.mode, 'is-disabled': tool.requiresSelection && !hasSelection }"
            role="menuitem"
            :disabled="tool.requiresSelection && !hasSelection"
            :aria-label="`${tool.label}${tool.requiresSelection ? ' — needs a text selection' : ''}`"
            @click="selectAiTool(tool.mode)"
          >
            <span class="sheet-option-label">{{ tool.label }}</span>
            <span class="sheet-option-caption">{{ tool.caption }}</span>
          </button>

          <div class="sheet-divider" aria-hidden="true"></div>

          <p class="sheet-heading">Develop — fiction</p>
          <button
            v-for="opt in DEVELOP_OPTIONS_FICTION"
            :key="opt.mode"
            type="button"
            class="sheet-option"
            :class="{ 'is-selected': activeMode === opt.mode }"
            role="menuitem"
            @click="selectAiTool(opt.mode)"
          >
            <span class="sheet-option-label">{{ opt.label }}</span>
            <span class="sheet-option-caption">{{ opt.caption }}</span>
          </button>

          <p class="sheet-heading">Develop — non-fiction</p>
          <button
            v-for="opt in DEVELOP_OPTIONS_NONFICTION"
            :key="opt.mode"
            type="button"
            class="sheet-option"
            :class="{ 'is-selected': activeMode === opt.mode }"
            role="menuitem"
            @click="selectAiTool(opt.mode)"
          >
            <span class="sheet-option-label">{{ opt.label }}</span>
            <span class="sheet-option-caption">{{ opt.caption }}</span>
          </button>

          <div class="sheet-divider" aria-hidden="true"></div>

          <p class="sheet-heading">Model</p>
          <button
            v-for="opt in MODEL_OPTIONS"
            :key="opt.id"
            type="button"
            class="sheet-option"
            :class="{ 'is-selected': opt.id === model }"
            role="menuitemradio"
            :aria-checked="opt.id === model"
            @click="selectModel(opt.id)"
          >
            <span class="sheet-option-label">
              {{ opt.label }}
              <svg v-if="opt.id === model" class="sheet-check" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 10.5l4 4 8-9" />
              </svg>
            </span>
            <span class="sheet-option-caption">{{ opt.caption }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Find & replace -->
    <button
      type="button"
      class="tool-button"
      :class="{ 'is-active': findOpen }"
      aria-label="Find and replace"
      title="Find and replace (in essay or across the manuscript)"
      @click="$emit('find')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5" />
        <path d="M12.5 12.5l4.5 4.5" />
      </svg>
      <span class="tool-caption">Find</span>
    </button>

    <!-- Metadata (cover, themes, visibility) -->
    <button
      type="button"
      class="tool-button"
      :class="{ 'is-active': metadataOpen }"
      aria-label="Metadata (cover, themes, visibility)"
      title="Metadata (cover, themes, visibility)"
      @click="$emit('metadata')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 5h12" />
        <circle cx="7" cy="5" r="1.6" fill="currentColor" stroke="none" />
        <path d="M4 10h12" />
        <circle cx="13" cy="10" r="1.6" fill="currentColor" stroke="none" />
        <path d="M4 15h12" />
        <circle cx="9" cy="15" r="1.6" fill="currentColor" stroke="none" />
      </svg>
      <span class="tool-caption">Details</span>
    </button>

    <!-- Text size — tiny popover with the two steppers so the bar itself
         stays at one button. -->
    <div class="menu-anchor">
      <button
        type="button"
        class="tool-button"
        :class="{ 'is-active': textMenuOpen }"
        aria-label="Text size"
        :aria-haspopup="true"
        :aria-expanded="textMenuOpen"
        title="Text size"
        @click="toggleTextMenu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <text x="10" y="15" text-anchor="middle"
                font-family="Courier Prime, monospace"
                font-size="14" font-weight="700">Aa</text>
        </svg>
        <span class="tool-caption">Text</span>
      </button>

      <div
        v-if="textMenuOpen"
        class="menu-sheet text-sheet"
        role="menu"
        aria-label="Text size"
        @click.stop
      >
        <button
          type="button"
          class="text-step-button"
          aria-label="Decrease body font size"
          title="Smaller text"
          @click="$emit('font-down')"
        >A−</button>
        <button
          type="button"
          class="text-step-button"
          aria-label="Increase body font size"
          title="Larger text"
          @click="$emit('font-up')"
        >A+</button>
      </div>
    </div>

    <!-- Exit -->
    <button
      type="button"
      class="tool-button"
      aria-label="Exit to frags"
      title="Exit to frags"
      @click="$emit('exit')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M11 4h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4" />
        <path d="M3 10h10" />
        <path d="M6 7l-3 3 3 3" />
      </svg>
      <span class="tool-caption">Exit</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
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
  /** Currently-selected OpenAI model id. v-model:model from the parent. */
  model: string
  /** True when the Find & Replace panel is open. Highlights the icon. */
  findOpen?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  /** AI tool clicked. Parent opens the assist panel in this mode. */
  select: [WritingAssistMode]
  /** Save / Publish / Update clicked. */
  save: []
  /** Metadata icon clicked. */
  metadata: []
  /** Exit icon clicked — return to the writer's previous page. */
  exit: []
  /** Find icon clicked — open the Find & Replace panel. */
  find: []
  /** Bump the body font size up by one step. */
  'font-up': []
  /** Bump the body font size down by one step. */
  'font-down': []
  /** Writer picked a different model from the AI menu. v-model:model. */
  'update:model': [string]
}>()

const toolbarRootRef = ref<HTMLElement | null>(null)

/* ============================================================
 * Menus — one open at a time. The AI sheet consolidates the assist
 * tools, the Develop quadrant and the model picker; the text sheet
 * holds the two font-size steppers.
 * ============================================================ */
const aiMenuOpen = ref(false)
const textMenuOpen = ref(false)

function toggleAiMenu() {
  aiMenuOpen.value = !aiMenuOpen.value
  if (aiMenuOpen.value) textMenuOpen.value = false
}

function toggleTextMenu() {
  textMenuOpen.value = !textMenuOpen.value
  if (textMenuOpen.value) aiMenuOpen.value = false
}

function selectAiTool(mode: WritingAssistMode) {
  emit('select', mode)
  aiMenuOpen.value = false
}

function selectModel(id: string) {
  emit('update:model', id)
  // Keep the sheet open — picking a model is usually a prelude to picking
  // a tool, and the checkmark gives immediate feedback.
}

// Close menus when the writer taps/clicks anywhere outside the toolbar,
// or presses Escape. The sheets stop click propagation internally.
function onWindowPointerDown(e: PointerEvent) {
  if (!aiMenuOpen.value && !textMenuOpen.value) return
  const root = toolbarRootRef.value
  if (!root) return
  if (root.contains(e.target as Node)) return
  aiMenuOpen.value = false
  textMenuOpen.value = false
}

function onWindowKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (!aiMenuOpen.value && !textMenuOpen.value) return
  aiMenuOpen.value = false
  textMenuOpen.value = false
}

onMounted(() => {
  window.addEventListener('pointerdown', onWindowPointerDown)
  window.addEventListener('keydown', onWindowKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown)
  window.removeEventListener('keydown', onWindowKeyDown)
})

interface AiTool {
  mode: WritingAssistMode
  label: string
  caption: string
  /** True for tools that strictly need a selection (focus). Others fall back to whole-essay mode. */
  requiresSelection: boolean
}

const aiTools: AiTool[] = [
  {
    mode: 'coherence',
    label: 'Ask',
    caption: 'Ask a coherence question (character, arc, motif)',
    requiresSelection: false,
  },
  {
    mode: 'define',
    label: 'Define',
    caption: 'Define a word or phrase',
    requiresSelection: false,
  },
  {
    mode: 'focus',
    label: 'Focus',
    caption: 'Tighten the selection without losing voice',
    requiresSelection: true,
  },
  {
    mode: 'expand',
    label: 'Expand',
    caption: 'Add substance — never padding',
    requiresSelection: false,
  },
  {
    mode: 'proofread',
    label: 'Proofread',
    caption: 'Light spelling/grammar — preserves voice',
    requiresSelection: false,
  },
  {
    mode: 'factcheck',
    label: 'Fact-check',
    caption: 'Check factual claims (selection or whole frag)',
    requiresSelection: false,
  },
]

/* ============================================================
 * Develop — four sister modes split across two registers
 * (fiction / non-fiction) and two axes (breadth / depth).
 *
 * Each option's `caption` is the one-line phrasing the writer reads
 * inside the sheet — kept short on purpose; the full prompt-side
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

/* ============================================================
 * Model selector — top 4 OpenAI models per platform.openai.com (2026
 * lineup). Keep this list in sync with ALLOWED_MODELS in
 * server/src/controllers/writing.controller.ts; if the two drift, the
 * server will silently ignore the client's choice and fall back to env.
 * ============================================================ */

interface ModelOption {
  id: string
  label: string
  caption: string
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gpt-5.5',      label: 'GPT-5.5',      caption: 'Flagship — best quality, slowest' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', caption: 'Balanced speed and quality' },
  { id: 'gpt-4.1',      label: 'GPT-4.1',      caption: 'Strong text + code, cheaper' },
  { id: 'gpt-4o-mini',  label: 'GPT-4o mini',  caption: 'Fast and inexpensive (default)' },
]
</script>

<style scoped>
/* ============================================================
 * Bottom toolbar — mobile-first. Full-width bar pinned to the bottom
 * edge (safe-area aware) on small screens; a centered floating pill
 * on larger ones. Buttons are 44px+ touch targets with a tiny caption
 * under each icon so nothing needs a hover to be understood.
 * ============================================================ */
.writing-toolbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  gap: 2px;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
  background-color: rgb(var(--color-paper) / 0.92);
  border-top: 1px solid rgb(var(--color-line));
  backdrop-filter: blur(8px);
}

/* Desktop: float as a centered pill instead of a full-width bar. */
@media (min-width: 768px) {
  .writing-toolbar {
    left: 50%;
    right: auto;
    bottom: 20px;
    transform: translateX(-50%);
    justify-content: center;
    gap: 4px;
    padding: 6px 10px;
    border: 1px solid rgb(var(--color-accent) / 0.4);
    border-radius: 999px;
    box-shadow: 0 6px 20px rgb(var(--color-ink) / 0.14);
  }
}

.tool-button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 52px;
  min-height: 48px;
  padding: 4px 8px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: rgb(var(--cluster-icon-color));
  cursor: pointer;
  transition: color 160ms ease-out, background-color 160ms ease-out;
  -webkit-tap-highlight-color: transparent;
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
.tool-button.is-active {
  color: rgb(var(--color-accent));
  background-color: rgb(var(--color-accent-muted));
}
.tool-button.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Primary action (Save) reads accented at rest so the writer can find it
   without scanning captions. */
.tool-button.is-primary {
  color: rgb(var(--color-accent));
}
.tool-button.is-primary:hover:not(.is-disabled),
.tool-button.is-primary:focus-visible {
  background-color: rgb(var(--color-accent));
  color: rgb(var(--color-paper));
}

/* Caption under each icon — always visible, so the toolbar needs no
   hover-tooltips (which don't exist on touch anyway). */
.tool-caption {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1;
}

/* ============================================================
 * Sheets/popovers — anchored to their trigger. On mobile the AI sheet
 * spans the viewport width just above the bar; on desktop it becomes a
 * compact popover above the trigger.
 * ============================================================ */
.menu-anchor {
  position: relative;
  display: flex;
}

.menu-sheet {
  position: fixed;
  left: 8px;
  right: 8px;
  bottom: calc(66px + env(safe-area-inset-bottom, 0px));
  background-color: rgb(var(--color-paper));
  border: 1px solid rgb(var(--color-accent) / 0.5);
  border-radius: 14px;
  box-shadow: 0 10px 30px rgb(var(--color-ink) / 0.2);
  z-index: 50;
  overflow: hidden;
}

@media (min-width: 768px) {
  .menu-sheet {
    position: absolute;
    left: 50%;
    right: auto;
    bottom: calc(100% + 12px);
    transform: translateX(-50%);
    width: 300px;
  }
}

.sheet-scroll {
  max-height: min(55vh, 480px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sheet-heading {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-ink-lighter));
  padding: 8px 10px 2px;
  margin: 0;
}

.sheet-divider {
  height: 1px;
  margin: 6px 8px;
  background-color: rgb(var(--color-line));
  opacity: 0.7;
}

.sheet-option {
  appearance: none;
  background: transparent;
  border: none;
  text-align: left;
  padding: 10px 10px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background-color 120ms ease-out;
  font-family: 'Inter', sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.sheet-option:hover:not(:disabled),
.sheet-option:focus-visible {
  background-color: rgb(var(--color-accent-muted));
  outline: none;
}
.sheet-option.is-selected {
  background-color: rgb(var(--color-accent-muted));
}
.sheet-option.is-disabled,
.sheet-option:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.sheet-option-label {
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--cluster-icon-color));
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sheet-option.is-selected .sheet-option-label {
  color: rgb(var(--color-accent));
}
.sheet-option-caption {
  font-size: 11px;
  color: rgb(var(--color-ink-lighter));
  line-height: 1.3;
}
.sheet-check {
  color: rgb(var(--color-accent));
  flex-shrink: 0;
}

/* Text-size sheet — just the two steppers, side by side. */
.text-sheet {
  display: flex;
  flex-direction: row;
  gap: 4px;
  padding: 6px;
  left: auto;
  right: 8px;
  width: auto;
}
@media (min-width: 768px) {
  .text-sheet {
    right: auto;
    width: auto;
  }
}
.text-step-button {
  appearance: none;
  border: 1px solid rgb(var(--color-line));
  background: transparent;
  color: rgb(var(--cluster-icon-color));
  border-radius: 10px;
  min-width: 56px;
  min-height: 44px;
  font-family: 'Courier Prime', monospace;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 120ms ease-out, color 120ms ease-out;
  -webkit-tap-highlight-color: transparent;
}
.text-step-button:hover,
.text-step-button:focus-visible {
  background-color: rgb(var(--color-accent-muted));
  color: rgb(var(--color-accent));
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .tool-button,
  .sheet-option,
  .text-step-button {
    transition: none;
  }
}
</style>
