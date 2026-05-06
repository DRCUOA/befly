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
      <!-- Header -->
      <header class="px-4 py-3 border-b border-gray-100 bg-paper">
        <div class="flex items-center gap-2 mb-2">
          <p class="text-xs uppercase tracking-widest text-ink-lighter flex-1">
            Manuscript chat
          </p>
          <button
            @click="emit('close')"
            class="text-ink-lighter hover:text-ink text-sm"
            aria-label="Close drawer"
          >✕</button>
        </div>
        <div class="flex items-center gap-2">
          <select
            v-model="selectedChatId"
            class="flex-1 text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            @change="onChatChange"
          >
            <option value="" disabled>Select a chat…</option>
            <option v-for="c in chats" :key="c.id" :value="c.id">
              {{ c.title }}
            </option>
          </select>
          <button
            @click="newChat"
            :disabled="busy"
            class="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            title="Start a new chat"
          >+ New</button>
        </div>
        <div v-if="activeChat" class="flex items-center gap-2 mt-2">
          <label class="text-xs text-ink-lighter">Model</label>
          <select
            v-model="modelForActive"
            class="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            @change="changeModel"
          >
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
          <button
            @click="renameActive"
            class="text-xs text-ink-lighter hover:text-ink"
            title="Rename chat"
          >Rename</button>
          <button
            @click="deleteActive"
            class="text-xs text-red-600 hover:text-red-800"
            title="Delete chat"
          >Delete</button>
        </div>
      </header>

      <!-- Messages -->
      <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-3 bg-white">
        <div v-if="!activeChat" class="text-sm text-ink-lighter text-center py-10">
          <p class="mb-3">
            No chat is open yet. Every chat is scoped to this manuscript —
            retrieved context comes only from indexed sources for this project.
          </p>
          <button
            type="button"
            @click="newChat"
            :disabled="busy"
            class="px-3 py-1.5 text-sm border border-blue-500 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50"
          >Start a new chat</button>
        </div>
        <div v-else-if="messagesLoading && messages.length === 0" class="text-sm text-ink-lighter text-center py-10">
          Loading…
        </div>
        <template v-else>
          <div v-for="msg in messages" :key="msg.id" class="mb-4">
            <div class="flex items-start gap-2">
              <span
                class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5"
                :class="msg.role === 'user' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-ink-light'"
              >{{ msg.role }}</span>
              <div class="flex-1 min-w-0">
                <div
                  class="text-sm whitespace-pre-wrap break-words"
                  :class="msg.role === 'user' ? 'text-ink' : 'text-ink-light'"
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
                <p v-if="msg.role === 'assistant' && msg.model" class="text-[10px] text-ink-lighter mt-0.5">
                  {{ msg.model }}<span v-if="msg.completionTokens"> · {{ msg.completionTokens }} tokens out</span>
                </p>
              </div>
            </div>
          </div>
          <div v-if="busy" class="text-xs text-ink-lighter italic">Thinking…</div>
          <p v-if="errorMessage" class="text-xs text-red-600 mt-2">{{ errorMessage }}</p>
        </template>
      </div>

      <!-- Composer -->
      <footer class="border-t border-gray-100 px-4 py-3 bg-paper">
        <form @submit.prevent="onSubmit" class="flex items-end gap-2">
          <textarea
            v-model="draft"
            rows="2"
            :disabled="!activeChat || busy"
            placeholder="Ask anything about this manuscript…"
            class="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none disabled:bg-gray-50"
            @keydown.enter.exact.prevent="onSubmit"
          ></textarea>
          <button
            type="submit"
            :disabled="!activeChat || busy || !draft.trim()"
            class="px-3 py-1.5 text-sm border border-blue-500 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50"
          >
            {{ busy ? 'Sending…' : 'Send' }}
          </button>
        </form>
        <p class="text-[10px] text-ink-lighter mt-1">
          Enter to send · Shift+Enter for newline · Replies use indexed manuscript context. Reindex from /admin/rag if results look stale.
        </p>
      </footer>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
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

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
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
      // Auto-create the first chat so the textarea is immediately
      // usable. The previous behaviour landed the user in a state
      // where everything looked disabled (the picker had no options
      // and the composer was gated on `activeChat`), and the only
      // way forward was a small "+ New" button — which wasn't
      // obvious. Creating on open removes that step.
      const created = await manuscriptChatApi.create(props.manuscriptId, {
        title: 'New chat',
        model: defaultModel.value || undefined,
      })
      chats.value = [created]
      selectedChatId.value = created.id
      messages.value = []
      modelForActive.value = created.model
    } else if (!selectedChatId.value || !chats.value.find(c => c.id === selectedChatId.value)) {
      // Auto-select the most recently updated chat.
      selectedChatId.value = chats.value[0].id
      await loadMessages(selectedChatId.value)
    }
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
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    messagesLoading.value = false
  }
}

const onChatChange = () => {
  if (selectedChatId.value) loadMessages(selectedChatId.value)
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
  if (!activeChat.value || busy.value || !draft.value.trim()) return
  const content = draft.value.trim()
  busy.value = true
  errorMessage.value = ''
  // Optimistic echo of the user message so the UI feels responsive.
  const optimistic: ManuscriptChatMessage = {
    id: `optimistic-${Date.now()}`,
    chatId: activeChat.value.id,
    role: 'user',
    content,
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
    // Replace the optimistic message with the persisted one and append
    // the assistant turn.
    messages.value = [
      ...messages.value.filter(m => m.id !== optimistic.id),
      result.userMessage,
      result.assistantMessage,
    ]
    citationsByMessageId.value = {
      ...citationsByMessageId.value,
      [result.assistantMessage.id]: result.citations,
    }
    // Bump the chat to the top of the list (its updatedAt just changed).
    const idx = chats.value.findIndex(c => c.id === result.chat.id)
    if (idx >= 0) {
      const [chat] = chats.value.splice(idx, 1)
      chats.value = [{ ...chat, updatedAt: result.chat.updatedAt }, ...chats.value]
    }
    await scrollToBottom()
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
  }
})

watch(() => props.manuscriptId, () => {
  // Manuscript changed — drop chat state and reload.
  selectedChatId.value = ''
  messages.value = []
  if (props.open) loadChats()
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
</style>
