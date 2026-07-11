<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="rootEl"
      class="ir-root"
      :class="[`ir-theme-${prefs.theme}`, `ir-font-${prefs.font}`]"
      role="dialog"
      aria-modal="true"
      :aria-label="`Immersive reader: ${title}`"
    >
      <!-- Reading progress -->
      <div class="ir-progress" aria-hidden="true">
        <div class="ir-progress-fill" :style="{ width: `${progress * 100}%` }" />
      </div>

      <!-- Chrome (auto-hides while reading) -->
      <header class="ir-chrome" :class="{ 'ir-chrome-hidden': !chromeVisible }">
        <div class="ir-chrome-inner">
          <button type="button" class="ir-icon-btn" aria-label="Close immersive reader" title="Close (Esc)" @click="$emit('close')">
            <svg class="ir-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="ir-chrome-title">
            <span class="ir-chrome-title-text">{{ title }}</span>
            <span v-if="minutes > 0" class="ir-chrome-meta">{{ minutes }} min · {{ Math.round(progress * 100) }}%</span>
          </div>

          <div class="ir-chrome-actions">
            <button
              v-if="tocEntries.length > 1"
              type="button"
              class="ir-icon-btn"
              :class="{ 'ir-icon-btn-active': tocOpen }"
              aria-label="Contents"
              title="Contents"
              @click="tocOpen = !tocOpen; settingsOpen = false"
            >
              <svg class="ir-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              class="ir-icon-btn"
              :class="{ 'ir-icon-btn-active': settingsOpen }"
              aria-label="Reading settings"
              title="Reading settings"
              @click="settingsOpen = !settingsOpen; tocOpen = false"
            >
              <span class="ir-aa" aria-hidden="true">Aa</span>
            </button>
            <button
              type="button"
              class="ir-icon-btn"
              :aria-label="isFullscreen ? 'Exit full screen' : 'Full screen'"
              :title="isFullscreen ? 'Exit full screen' : 'Full screen'"
              @click="toggleFullscreen"
            >
              <svg v-if="!isFullscreen" class="ir-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3.75 9V4.5h4.5m7.5 0h4.5V9m0 6v4.5h-4.5m-7.5 0h-4.5V15" />
              </svg>
              <svg v-else class="ir-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M9 3.75V9H3.75M15 3.75V9h5.25M9 20.25V15H3.75M15 20.25V15h5.25" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Settings popover -->
        <div v-if="settingsOpen" class="ir-panel" @click.stop>
          <div class="ir-panel-row">
            <span class="ir-panel-label">Text size</span>
            <div class="ir-panel-controls">
              <button type="button" class="ir-chip" :disabled="prefs.sizeIndex <= 0" aria-label="Smaller text" @click="bumpSize(-1)">A−</button>
              <span class="ir-size-dots" aria-hidden="true">
                <span v-for="(s, i) in FONT_SIZES" :key="s" class="ir-size-dot" :class="{ 'ir-size-dot-on': i === prefs.sizeIndex }" />
              </span>
              <button type="button" class="ir-chip" :disabled="prefs.sizeIndex >= FONT_SIZES.length - 1" aria-label="Larger text" @click="bumpSize(1)">A+</button>
            </div>
          </div>
          <div class="ir-panel-row">
            <span class="ir-panel-label">Typeface</span>
            <div class="ir-panel-controls">
              <button type="button" class="ir-chip" :class="{ 'ir-chip-on': prefs.font === 'serif' }" @click="setPref('font', 'serif')">Serif</button>
              <button type="button" class="ir-chip" :class="{ 'ir-chip-on': prefs.font === 'sans' }" @click="setPref('font', 'sans')">Sans</button>
            </div>
          </div>
          <div class="ir-panel-row">
            <span class="ir-panel-label">Line width</span>
            <div class="ir-panel-controls">
              <button type="button" class="ir-chip" :class="{ 'ir-chip-on': prefs.measure === 'narrow' }" @click="setPref('measure', 'narrow')">Narrow</button>
              <button type="button" class="ir-chip" :class="{ 'ir-chip-on': prefs.measure === 'wide' }" @click="setPref('measure', 'wide')">Wide</button>
            </div>
          </div>
          <div class="ir-panel-row">
            <span class="ir-panel-label">Background</span>
            <div class="ir-panel-controls">
              <button
                v-for="t in THEMES"
                :key="t.key"
                type="button"
                class="ir-swatch"
                :class="{ 'ir-swatch-on': prefs.theme === t.key }"
                :style="{ background: t.bg, color: t.fg }"
                :aria-label="`${t.label} background`"
                :title="t.label"
                @click="setPref('theme', t.key)"
              >Aa</button>
            </div>
          </div>
        </div>

        <!-- Table of contents -->
        <nav v-if="tocOpen" class="ir-panel ir-toc" aria-label="Contents" @click.stop>
          <button
            v-for="entry in tocEntries"
            :key="entry.id"
            type="button"
            class="ir-toc-item"
            :class="{ 'ir-toc-section': entry.kind === 'section' }"
            @click="jumpTo(entry.id)"
          >
            {{ entry.title }}
          </button>
        </nav>
      </header>

      <!-- Content -->
      <div ref="scrollEl" class="ir-scroll" @scroll.passive="onScroll" @click="onContentClick">
        <div v-if="loading" class="ir-loading">
          <p>Preparing your reading&hellip;</p>
        </div>
        <article v-else class="ir-article" :class="{ 'ir-measure-wide': prefs.measure === 'wide' }" :style="{ fontSize: `${FONT_SIZES[prefs.sizeIndex]}px` }">
          <h1 class="ir-doc-title">{{ title }}</h1>
          <p v-if="subtitle" class="ir-doc-subtitle">{{ subtitle }}</p>

          <template v-for="chapter in chapters" :key="chapter.id">
            <section v-if="chapter.kind === 'section'" :id="anchorId(chapter.id)" class="ir-section-break">
              <span class="ir-section-rule" aria-hidden="true" />
              <h2>{{ chapter.title }}</h2>
            </section>

            <aside v-else-if="chapter.kind === 'bridge'" :id="anchorId(chapter.id)" class="ir-bridge">
              <MarkdownRenderer :markdown="chapter.markdown" />
            </aside>

            <section v-else :id="anchorId(chapter.id)" class="ir-chapter">
              <h2 v-if="showChapterTitles" class="ir-chapter-title">{{ chapter.title }}</h2>
              <MarkdownRenderer :markdown="chapter.markdown" />
            </section>
          </template>

          <footer class="ir-end">
            <span class="ir-section-rule" aria-hidden="true" />
            <p>The end</p>
          </footer>
        </article>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import MarkdownRenderer from '../writing/MarkdownRenderer.vue'
import { countWordsInMarkdown } from '../../utils/markdown'
import type { ReaderChapter } from '../../utils/immersiveChapters'

interface Props {
  open: boolean
  title: string
  subtitle?: string
  chapters: ReaderChapter[]
  loading?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

/* ---- typography preferences (persisted) ---- */

const FONT_SIZES = [17, 19, 21, 24] as const

const THEMES = [
  { key: 'paper', label: 'Paper', bg: '#faf8f2', fg: '#2b2620' },
  { key: 'sepia', label: 'Sepia', bg: '#f3e9d2', fg: '#54432e' },
  { key: 'night', label: 'Night', bg: '#15161a', fg: '#cfc9bc' },
] as const

type ThemeKey = (typeof THEMES)[number]['key']

interface ReaderPrefs {
  sizeIndex: number
  font: 'serif' | 'sans'
  measure: 'narrow' | 'wide'
  theme: ThemeKey
}

const PREFS_KEY = 'immersive-reader-prefs'

function loadPrefs(): ReaderPrefs {
  const defaults: ReaderPrefs = { sizeIndex: 1, font: 'serif', measure: 'narrow', theme: 'paper' }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>
    return {
      sizeIndex: typeof parsed.sizeIndex === 'number'
        ? Math.min(Math.max(Math.round(parsed.sizeIndex), 0), FONT_SIZES.length - 1)
        : defaults.sizeIndex,
      font: parsed.font === 'sans' ? 'sans' : 'serif',
      measure: parsed.measure === 'wide' ? 'wide' : 'narrow',
      theme: THEMES.some(t => t.key === parsed.theme) ? (parsed.theme as ThemeKey) : defaults.theme,
    }
  } catch {
    return defaults
  }
}

const prefs = ref<ReaderPrefs>(loadPrefs())

function persistPrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs.value))
  } catch {
    /* private mode etc. — reading still works, prefs just won't stick */
  }
}

function setPref<K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]) {
  prefs.value = { ...prefs.value, [key]: value }
  persistPrefs()
}

function bumpSize(delta: number) {
  setPref('sizeIndex', Math.min(Math.max(prefs.value.sizeIndex + delta, 0), FONT_SIZES.length - 1))
}

/* ---- chrome visibility, progress, panels ---- */

const rootEl = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const chromeVisible = ref(true)
const settingsOpen = ref(false)
const tocOpen = ref(false)
const progress = ref(0)
let lastScrollTop = 0

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  progress.value = max > 0 ? Math.min(el.scrollTop / max, 1) : 0

  // Hide the chrome when reading down, reveal on any upward scroll.
  // Keep it while a panel is open or near the very top.
  if (settingsOpen.value || tocOpen.value) return
  const delta = el.scrollTop - lastScrollTop
  if (el.scrollTop < 80 || delta < -4) chromeVisible.value = true
  else if (delta > 4) chromeVisible.value = false
  lastScrollTop = el.scrollTop
}

// Tap/click on the prose toggles the chrome back (mobile-friendly),
// but never when the user is selecting text or clicking a link.
function onContentClick(e: MouseEvent) {
  if (settingsOpen.value || tocOpen.value) {
    settingsOpen.value = false
    tocOpen.value = false
    return
  }
  const sel = window.getSelection()
  if (sel && !sel.isCollapsed) return
  if ((e.target as HTMLElement).closest('a')) return
  chromeVisible.value = !chromeVisible.value
}

/* ---- contents ---- */

const tocEntries = computed(() => props.chapters.filter(c => c.kind !== 'bridge'))

// A lone chapter would just repeat the document title above it.
const showChapterTitles = computed(() => props.chapters.filter(c => c.kind === 'chapter').length > 1)

const anchorId = (id: string) => `ir-anchor-${id}`

// Instant jump (not smooth): a chapter can be thousands of pixels away, and
// smooth scrolling stalls entirely in rAF-throttled (backgrounded) tabs.
function jumpTo(id: string) {
  tocOpen.value = false
  document.getElementById(anchorId(id))?.scrollIntoView({ behavior: 'auto', block: 'start' })
}

const minutes = computed(() => {
  const words = props.chapters.reduce((sum, c) => sum + countWordsInMarkdown(c.markdown), 0)
  return words > 0 ? Math.max(1, Math.round(words / 280)) : 0
})

/* ---- fullscreen ---- */

const isFullscreen = ref(false)

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  } else {
    rootEl.value?.requestFullscreen?.().catch(() => {})
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

/* ---- open/close lifecycle ---- */

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (settingsOpen.value || tocOpen.value) {
    settingsOpen.value = false
    tocOpen.value = false
  } else if (!document.fullscreenElement) {
    // In fullscreen the browser maps Esc to exiting fullscreen; a second
    // Esc (now windowed) closes the reader.
    emit('close')
  }
}

let savedBodyOverflow = ''

watch(
  () => props.open,
  (open) => {
    if (open) {
      savedBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', onKeydown)
      document.addEventListener('fullscreenchange', onFullscreenChange)
      chromeVisible.value = true
      settingsOpen.value = false
      tocOpen.value = false
      progress.value = 0
      lastScrollTop = 0
    } else {
      document.body.style.overflow = savedBodyOverflow
      document.removeEventListener('keydown', onKeydown)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  },
)

onUnmounted(() => {
  if (props.open) {
    document.body.style.overflow = savedBodyOverflow
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  }
})
</script>

<style scoped>
.ir-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: var(--ir-bg);
  color: var(--ir-fg);
}

/* Reading themes — self-contained, deliberately independent of the app
   light/dark mode so "Night" reading works from a light app and vice versa. */
.ir-theme-paper { --ir-bg: #faf8f2; --ir-fg: #2b2620; --ir-muted: #8a8272; --ir-line: rgba(43, 38, 32, 0.14); --ir-chrome: rgba(250, 248, 242, 0.94); }
.ir-theme-sepia { --ir-bg: #f3e9d2; --ir-fg: #54432e; --ir-muted: #9c8a6c; --ir-line: rgba(84, 67, 46, 0.16); --ir-chrome: rgba(243, 233, 210, 0.94); }
.ir-theme-night { --ir-bg: #15161a; --ir-fg: #cfc9bc; --ir-muted: #7d786d; --ir-line: rgba(207, 201, 188, 0.14); --ir-chrome: rgba(21, 22, 26, 0.94); }

.ir-font-serif .ir-article { font-family: 'Crimson Pro', Georgia, serif; }
.ir-font-sans .ir-article { font-family: 'Inter', system-ui, sans-serif; }

/* ---- progress ---- */
.ir-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 30;
  background: transparent;
}
.ir-progress-fill {
  height: 100%;
  background: var(--ir-muted);
  transition: width 120ms linear;
}

/* ---- chrome ---- */
.ir-chrome {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: var(--ir-chrome);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--ir-line);
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms;
}
.ir-chrome-hidden {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}
.ir-chrome-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 56rem;
  margin: 0 auto;
  padding: 10px 16px;
}
.ir-chrome-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ir-chrome-title-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ir-chrome-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  color: var(--ir-muted);
}
.ir-chrome-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ir-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  color: var(--ir-muted);
  transition: color 200ms, background 200ms;
}
.ir-icon-btn:hover, .ir-icon-btn-active {
  color: var(--ir-fg);
  background: var(--ir-line);
}
.ir-icon { width: 20px; height: 20px; }
.ir-aa {
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: 17px;
  line-height: 1;
}

/* ---- popovers ---- */
.ir-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 16px;
  width: min(320px, calc(100vw - 32px));
  background: var(--ir-bg);
  border: 1px solid var(--ir-line);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ir-panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ir-panel-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ir-muted);
}
.ir-panel-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ir-chip {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  padding: 5px 10px;
  border: 1px solid var(--ir-line);
  border-radius: 999px;
  color: var(--ir-muted);
  transition: color 200ms, border-color 200ms;
}
.ir-chip:hover:not(:disabled) { color: var(--ir-fg); }
.ir-chip:disabled { opacity: 0.4; }
.ir-chip-on {
  color: var(--ir-fg);
  border-color: var(--ir-fg);
}
.ir-size-dots { display: inline-flex; gap: 4px; margin: 0 2px; }
.ir-size-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--ir-line);
}
.ir-size-dot-on { background: var(--ir-fg); }
.ir-swatch {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid var(--ir-line);
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ir-swatch-on { box-shadow: 0 0 0 2px var(--ir-bg), 0 0 0 4px var(--ir-fg); }

.ir-toc {
  max-height: min(60vh, 480px);
  overflow-y: auto;
  gap: 0;
  padding: 8px;
}
.ir-toc-item {
  display: block;
  width: 100%;
  text-align: left;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  color: var(--ir-fg);
}
.ir-toc-item:hover { background: var(--ir-line); }
.ir-toc-section {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 11px;
  color: var(--ir-muted);
  margin-top: 6px;
}
.ir-toc-section:first-child { margin-top: 0; }

/* ---- content ---- */
.ir-scroll {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.ir-loading {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Crimson Pro', Georgia, serif;
  font-style: italic;
  color: var(--ir-muted);
}
.ir-article {
  max-width: 42rem;
  margin: 0 auto;
  padding: 96px 24px 64px;
  line-height: 1.85;
  cursor: default;
}
.ir-measure-wide { max-width: 56rem; }

.ir-doc-title {
  font-size: 2em;
  font-weight: 300;
  letter-spacing: -0.01em;
  line-height: 1.2;
  margin-bottom: 0.4em;
}
.ir-doc-subtitle {
  font-style: italic;
  color: var(--ir-muted);
  margin-bottom: 2em;
}
.ir-doc-title + .ir-chapter, .ir-doc-title + .ir-section-break { margin-top: 2.5em; }

.ir-section-break {
  text-align: center;
  margin: 4em 0 3em;
}
.ir-section-break h2 {
  font-size: 1.05em;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--ir-muted);
}
.ir-section-rule {
  display: block;
  width: 48px;
  height: 1px;
  background: var(--ir-line);
  margin: 0 auto 1.4em;
}

.ir-chapter { margin: 2.5em 0; }
.ir-chapter-title {
  font-size: 1.4em;
  font-weight: 300;
  line-height: 1.3;
  margin-bottom: 1em;
}

.ir-bridge {
  margin: 3em auto;
  max-width: 34rem;
  text-align: center;
  font-style: italic;
  color: var(--ir-muted);
}

.ir-end {
  text-align: center;
  margin-top: 5em;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--ir-muted);
}

/* Rendered markdown inside chapters/bridges — MarkdownRenderer emits raw
   elements (there is no typography plugin), so the reader styles them here. */
.ir-article :deep(p) { margin: 0 0 1.25em; }
.ir-article :deep(p:last-child) { margin-bottom: 0; }
.ir-article :deep(h1), .ir-article :deep(h2), .ir-article :deep(h3), .ir-article :deep(h4) {
  font-weight: 400;
  line-height: 1.3;
  margin: 1.8em 0 0.7em;
}
.ir-article :deep(h1) { font-size: 1.5em; }
.ir-article :deep(h2) { font-size: 1.3em; }
.ir-article :deep(h3) { font-size: 1.15em; }
.ir-article :deep(blockquote) {
  border-left: 2px solid var(--ir-line);
  padding-left: 1.2em;
  margin: 1.5em 0;
  font-style: italic;
  color: var(--ir-muted);
}
.ir-article :deep(ul), .ir-article :deep(ol) { margin: 0 0 1.25em 1.4em; }
.ir-article :deep(ul) { list-style: disc; }
.ir-article :deep(ol) { list-style: decimal; }
.ir-article :deep(li) { margin-bottom: 0.4em; }
.ir-article :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--ir-muted);
  text-underline-offset: 3px;
}
.ir-article :deep(hr) {
  border: 0;
  height: 1px;
  background: var(--ir-line);
  margin: 2.5em auto;
  width: 48px;
}
.ir-article :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 1.5em auto;
}
.ir-article :deep(code) {
  font-family: 'Courier Prime', ui-monospace, monospace;
  font-size: 0.85em;
  background: var(--ir-line);
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
.ir-article :deep(pre) {
  background: var(--ir-line);
  padding: 1em 1.2em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1.5em 0;
}
.ir-article :deep(pre code) { background: none; padding: 0; }

@media (max-width: 640px) {
  .ir-article { padding: 84px 20px 48px; }
}
</style>
