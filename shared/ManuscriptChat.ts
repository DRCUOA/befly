/**
 * Manuscript-scoped chat — shared TYPES between server and client.
 *
 * IMPORTANT: this file is types-only.
 *
 * The server imports `@shared/...` via a tsconfig path alias that is
 * resolved at compile time but NOT preserved at runtime. The Heroku
 * image copies shared/ as raw TypeScript (no compile step on the
 * shared workspace), so any RUNTIME export here would emit an import
 * the production Node process can't resolve. (Mirror of the warning
 * comment in server/src/models/StoryCraft.ts.)
 *
 * Concrete runtime constants — model allow-list, defaults — live
 * server-side in services/manuscript-chat-models.ts and are surfaced
 * to the client via the GET /chats/models endpoint.
 *
 * One conversation = one row in manuscript_chats, pinned to a manuscript.
 * Each turn = one row in manuscript_chat_messages. Assistant turns
 * carry provenance (which retrieved chunks the model saw, which
 * ai_exchanges row captured the wire-level request) so the UI can render
 * "answer grounded in: ..." links.
 */

export type ChatMessageRole = 'user' | 'assistant'

export interface ManuscriptChat {
  id: string
  manuscriptId: string
  userId: string
  title: string
  model: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface ManuscriptChatMessage {
  id: string
  chatId: string
  role: ChatMessageRole
  content: string
  /** chunk ids the assistant was shown for this turn. Empty for user turns. */
  retrievedChunkIds: string[]
  /** Diagnostic ai_exchanges.id for this turn. NULL for user turns. */
  aiExchangeId: string | null
  /** Model that produced an assistant turn. NULL for user turns. */
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  createdAt: string
}

/** A loaded chat with its message log, ordered oldest-first. */
export interface ManuscriptChatWithMessages {
  chat: ManuscriptChat
  messages: ManuscriptChatMessage[]
}

/** Lightweight provenance row the chat drawer surfaces under each answer. */
export interface ChatChunkCitation {
  chunkId: string
  contextSourceId: string
  title: string
  sourceType: string
  contextRole: string
  excerpt: string
  score: number
}

/**
 * Discriminated string for the chat model id. Concrete list of allowed
 * ids lives server-side; this type keeps the wire contract tight without
 * forcing the client to import a runtime const.
 */
export type ManuscriptChatModelId = string
