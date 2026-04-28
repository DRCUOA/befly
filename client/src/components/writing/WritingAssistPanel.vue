<template>
  <Transition name="assist-panel">
    <aside
      v-if="open"
      class="writing-assist-panel"
      role="dialog"
      :aria-label="`Writing assist — ${MODE_LABELS[mode]}`"
      tabindex="-1"
      @keydown.esc.stop="$emit('close')"
    >
      <!-- Header -->
      <header class="flex items-center justify-between px-5 py-4 border-b border-line">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-wider text-ink-lighter font-sans">
            Writing assist
          </p>
          <h2 class="text-lg font-light text-ink truncate">
            {{ MODE_LABELS[mode] }}
          </h2>
        </div>
        <button
          type="button"
          class="ml-3 p-1.5 rounded-md text-ink-lighter hover:text-ink hover:bg-accent-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Close writing assist panel"
          @click="$emit('close')"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 5L15 15M5 15L15 5" />
          </svg>
        </button>
      </header>

      <!-- Body — scrolls if long -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <!-- "Save first" banner — shown only on brand-new drafts.
             AI assist needs a server-side writingId; we surface that as
             clear guidance up front rather than letting the request
             fail with a generic error after the writer hits Ask. -->
        <div
          v-if="!writingSaved"
          class="border border-line rounded-md p-3 text-sm bg-accent-muted text-ink-light"
        >
          <p class="font-medium text-ink mb-1">Save your draft first</p>
          <p>
            AI assist works on a saved essay so it can include the right context.
            Hit <span class="font-medium">Publish</span> (you can leave visibility on
            <span class="font-medium">Private</span> in the Metadata panel) to enable these tools.
          </p>
        </div>

        <!-- Per-mode input UI — only when the essay has been saved. -->
        <template v-if="writingSaved">
        <section v-if="mode === 'coherence'">
          <label for="assist-coherence-question" class="block text-xs uppercase tracking-wider text-ink-lighter font-sans mb-2">
            Your question
          </label>
          <textarea
            id="assist-coherence-question"
            ref="questionInputRef"
            v-model="coherenceQuestion"
            rows="4"
            class="w-full px-3 py-2 border border-line bg-paper text-ink rounded-md resize-none text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:opacity-50"
            :disabled="isLoading"
            placeholder="e.g. How would John's character react to the events in this chapter? Suggest 2–3 alternatives that respect his arc so far."
            @keydown.meta.enter.exact="submitCoherence"
            @keydown.ctrl.enter.exact="submitCoherence"
          ></textarea>
          <div class="flex items-center justify-between mt-2">
            <p v-if="hasSelection" class="text-xs text-ink-lighter">
              Anchored to your selection ({{ selectionPreview }})
            </p>
            <span v-else class="text-xs text-ink-whisper">
              Cmd/Ctrl + Enter to submit
            </span>
            <button
              type="button"
              class="ml-3 px-3 py-1.5 text-sm border border-line rounded-md text-ink hover:bg-accent-muted disabled:opacity-50"
              :disabled="!coherenceQuestion.trim() || isLoading"
              @click="submitCoherence"
            >
              {{ isLoading ? 'Thinking…' : 'Ask' }}
            </button>
          </div>
        </section>

        <section v-else-if="mode === 'define'">
          <label for="assist-define-term" class="block text-xs uppercase tracking-wider text-ink-lighter font-sans mb-2">
            Word or phrase
          </label>
          <input
            id="assist-define-term"
            ref="termInputRef"
            v-model="defineTerm"
            type="text"
            class="w-full px-3 py-2 border border-line bg-paper text-ink rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:opacity-50"
            :disabled="isLoading"
            placeholder="e.g. ekphrasis"
            @keydown.enter.exact="submitDefine"
          />
          <div class="flex items-center justify-end mt-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm border border-line rounded-md text-ink hover:bg-accent-muted disabled:opacity-50"
              :disabled="!defineTerm.trim() || isLoading"
              @click="submitDefine"
            >
              {{ isLoading ? 'Looking up…' : 'Define' }}
            </button>
          </div>
        </section>

        <!-- Auto-running modes show a status line + selection summary -->
        <section v-else>
          <p class="text-xs uppercase tracking-wider text-ink-lighter font-sans mb-2">
            {{ AUTO_LABELS[mode] }}
          </p>
          <p v-if="hasSelection" class="text-sm text-ink-light">
            Working on your selection ({{ selectionPreview }}).
          </p>
          <p v-else-if="mode === 'focus'" class="text-sm text-ink-light">
            Select some text in the editor first — focus needs a passage to tighten.
          </p>
          <p v-else class="text-sm text-ink-light">
            Working on the whole essay.
          </p>
        </section>

        <!-- Loading shimmer (for transformative modes that auto-run) -->
        <p v-if="isLoading" class="text-sm text-ink-lighter italic">
          {{ LOADING_LINES[mode] }}
        </p>

        <!-- Error -->
        <div
          v-else-if="errorMessage"
          class="text-sm border border-line rounded-md p-3 bg-accent-muted text-ink"
          role="alert"
        >
          <p v-if="unconfigured" class="font-medium mb-1">AI is not configured</p>
          <p>{{ errorMessage }}</p>
        </div>

        <!-- AI body — markdown rendered -->
        <article
          v-else-if="response?.body"
          class="prose-assist text-sm text-ink leading-relaxed"
          v-html="renderedBody"
        ></article>

        <!-- Replacement preview (for focus / expand / proofread) -->
        <details
          v-if="response?.replacement"
          class="border border-line rounded-md"
          :open="showReplacementByDefault"
        >
          <summary class="cursor-pointer px-3 py-2 text-xs uppercase tracking-wider text-ink-lighter font-sans hover:bg-accent-muted">
            Suggested replacement
          </summary>
          <pre class="px-3 py-2 text-sm text-ink whitespace-pre-wrap break-words font-serif">{{ response.replacement }}</pre>
        </details>

        <!-- Provenance -->
        <p v-if="response?.model" class="text-xs text-ink-whisper">
          via {{ response.model }}
        </p>
        </template>
      </div>

      <!-- Action footer — visible only when there's a result -->
      <footer v-if="response" class="px-5 py-3 border-t border-line flex items-center gap-2">
        <button
          v-if="response.replacement && hasSelection"
          type="button"
          class="px-3 py-1.5 text-sm border border-line rounded-md text-ink bg-paper hover:bg-accent-muted"
          @click="$emit('replace', response.replacement)"
        >
          Replace selection
        </button>
        <button
          v-else-if="response.replacement"
          type="button"
          class="px-3 py-1.5 text-sm border border-line rounded-md text-ink bg-paper hover:bg-accent-muted"
          @click="$emit('insert', response.replacement)"
        >
          Insert at cursor
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm border border-line rounded-md text-ink-light bg-paper hover:bg-accent-muted"
          @click="copyToClipboard"
        >
          {{ copyLabel }}
        </button>
        <span class="ml-auto text-xs text-ink-whisper">
          Esc to close
        </span>
      </footer>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { renderMarkdown } from '../../utils/markdown'
import type {
  WritingAssistMode,
  WritingAssistResponse,
} from '@shared/WritingAssist'

interface Props {
  /** Whether the panel is shown. Parent controls visibility. */
  open: boolean
  /** Active assist mode. Drives input UI + result framing. */
  mode: WritingAssistMode
  /** Reactive response from the assist composable. Null means no result yet. */
  response: WritingAssistResponse | null
  /** True while a request is in flight. */
  isLoading: boolean
  /** Last error message; null if none. */
  errorMessage: string | null
  /** True if the 503 "AI not configured" path was hit. */
  unconfigured: boolean
  /** Currently selected text in the writer's textarea (may be empty string). */
  selection: string
  /**
   * True when the essay has been saved to the server (has a writingId).
   * AI assist requires a server-side essay id, so for unsaved drafts the
   * panel shows a "save first" banner instead of input affordances.
   */
  writingSaved: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  /** User asked the model a coherence question. */
  'submit-coherence': [{ question: string; selection: string }]
  /** User asked for a definition. */
  'submit-define': [{ term: string; contextSnippet: string }]
  /** User clicked "Insert at cursor" with the replacement text. */
  insert: [string]
  /** User clicked "Replace selection" with the replacement text. */
  replace: [string]
}>()

const MODE_LABELS: Record<WritingAssistMode, string> = {
  coherence:             'Coherence question',
  define:                'Define',
  focus:                 'Focus selection',
  expand:                'Expand without padding',
  proofread:             'Proofread',
  factcheck:             'Fact-check',
  // Develop quadrant — header text shown at the top of the panel.
  // Phrasing matches the cluster's sub-menu so the writer can match
  // what they clicked to what the panel is doing.
  'fiction-breadth':     'Broaden the canvas',
  'fiction-depth':       'Deepen the stakes',
  'nonfiction-breadth':  'Cast a wider net',
  'nonfiction-depth':    'Drill down',
}

const AUTO_LABELS: Record<WritingAssistMode, string> = {
  coherence:             'Coherence question',
  define:                'Define',
  focus:                 'Focus',
  expand:                'Expand',
  proofread:             'Proofread',
  factcheck:             'Fact-check',
  'fiction-breadth':     'Broaden the canvas',
  'fiction-depth':       'Deepen the stakes',
  'nonfiction-breadth':  'Cast a wider net',
  'nonfiction-depth':    'Drill down',
}

const LOADING_LINES: Record<WritingAssistMode, string> = {
  coherence:             'Reading the essay and any siblings…',
  define:                'Looking up the term…',
  focus:                 'Tightening without losing voice…',
  expand:                'Looking for substance, not filler…',
  proofread:             'Checking for objective errors only…',
  factcheck:             'Checking the claims, flagging what I can…',
  // Develop quadrant — each loading line nods to the framing without
  // bragging. Same length-and-tone register as the other modes.
  'fiction-breadth':     'Looking for canvas to widen, not filler…',
  'fiction-depth':       'Slowing down beats that earn the weight…',
  'nonfiction-breadth':  'Casting around for adjacent angles…',
  'nonfiction-depth':    'Picking the load-bearing claim to develop…',
}

/* ---- Local input state ---- */
const coherenceQuestion = ref('')
const defineTerm = ref('')

/* ---- Derived UI ---- */
const hasSelection = computed(() => props.selection.trim().length > 0)
const selectionPreview = computed(() => {
  const trimmed = props.selection.trim()
  if (trimmed.length <= 60) return `“${trimmed}”`
  return `“${trimmed.slice(0, 30)}…${trimmed.slice(-25)}”`
})

const renderedBody = computed(() =>
  props.response?.body ? renderMarkdown(props.response.body) : ''
)

// Show the replacement collapsed by default for proofread (often unchanged)
// and expanded by default for focus/expand (the writer wants to see the diff).
const showReplacementByDefault = computed(() => props.mode !== 'proofread')

/* ---- Actions ---- */
function submitCoherence() {
  const q = coherenceQuestion.value.trim()
  if (!q) return
  emit('submit-coherence', { question: q, selection: props.selection })
}

function submitDefine() {
  const t = defineTerm.value.trim()
  if (!t) return
  emit('submit-define', { term: t, contextSnippet: props.selection })
}

const copyLabel = ref('Copy')
async function copyToClipboard() {
  const text = props.response?.replacement || props.response?.body || ''
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copyLabel.value = 'Copied'
    setTimeout(() => { copyLabel.value = 'Copy' }, 1400)
  } catch {
    copyLabel.value = 'Copy failed'
    setTimeout(() => { copyLabel.value = 'Copy' }, 1400)
  }
}

/* ---- Focus management ---- */
const questionInputRef = ref<HTMLTextAreaElement | null>(null)
const termInputRef = ref<HTMLInputElement | null>(null)

// When the panel opens or the mode changes, focus the relevant input. For
// auto-running modes there's nothing to focus — the parent fires the
// request itself when it opens the panel.
watch(
  () => [props.open, props.mode] as const,
  async ([open]) => {
    if (!open) return
    await nextTick()
    if (props.mode === 'coherence') questionInputRef.value?.focus()
    else if (props.mode === 'define') termInputRef.value?.focus()
  },
  { immediate: true }
)

// Pre-fill the define term from the current selection on open
watch(
  () => [props.open, props.mode, props.selection] as const,
  ([open, mode, sel]) => {
    if (open && mode === 'define' && sel.trim() && !defineTerm.value) {
      defineTerm.value = sel.trim().slice(0, 200)
    }
  }
)

// Reset local inputs when the panel closes so a re-open feels fresh
watch(() => props.open, (open) => {
  if (!open) {
    coherenceQuestion.value = ''
    defineTerm.value = ''
  }
})
</script>

<style scoped>
.writing-assist-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100vw);
  background-color: rgb(var(--color-paper));
  border-left: 1px solid rgb(var(--color-line));
  display: flex;
  flex-direction: column;
  z-index: 60;
  /* Subtle shadow only — no heavy elevation, fits the zen aesthetic */
  box-shadow: -8px 0 24px -12px rgb(var(--color-ink) / 0.18);
}

/* Slide-in transition */
.assist-panel-enter-active,
.assist-panel-leave-active {
  transition: transform 240ms cubic-bezier(0.25, 0.1, 0.25, 1),
              opacity   180ms ease-out;
}
.assist-panel-enter-from,
.assist-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .assist-panel-enter-active,
  .assist-panel-leave-active {
    transition: none;
  }
  .assist-panel-enter-from,
  .assist-panel-leave-to {
    transform: none;
  }
}

/* Markdown body — match the rest of the app's quiet typography */
.prose-assist :deep(p)        { margin: 0 0 0.75em; }
.prose-assist :deep(p:last-child) { margin-bottom: 0; }
.prose-assist :deep(strong)   { font-weight: 500; color: rgb(var(--color-ink)); }
.prose-assist :deep(em)       { color: rgb(var(--color-ink-light)); }
.prose-assist :deep(ul),
.prose-assist :deep(ol)       { margin: 0 0 0.75em 1.25em; }
.prose-assist :deep(li)       { margin: 0.15em 0; }
.prose-assist :deep(code)     {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  background: rgb(var(--color-accent-muted));
  padding: 0.1em 0.3em;
  border-radius: 3px;
}
.prose-assist :deep(blockquote) {
  border-left: 2px solid rgb(var(--color-line));
  padding-left: 0.75em;
  color: rgb(var(--color-ink-light));
  margin: 0.5em 0;
}
</style>
