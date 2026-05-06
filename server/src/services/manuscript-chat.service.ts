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
import type {
  ManuscriptChat,
  ManuscriptChatMessage,
  ManuscriptChatWithMessages,
  ChatChunkCitation,
  ManuscriptChatModelId,
} from '../models/ManuscriptChat.js'
import {
  DEFAULT_MANUSCRIPT_CHAT_MODEL,
  ALLOWED_MANUSCRIPT_CHAT_MODEL_IDS,
} from './manuscript-chat-models.js'
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

function validateModel(model: string | undefined): string {
  if (!model || !model.trim()) return DEFAULT_MANUSCRIPT_CHAT_MODEL
  if (!ALLOWED_MANUSCRIPT_CHAT_MODEL_IDS.includes(model)) {
    throw new ValidationError(
      `Unsupported chat model "${model}". Allowed: ${ALLOWED_MANUSCRIPT_CHAT_MODEL_IDS.join(', ')}`
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
   * Persist one user message + a 'pending' assistant placeholder, then
   * RETURN IMMEDIATELY. The retrieval + LLM call runs as a background
   * promise that finalises the placeholder when it completes.
   *
   * Why this shape: Heroku's web dyno has a hard 30s router timeout.
   * Reasoning models (gpt-5, gpt-5-mini) routinely take 40+ seconds.
   * Awaiting the LLM call inside the request handler used to produce
   * H12 timeouts even though the work itself completed correctly.
   *
   * The client polls GET /chats/:id until the placeholder transitions
   * to 'complete' or 'error'. Citations for an answer are no longer
   * returned synchronously — the client reads them out of the
   * placeholder's retrieved_chunk_ids on the next poll cycle.
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

    // 1. Persist the user turn so it's durable.
    const userMessage = await manuscriptChatRepo.appendMessage({
      chatId,
      role: 'user',
      content: trimmed,
    })

    // 2. Refuse the call cleanly if the LLM client isn't configured.
    //    Surfaced now (before the placeholder) so the writer sees a
    //    real error instead of a placeholder that times out.
    let llm: LlmClient
    try {
      llm = client()
    } catch (err) {
      if (err instanceof LlmConfigurationError) throw err
      throw err
    }

    // 3. Insert the assistant placeholder with status='pending' and
    //    capture its id so the background worker can finalise it.
    const pendingAssistant = await manuscriptChatRepo.appendPendingAssistant(chatId, chat.model)

    // 4. Kick off the long-running work. We DO NOT await this — the
    //    HTTP handler returns within ~100ms regardless of how long
    //    the LLM call takes. The promise updates the placeholder when
    //    it finishes; any failure is recorded as an 'error' state on
    //    the same row.
    void runTurnInBackground({
      chatId,
      manuscriptId: chat.manuscriptId,
      manuscriptTitle: manuscript.title,
      userId,
      userQuery: trimmed,
      pendingAssistantId: pendingAssistant.id,
      model: chat.model,
      llm,
    })

    const refreshedChat = await manuscriptChatRepo.findById(chatId, userId)
    return {
      chat: refreshedChat,
      userMessage,
      assistantMessage: pendingAssistant,
      // Citations land on the placeholder row when the background
      // worker finalises it — the client reads them from the polled
      // message rather than from this synchronous response.
      citations: [],
    }
  },
}

/* ----- Background worker -----
 *
 * Runs outside any HTTP request lifecycle. It must not throw — every
 * failure path is captured as an 'error' state on the placeholder so
 * the client can render a clean message instead of polling forever.
 */
interface BackgroundTurnInput {
  chatId: string
  manuscriptId: string
  manuscriptTitle: string
  userId: string
  userQuery: string
  pendingAssistantId: string
  model: string
  llm: LlmClient
}

async function runTurnInBackground(input: BackgroundTurnInput): Promise<void> {
  const start = Date.now()
  try {
    const retrieved = await tryRetrieve(input.manuscriptId, input.userQuery)

    // Pull the trimmed history window — excluding the placeholder we
    // just inserted (which is empty) and the just-persisted user
    // message (which is appended explicitly below).
    const allMessages = await manuscriptChatRepo.listMessages(input.chatId)
    const priorWindow = allMessages
      .filter(m => m.id !== input.pendingAssistantId && m.status === 'complete')
      .slice(-HISTORY_TURN_WINDOW)

    const messages = buildMessages({
      manuscriptTitle: input.manuscriptTitle,
      manuscriptId: input.manuscriptId,
      contextPack: retrieved.contextPack,
      history: priorWindow,
      userMessage: input.userQuery,
    })

    const response = await input.llm.chatText({
      model: input.model,
      messages,
      temperature: 0.5,
      maxOutputTokens: 1500,
      context: {
        feature: 'manuscript-chat',
        mode: 'turn',
        userId: input.userId,
        resourceType: 'manuscript_chat',
        resourceId: input.chatId,
        manuscriptId: input.manuscriptId,
      },
    })

    await manuscriptChatRepo.finalizeAssistantMessage({
      id: input.pendingAssistantId,
      content: response.content,
      retrievedChunkIds: retrieved.chunkIds,
      aiExchangeId: response.exchangeId ?? null,
      model: response.model,
      promptTokens: response.usage?.promptTokens ?? null,
      completionTokens: response.usage?.completionTokens ?? null,
    })

    logger.info('[manuscript-chat] background turn completed', {
      chatId: input.chatId,
      manuscriptId: input.manuscriptId,
      model: response.model,
      ms: Date.now() - start,
      retrievedChunks: retrieved.chunkIds.length,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[manuscript-chat] background turn failed', {
      chatId: input.chatId,
      manuscriptId: input.manuscriptId,
      pendingAssistantId: input.pendingAssistantId,
      ms: Date.now() - start,
      message,
    })
    // Best-effort. If even this update fails the placeholder will stay
    // 'pending' forever — the polling client gives up after the timeout
    // and the writer can resend.
    try {
      await manuscriptChatRepo.errorAssistantMessage(
        input.pendingAssistantId,
        `The model call failed. ${message}`
      )
    } catch (writeErr) {
      logger.error('[manuscript-chat] could not record error on placeholder', {
        pendingAssistantId: input.pendingAssistantId,
        message: writeErr instanceof Error ? writeErr.message : String(writeErr),
      })
    }
  }
}
