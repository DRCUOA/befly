/**
 * Manuscript chat service.
 *
 * One conversation = one row in manuscript_chats. Each user turn:
 *   1. Auth-check via manuscriptService.get (throws NotFound/Forbidden).
 *   2. Persist the user's message immediately so the UI can echo it
 *      even if the LLM call later fails.
 *   3. Retrieve a manuscript-scoped context pack for the new question
 *      (best-effort — falls back to empty pack if RAG isn't configured).
 *   4. Build a system prompt + the retrieved pack + the last 6 prior
 *      turns + the new user message.
 *   5. Call LlmClient.chatText.
 *   6. Persist the assistant's reply with retrievedChunkIds + the
 *      ai_exchange_id from the LLM client.
 *
 * The 6-turn window matches the design call. Older turns are simply
 * dropped (we do NOT summarise yet) — keeps the schema stable and
 * avoids a second LLM call per turn. If users complain about the
 * model "forgetting" earlier context, summary-rollup is the next
 * lever.
 */
import { manuscriptService } from './manuscript.service.js'
import { manuscriptChatRepo } from '../repositories/manuscript-chat.repo.js'
import {
  ManuscriptChat,
  ManuscriptChatMessage,
  ManuscriptChatWithMessages,
  ChatChunkCitation,
  MANUSCRIPT_CHAT_MODELS,
  DEFAULT_MANUSCRIPT_CHAT_MODEL,
  ManuscriptChatModelId,
} from '../models/ManuscriptChat.js'
import {
  LlmClient,
  LlmChatMessage,
  LlmConfigurationError,
} from './llm/llm-client.js'
import { getOpenAIClient } from './llm/openai-client.js'
import { retrieveManuscriptContext } from './rag/index.js'
import { ValidationError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/* ----- LLM client injection (mirrors the other assist services) ----- */

let activeClient: LlmClient | null = null

export function setLlmClientForChatTests(client: LlmClient | null): void {
  activeClient = client
}

function client(): LlmClient {
  return activeClient ?? getOpenAIClient()
}

/* ----- Constants ----- */

const HISTORY_TURN_WINDOW = 6        // last N messages we feed back in
const MAX_USER_MESSAGE_CHARS = 4000  // bound a single question
const MAX_TITLE_CHARS = 80
const RAG_TOP_K = 8
const RAG_MAX_CONTEXT_TOKENS = 3500

const ALLOWED_MODELS: readonly string[] = MANUSCRIPT_CHAT_MODELS.map(m => m.id)

function validateModel(model: string | undefined): string {
  if (!model || !model.trim()) return DEFAULT_MANUSCRIPT_CHAT_MODEL
  if (!ALLOWED_MODELS.includes(model)) {
    throw new ValidationError(
      `Unsupported chat model "${model}". Allowed: ${ALLOWED_MODELS.join(', ')}`
    )
  }
  return model
}

/* ----- Prompt assembly ----- */

const CHAT_SYSTEM_PROMPT = `You are a manuscript assistant for a working writer.

You always answer questions about ONE manuscript at a time. Use the retrieved manuscript context below as authoritative project memory unless the user explicitly overrides it. Quote the writer's own phrasing when relevant. If the answer requires information that isn't in the retrieved context, say so plainly rather than inventing.

Voice rules:
- Preserve the writer's voice when quoting. Do not flatten unusual phrasing.
- Treat productive roughness (contradiction, unresolved feeling, odd phrasing that carries meaning) as potentially valuable, not as a problem to fix.
- Do not invent events, scenes, names, or biographical details that are not in the retrieved context.
- Where useful, point at specific sources by their title (e.g. "Beat 12: Dawn at the ridge") so the writer can navigate to them.

Format:
- Reply in concise markdown.
- Use short paragraphs and bullet lists where they help.
- Cite sources inline with the source's title in italics, like *Beat 12: Dawn at the ridge*.`

interface BuildPromptArgs {
  manuscriptTitle: string
  manuscriptId: string
  contextPack: string
  history: ManuscriptChatMessage[]
  userMessage: string
}

function buildMessages(args: BuildPromptArgs): LlmChatMessage[] {
  const directionLine =
    `Current manuscript: "${args.manuscriptTitle}" (id: ${args.manuscriptId}).`

  const systemContent = `${CHAT_SYSTEM_PROMPT}\n\n${directionLine}\n\n` +
    `<retrieved_manuscript_context>\n${args.contextPack || '(No retrieved context for this turn.)'}\n</retrieved_manuscript_context>`

  const messages: LlmChatMessage[] = [{ role: 'system', content: systemContent }]
  for (const m of args.history) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    messages.push({ role: m.role, content: m.content })
  }
  messages.push({ role: 'user', content: args.userMessage })
  return messages
}

/* ----- Citation extraction ----- */

interface RetrievedForTurn {
  contextPack: string
  citations: ChatChunkCitation[]
  chunkIds: string[]
}

async function tryRetrieve(manuscriptId: string, query: string): Promise<RetrievedForTurn> {
  try {
    const result = await retrieveManuscriptContext(manuscriptId, query, {
      topK: RAG_TOP_K,
      maxContextTokens: RAG_MAX_CONTEXT_TOKENS,
    })
    return {
      contextPack: result.contextPack,
      chunkIds: result.chunks.map(c => c.chunkId),
      citations: result.chunks.map(c => ({
        chunkId: c.chunkId,
        contextSourceId: c.contextSourceId,
        title: c.title,
        sourceType: c.sourceType,
        contextRole: c.contextRole,
        excerpt: c.text.slice(0, 240),
        score: c.score,
      })),
    }
  } catch (err) {
    logger.warn('[manuscript-chat] retrieval skipped', {
      manuscriptId,
      message: err instanceof Error ? err.message : String(err),
    })
    return { contextPack: '', chunkIds: [], citations: [] }
  }
}

/* ----- Public API ----- */

export interface SendMessageResult {
  chat: ManuscriptChat
  userMessage: ManuscriptChatMessage
  assistantMessage: ManuscriptChatMessage
  citations: ChatChunkCitation[]
}

export const manuscriptChatService = {
  async listChats(
    manuscriptId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<ManuscriptChat[]> {
    // Auth-check the manuscript before listing chats. Chats themselves
    // are per-user, but a user must at least be able to read the
    // manuscript to enumerate them.
    await manuscriptService.get(manuscriptId, userId, isAdmin)
    return manuscriptChatRepo.listForManuscript(manuscriptId, userId)
  },

  async getChat(
    chatId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<ManuscriptChatWithMessages> {
    const chat = await manuscriptChatRepo.findById(chatId, userId)
    // Re-check manuscript access in case the user's role changed since
    // the chat was created. Throws NotFound if they no longer can read it.
    await manuscriptService.get(chat.manuscriptId, userId, isAdmin)
    const messages = await manuscriptChatRepo.listMessages(chatId)
    return { chat, messages }
  },

  async createChat(input: {
    manuscriptId: string
    userId: string
    title?: string
    model?: ManuscriptChatModelId | string
  }, isAdmin: boolean = false): Promise<ManuscriptChat> {
    await manuscriptService.get(input.manuscriptId, input.userId, isAdmin)
    const title = (input.title ?? 'New chat').trim().slice(0, MAX_TITLE_CHARS) || 'New chat'
    const model = validateModel(input.model)
    return manuscriptChatRepo.create({
      manuscriptId: input.manuscriptId,
      userId: input.userId,
      title,
      model,
    })
  },

  async renameChat(chatId: string, userId: string, title: string): Promise<ManuscriptChat> {
    const trimmed = title.trim().slice(0, MAX_TITLE_CHARS)
    if (!trimmed) throw new ValidationError('Chat title cannot be empty')
    return manuscriptChatRepo.update(chatId, userId, { title: trimmed })
  },

  async setChatModel(chatId: string, userId: string, model: string): Promise<ManuscriptChat> {
    return manuscriptChatRepo.update(chatId, userId, { model: validateModel(model) })
  },

  async archiveChat(chatId: string, userId: string, archived = true): Promise<ManuscriptChat> {
    return manuscriptChatRepo.update(chatId, userId, { archived })
  },

  async deleteChat(chatId: string, userId: string): Promise<void> {
    return manuscriptChatRepo.delete(chatId, userId)
  },

  /**
   * Send one user message and synchronously generate the assistant
   * reply. Both messages are persisted (the user message first, before
   * the LLM call, so the conversation state survives a model failure).
   *
   * If the model call throws, the user's message stays in the log and
   * the error bubbles up — the UI shows the error inline; the writer
   * can retry by sending again.
   */
  async sendMessage(
    chatId: string,
    userId: string,
    content: string,
    isAdmin: boolean = false
  ): Promise<SendMessageResult> {
    const trimmed = content.trim()
    if (!trimmed) throw new ValidationError('Message cannot be empty')
    if (trimmed.length > MAX_USER_MESSAGE_CHARS) {
      throw new ValidationError(`Message exceeds ${MAX_USER_MESSAGE_CHARS} chars`)
    }

    const chat = await manuscriptChatRepo.findById(chatId, userId)
    const manuscript = await manuscriptService.get(chat.manuscriptId, userId, isAdmin)

    // Persist the user turn FIRST so it's durable even if the LLM call
    // later fails. The drawer relies on this — a network blip mid-call
    // shouldn't lose what the writer typed.
    const userMessage = await manuscriptChatRepo.appendMessage({
      chatId,
      role: 'user',
      content: trimmed,
    })

    // Refuse the call cleanly if the LLM client isn't configured. We do
    // this AFTER persisting the user turn so the writer's text is saved.
    let llm: LlmClient
    try {
      llm = client()
    } catch (err) {
      if (err instanceof LlmConfigurationError) throw err
      throw err
    }

    // Pull a fresh context pack for the latest question. (We do not
    // try to merge with prior turns' retrievals — every turn gets its
    // own retrieval, scoped by the new query.)
    const retrieved = await tryRetrieve(chat.manuscriptId, trimmed)

    // Last N prior messages (excluding the one we just inserted, since
    // it would duplicate the new user turn).
    const allMessages = await manuscriptChatRepo.listMessages(chatId)
    const priorWindow = allMessages
      .filter(m => m.id !== userMessage.id)
      .slice(-HISTORY_TURN_WINDOW)

    const messages = buildMessages({
      manuscriptTitle: manuscript.title,
      manuscriptId: chat.manuscriptId,
      contextPack: retrieved.contextPack,
      history: priorWindow,
      userMessage: trimmed,
    })

    const start = Date.now()
    const response = await llm.chatText({
      model: chat.model,
      messages,
      // Slightly higher than the JSON modes — chat answers are ok being
      // a touch more varied. Bounded so the model still grounds.
      temperature: 0.5,
      maxOutputTokens: 1500,
      context: {
        feature: 'manuscript-chat',
        mode: 'turn',
        userId,
        resourceType: 'manuscript_chat',
        resourceId: chatId,
        manuscriptId: chat.manuscriptId,
      },
    })
    logger.info('[manuscript-chat] turn completed', {
      chatId,
      manuscriptId: chat.manuscriptId,
      model: response.model,
      ms: Date.now() - start,
      retrievedChunks: retrieved.chunkIds.length,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
    })

    const assistantMessage = await manuscriptChatRepo.appendMessage({
      chatId,
      role: 'assistant',
      content: response.content,
      retrievedChunkIds: retrieved.chunkIds,
      aiExchangeId: response.exchangeId ?? null,
      model: response.model,
      promptTokens: response.usage?.promptTokens ?? null,
      completionTokens: response.usage?.completionTokens ?? null,
    })

    const refreshedChat = await manuscriptChatRepo.findById(chatId, userId)

    return {
      chat: refreshedChat,
      userMessage,
      assistantMessage,
      citations: retrieved.citations,
    }
  },
}
