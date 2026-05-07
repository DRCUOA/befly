<template>
  <div v-if="open" class="fixed inset-0 z-40 flex">
    <!-- Backdrop -->
    <div
      class="flex-1 bg-black/30 backdrop-blur-[2px]"
      @click="emit('close')"
    ></div>

    <!-- Drawer -->
    <aside
      class="w-full max-w-md sm:max-w-lg lg:max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-gray-200"
      role="dialog"
      aria-label="Manuscript chat"
    >
      <!-- Header: drawer title + close -->
      <header class="px-4 py-3 border-b border-gray-100 bg-paper">
        <div class="flex items-center gap-2">
          <p class="text-xs uppercase tracking-widest text-ink-lighter flex-1">
            Manuscript chat
          </p>
          <button
            @click="emit('close')"
            class="text-ink-lighter hover:text-ink text-sm"
            aria-label="Close drawer"
          >✕</button>
        </div>
      </header>

      <!-- Toolbar: list-view ↔ active-chat navigation.
           - "← Chats" goes back to the list view (closes the active
             chat without closing the drawer).
           - The active chat title sits in the middle as an anchor.
           - "+ New chat" is always visible so a fresh thread is one
             click away from either view. -->
      <div class="px-4 py-2 border-b border-gray-100 bg-paper flex items-center gap-2">
        <button
          v-if="activeChat"
          @click="showChatList"
          class="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
          title="Back to the list of saved chats"
        >← Chats</button>
        <span
          v-if="activeChat"
          class="flex-1 text-sm font-medium truncate"
          :title="activeChat.title"
        >{{ activeChat.title }}</span>
        <span v-else class="flex-1 text-xs uppercase tracking-wider text-ink-lighter">
          Saved chats
        </span>
        <button
          @click="newChat"
          :disabled="busy"
          class="text-xs px-2 py-1 border border-blue-500 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50"
          title="Start a new chat"
        >+ New chat</button>
      </div>

      <!-- Model picker + per-chat actions (only when an active chat
           is open). Hidden in the list view. -->
      <div v-if="activeChat" class="px-4 py-2 border-b border-gray-100 bg-paper">
        <label class="block text-[11px] uppercase tracking-wider text-ink-lighter mb-1">
          AI model
        </label>
        <select
          v-model="modelForActive"
          class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          @change="changeModel"
        >
          <option v-for="m in models" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
        <p class="text-[10px] text-ink-lighter mt-1">
          Applies to your next turn. Earlier turns keep the model they were sent with.
        </p>
        <div class="mt-2 flex items-center gap-3 text-[11px]">
          <button
            @click="renameActive"
            class="text-ink-lighter hover:text-ink"
            title="Rename chat"
          >Rename</button>
          <span class="text-ink-lighter">·</span>
          <button
            @click="deleteActive"
            class="text-red-600 hover:text-red-800"
            title="Delete chat"
          >Delete</button>
        </div>
      </div>

      <!-- Body: chat list view OR message log -->
      <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-3 bg-white">
        <!-- List view: shown when no chat is active. Lists every saved
             chat with its model and last-updated time. -->
        <template v-if="!activeChat">
          <div v-if="chats.length === 0" class="text-sm text-ink-lighter text-center py-10">
            <p class="mb-3">
              No chats yet. Every chat is scoped to this manuscript —
              retrieved context comes only from indexed sources for this project.
            </p>
            <button
              type="button"
              @click="newChat"
              :disabled="busy"
              class="px-3 py-1.5 text-sm border border-blue-500 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50"
            >Start a new chat</button>
          </div>
          <ul v-else class="space-y-1.5">
            <li v-for="c in chats" :key="c.id">
              <button
                type="button"
                @click="openChat(c.id)"
                class="w-full text-left p-2.5 rounded border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
              >
                <div class="text-sm font-medium text-ink truncate">{{ c.title }}</div>
                <div class="text-[11px] text-ink-lighter mt-0.5">
                  {{ c.model }} · updated {{ formatRelativeTime(c.updatedAt) }}
                </div>
              </button>
            </li>
          </ul>
        </template>

        <!-- Active-chat view: messages + (later) composer in the footer. -->
        <div v-else-if="messagesLoading && messages.length === 0" class="text-sm text-ink-lighter text-center py-10">
          Loading…
        </div>
        <template v-else>
          <div v-for="msg in messages" :key="msg.id" class="mb-4">
            <div class="flex items-start gap-2">
              <span
                class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5"
                :class="msg.role === 'user' ? 'bg-blue-50 text-blue-700' : (msg.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-ink-light')"
              >{{ msg.role }}</span>
              <div class="flex-1 min-w-0">
                <!-- Pending assistant placeholder while the background
                     LLM call is still running. -->
                <div v-if="msg.role === 'assistant' && msg.status === 'pending'" class="text-sm italic text-ink-lighter">
                  <span class="inline-flex items-center gap-1">
                    <span class="dot-pulse">Thinking</span>
                    <span class="dot-pulse-anim">…</span>
                  </span>
                  <span class="ml-1 text-[10px]">({{ msg.model || 'default model' }})</span>
                </div>
                <div
                  v-else
                  class="text-sm whitespace-pre-wrap break-words"
                  :class="msg.role === 'user' ? 'text-ink' : (msg.status === 'error' ? 'text-red-700' : 'text-ink-light')"
                >{{ msg.content }}</div>
                <div v-if="msg.retrievedChunkIds.length > 0" class="mt-1">
                  <details class="text-[11px] text-ink-lighter">
                    <summary class="cursor-pointer">
                      Grounded in {{ msg.retrievedChunkIds.length }} source{{ msg.retrievedChunkIds.length === 1 ? '' : 's' }}
                      <span v-if="citationsByMessageId[msg.id]?.length">
                        — {{ citationsByMessageId[msg.id].slice(0, 2).map(c => c.title).join(', ') }}{{ citationsByMessageId[msg.id].length > 2 ? '…' : '' }}
                      </span>
                    </summary>
                    <ul class="mt-1 ml-3 space-y-1">
                      <li v-for="c in citationsByMessageId[msg.id] ?? []" :key="c.chunkId">
                        <span class="font-medium">{{ c.title }}</span>
                        <span class="text-ink-lighter"> · {{ c.sourceType }} · {{ c.contextRole }} · {{ c.score.toFixed(2) }}</span>
                        <p class="ml-2 mt-0.5 italic text-ink-lighter">{{ c.excerpt }}</p>
                      </li>
                    </ul>
                  </details>
                </div>
                <p v-if="msg.role === 'assistant' && msg.status === 'complete' && msg.model" class="text-[10px] text-ink-lighter mt-0.5">
                  {{ msg.model }}<span v-if="msg.completionTokens"> · {{ msg.completionTokens }} tokens out</span>
                </p>
              </div>
            </div>
          </div>
          <p v-if="errorMessage" class="text-xs text-red-600 mt-2">{{ errorMessage }}</p>
        </template>
      </div>

      <!-- Composer (hidden in list view — pick or start a chat first) -->
      <footer v-if="activeChat" class="border-t border-gray-100 px-4 py-3 bg-paper">
        <form @submit.prevent="onSubmit" class="flex items-end gap-2">
          <textarea
            v-model="draft"
            rows="2"
            :disabled="composerDisabled"
            :placeholder="hasPending ? 'Waiting for the model to reply…' : 'Ask anything about this manuscript…'"
            class="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none disabled:bg-gray-50"
            @keydown.enter.exact.prevent="onSubmit"
          ></textarea>
          <button
            type="submit"
            :disabled="composerDisabled || !draft.trim()"
            class="px-3 py-1.5 text-sm border border-blue-500 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50"
          >
            {{ busy ? 'Sending…' : 'Send' }}
          </button>
        </form>
        <p class="text-[10px] text-ink-lighter mt-1">
          <template v-if="hasPending">
            Reasoning models can take 30–60s. The reply will land here automatically — feel free to leave the drawer open.
          </template>
          <template v-else>
            Enter to send · Shift+Enter for newline · Replies use indexed manuscript context. Reindex from /admin/rag if results look stale.
          </template>
        </p>
      </footer>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { manuscriptChatApi } from '../../api/manuscriptChat'
import type {
  ManuscriptChat,
  ManuscriptChatMessage,
  ChatChunkCitation,
} from '@shared/ManuscriptChat'

const props = defineProps<{
  open: boolean
  manuscriptId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const chats = ref<ManuscriptChat[]>([])
const selectedChatId = ref('')
const messages = ref<ManuscriptChatMessage[]>([])
const messagesLoading = ref(false)
const draft = ref('')
const busy = ref(false)
const errorMessage = ref('')

const models = ref<{ id: string; label: string }[]>([])
const defaultModel = ref('')
const modelForActive = ref('')

// Map message.id → citations for the most recent retrieval. Server only
// returns citations on the live POST response (not on subsequent GETs),
// so we cache them here for the lifetime of the drawer.
const citationsByMessageId = ref<Record<string, ChatChunkCitation[]>>({})

const messagesEl = ref<HTMLElement | null>(null)

const activeChat = computed(() =>
  chats.value.find(c => c.id === selectedChatId.value) ?? null
)

/**
 * True while any message in the active chat is in 'pending' status —
 * meaning the server's background worker hasn't finished the LLM call
 * yet. We poll while this is true and disable the composer so the
 * writer can't fire a second turn before the first lands.
 */
const hasPending = computed(() => messages.value.some(m => m.status === 'pending'))

const composerDisabled = computed(() => !activeChat.value || busy.value || hasPending.value)

// Polling state. Cleared on chat change, drawer close, and unmount so a
// stale interval can't keep firing against the wrong chat.
let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL_MS = 2000
const POLL_MAX_MS = 5 * 60 * 1000  // give up after 5 minutes
let pollStartedAt = 0

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const startPollingIfNeeded = () => {
  if (pollTimer) return
  if (!hasPending.value) return
  pollStartedAt = Date.now()
  pollTimer = setInterval(async () => {
    if (!selectedChatId.value || !props.open) {
      stopPolling()
      return
    }
    if (Date.now() - pollStartedAt > POLL_MAX_MS) {
      stopPolling()
      errorMessage.value = 'The model is taking longer than expected. Refresh the chat to check again.'
      return
    }
    try {
      const r = await manuscriptChatApi.get(props.manuscriptId, selectedChatId.value)
      messages.value = r.messages
      if (!hasPending.value) {
        stopPolling()
        await scrollToBottom()
      }
    } catch (e) {
      // Network blip — keep polling. If the user closes the drawer or
      // navigates away, the watch on `props.open` clears the timer.
      // eslint-disable-next-line no-console
      console.warn('[chat] poll error', e)
    }
  }, POLL_INTERVAL_MS)
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

/** Compact "Nm ago" / "Nh ago" / fallback to short date for chat-list rows. */
const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

const loadModels = async () => {
  if (models.value.length > 0) return
  try {
    const res = await manuscriptChatApi.listModels()
    models.value = res.models
    defaultModel.value = res.default
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const loadChats = async () => {
  if (!props.manuscriptId) return
  try {
    chats.value = await manuscriptChatApi.list(props.manuscriptId)
    if (chats.value.length === 0) {
      // No saved chats yet: auto-create one so the composer is
      // immediately usable, instead of landing on an empty list view
      // with only a "Start a new chat" button.
      const created = await manuscriptChatApi.create(props.manuscriptId, {
        title: 'New chat',
        model: defaultModel.value || undefined,
      })
      chats.value = [created]
      selectedChatId.value = created.id
      messages.value = []
      modelForActive.value = created.model
    } else if (selectedChatId.value && !chats.value.find(c => c.id === selectedChatId.value)) {
      // The previously-active chat was deleted or no longer accessible;
      // drop back to the list view so the user can pick another.
      selectedChatId.value = ''
      messages.value = []
    }
    // Otherwise: leave selectedChatId as-is. If it's empty, the body
    // renders the list view (the writer can pick a chat or start a
    // new one). If it's set, the active-chat view stays put across
    // drawer opens.
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const loadMessages = async (chatId: string) => {
  messagesLoading.value = true
  errorMessage.value = ''
  try {
    const r = await manuscriptChatApi.get(props.manuscriptId, chatId)
    messages.value = r.messages
    modelForActive.value = r.chat.model
    await scrollToBottom()
    // If we landed on a chat whose latest assistant turn is still
    // pending (e.g. the writer reloaded mid-call), resume polling.
    if (hasPending.value) startPollingIfNeeded()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    messagesLoading.value = false
  }
}

/** Open a chat from the list view. Loads its messages and resumes
 *  polling if the latest assistant turn is still pending. */
const openChat = async (chatId: string) => {
  selectedChatId.value = chatId
  await loadMessages(chatId)
}

/** Close the active chat without closing the drawer. The writer is
 *  returned to the list view; the chat itself is preserved (this is
 *  not a delete — to delete, use the per-chat Delete button in the
 *  active-chat header). */
const showChatList = () => {
  stopPolling()
  selectedChatId.value = ''
  messages.value = []
  errorMessage.value = ''
}

const newChat = async () => {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const created = await manuscriptChatApi.create(props.manuscriptId, {
      title: 'New chat',
      model: defaultModel.value || undefined,
    })
    chats.value = [created, ...chats.value]
    selectedChatId.value = created.id
    messages.value = []
    modelForActive.value = created.model
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

const renameActive = async () => {
  if (!activeChat.value) return
  const next = prompt('Rename chat', activeChat.value.title)
  if (!next || !next.trim()) return
  try {
    const updated = await manuscriptChatApi.rename(props.manuscriptId, activeChat.value.id, next.trim())
    const idx = chats.value.findIndex(c => c.id === updated.id)
    if (idx >= 0) chats.value[idx] = updated
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const deleteActive = async () => {
  if (!activeChat.value) return
  if (!confirm(`Delete the chat "${activeChat.value.title}"? This cannot be undone.`)) return
  try {
    await manuscriptChatApi.delete(props.manuscriptId, activeChat.value.id)
    chats.value = chats.value.filter(c => c.id !== activeChat.value!.id)
    selectedChatId.value = chats.value[0]?.id ?? ''
    messages.value = []
    if (selectedChatId.value) await loadMessages(selectedChatId.value)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const changeModel = async () => {
  if (!activeChat.value || !modelForActive.value) return
  try {
    const updated = await manuscriptChatApi.setModel(props.manuscriptId, activeChat.value.id, modelForActive.value)
    const idx = chats.value.findIndex(c => c.id === updated.id)
    if (idx >= 0) chats.value[idx] = updated
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  }
}

const onSubmit = async () => {
  if (composerDisabled.value || !draft.value.trim()) return
  if (!activeChat.value) return
  const content = draft.value.trim()
  busy.value = true
  errorMessage.value = ''
  // Optimistic echo of the user message so the UI feels responsive
  // while the POST round-trip is in flight (~100ms now that the LLM
  // call no longer blocks the request).
  const optimistic: ManuscriptChatMessage = {
    id: `optimistic-${Date.now()}`,
    chatId: activeChat.value.id,
    role: 'user',
    content,
    status: 'complete',
    retrievedChunkIds: [],
    aiExchangeId: null,
    model: null,
    promptTokens: null,
    completionTokens: null,
    createdAt: new Date().toISOString(),
  }
  messages.value = [...messages.value, optimistic]
  draft.value = ''
  await scrollToBottom()
  try {
    const result = await manuscriptChatApi.sendMessage(props.manuscriptId, activeChat.value.id, content)
    // The server returned the persisted user message + a 'pending'
    // assistant placeholder. The actual assistant content arrives via
    // polling once the background LLM call finishes.
    messages.value = [
      ...messages.value.filter(m => m.id !== optimistic.id),
      result.userMessage,
      result.assistantMessage,
    ]
    // Citations are no longer returned synchronously — they land on
    // the placeholder row via retrieved_chunk_ids when the background
    // worker finalises it. The "Grounded in N sources" UI reads the
    // chunk count off the message; the per-citation excerpts will
    // populate when we add a chunks-by-id endpoint.
    // Bump the chat to the top of the list (its updatedAt just changed).
    const idx = chats.value.findIndex(c => c.id === result.chat.id)
    if (idx >= 0) {
      const [chat] = chats.value.splice(idx, 1)
      chats.value = [{ ...chat, updatedAt: result.chat.updatedAt }, ...chats.value]
    }
    await scrollToBottom()
    startPollingIfNeeded()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
    // Roll back the optimistic echo on failure so the writer can retry.
    messages.value = messages.value.filter(m => m.id !== optimistic.id)
  } finally {
    busy.value = false
  }
}

// React to drawer-open: load models + the chat list. The drawer keeps
// state across open/close so the writer doesn't lose their place.
watch(() => props.open, async (open) => {
  if (open) {
    await loadModels()
    await loadChats()
    await scrollToBottom()
  } else {
    // Stop polling when the drawer closes — we'll resume on reopen if
    // there's still a pending message.
    stopPolling()
  }
})

watch(() => props.manuscriptId, () => {
  // Manuscript changed — drop chat state and reload.
  stopPolling()
  selectedChatId.value = ''
  messages.value = []
  if (props.open) loadChats()
})

watch(selectedChatId, () => {
  // Switching chats invalidates the polling target.
  stopPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
aside {
  animation: slide-in 180ms ease-out;
}
@keyframes slide-in {
  from { transform: translateX(8%); opacity: 0; }
  to   { transform: translateX(0);   opacity: 1; }
}

.dot-pulse-anim {
  display: inline-block;
  animation: dot-pulse 1.2s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.3; }
  40%           { opacity: 1; }
}
</style>
