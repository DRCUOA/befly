<template>
  <div
    class="writing-tools-cluster"
    role="toolbar"
    aria-label="Writing tools"
    aria-orientation="vertical"
    :class="{ 'is-active': hasActiveMode || isHovering }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
    @focusin="isHovering = true"
    @focusout="isHovering = false"
  >
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

    <!-- Visual separator between page actions and AI tools -->
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

      <!-- Label visible on hover/focus only — keeps the rest button-only -->
      <span class="tool-label">{{ tool.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
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
}

const props = defineProps<Props>()

defineEmits<{
  /** AI tool clicked. Parent opens the assist panel in this mode. */
  select: [WritingAssistMode]
  /** Save / Publish / Update clicked. */
  save: []
  /** Metadata icon clicked. */
  metadata: []
  /** Exit icon clicked — return to the writer's previous page. */
  exit: []
}>()

const isHovering = ref(false)
const hasActiveMode = computed(() => props.activeMode !== null || props.metadataOpen)

interface AiTool {
  mode: WritingAssistMode
  label: string
  tooltip: string
  /** True for tools that strictly need a selection (focus). Others fall back to whole-essay mode. */
  requiresSelection: boolean
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
]
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
  border: 1px solid rgb(var(--color-line) / 0.5);
  backdrop-filter: blur(6px);
  opacity: 0.32;
  transition: opacity 220ms ease-out, background-color 220ms ease-out, border-color 220ms ease-out;
}

.writing-tools-cluster.is-active,
.writing-tools-cluster:focus-within {
  opacity: 1;
  background-color: rgb(var(--color-paper));
  border-color: rgb(var(--color-line));
}

.cluster-divider {
  height: 1px;
  margin: 4px 6px;
  background-color: rgb(var(--color-line));
  opacity: 0.7;
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
  color: rgb(var(--color-ink-light));
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
  color: rgb(var(--color-ink-light));
  background-color: rgb(var(--color-paper));
  border: 1px solid rgb(var(--color-line));
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
