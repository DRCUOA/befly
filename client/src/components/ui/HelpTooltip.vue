<template>
  <span class="help-tooltip-wrap">
    <button
      type="button"
      class="help-tooltip-trigger"
      :aria-describedby="popoverId"
      :aria-label="ariaLabel"
      @click.prevent="onTriggerClick"
      @focus="show = true"
      @blur="show = false"
      @mouseenter="show = true"
      @mouseleave="show = false"
    >
      <svg viewBox="0 0 16 16" class="w-3.5 h-3.5" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2" />
        <text x="8" y="11.5" text-anchor="middle" font-size="9" font-family="serif" font-style="italic" fill="currentColor">?</text>
      </svg>
    </button>
    <span
      v-if="show"
      :id="popoverId"
      role="tooltip"
      class="help-tooltip-popover"
      :class="placement === 'left' ? 'help-tooltip-left' : 'help-tooltip-right'"
    >
      <slot />
      <router-link
        v-if="link"
        :to="link"
        class="help-tooltip-link"
        @click="show = false"
      >
        Learn more &rarr;
      </router-link>
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * Reusable help tooltip. A small "?" icon that reveals a styled popover on
 * hover or focus. Accessible: aria-describedby ties the popover to the
 * trigger, and the trigger is a focusable <button> so keyboard users can
 * reach it.
 *
 * Slot content is the tooltip body. Optional `link` renders a "Learn more"
 * footer that deep-links into the help pages (e.g. "/help/manuscripts#central-question").
 *
 * Usage:
 *   <label>
 *     Central question
 *     <HelpTooltip link="/help/manuscripts#central-question" aria-label="About central question">
 *       The recurring question your work keeps circling. The AI uses this
 *       to weigh which gaps matter.
 *     </HelpTooltip>
 *   </label>
 *
 * Mobile note: hover doesn't fire on touch devices, but the trigger is a
 * <button> so a tap toggles `show` via @click. We don't try to do anything
 * fancier than that - the help pages are the canonical reference.
 */
import { computed, ref } from 'vue'

// Props are reachable from the template directly (Vue <script setup> exposes
// prop names automatically); we don't need a `const props =` binding here.
withDefaults(defineProps<{
  link?: string
  ariaLabel?: string
  placement?: 'right' | 'left'
}>(), {
  ariaLabel: 'More information',
  placement: 'right',
})

const show = ref(false)
// Stable id so aria-describedby actually points at something.
const popoverId = computed(() => `help-tooltip-${idCounter++}`)
let idCounter = 0

function onTriggerClick() {
  // Tapping toggles on touch devices; on desktop hover already opened it.
  show.value = !show.value
}
</script>

<style scoped>
.help-tooltip-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 0.25rem;
}

.help-tooltip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  color: var(--ink-lighter, #999);
  background: transparent;
  border: 0;
  padding: 0;
  cursor: help;
  transition: color 0.15s ease;
}
.help-tooltip-trigger:hover,
.help-tooltip-trigger:focus-visible {
  color: var(--ink, #222);
  outline: none;
}

.help-tooltip-popover {
  position: absolute;
  bottom: calc(100% + 6px);
  z-index: 60;
  width: max-content;
  max-width: 18rem;
  padding: 0.625rem 0.75rem;
  background: var(--paper, #fff);
  color: var(--ink, #222);
  border: 1px solid var(--line, #e5e5e5);
  border-radius: 0.25rem;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  font-size: 0.8125rem;
  line-height: 1.4;
  font-weight: 300;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
  pointer-events: auto;
}
.help-tooltip-right { left: 0; }
.help-tooltip-left  { right: 0; }

.help-tooltip-link {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--ink-light, #555);
  text-decoration: underline;
}
.help-tooltip-link:hover {
  color: var(--ink, #222);
}
</style>
