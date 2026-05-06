/**
 * Manuscript-scoped chat — shared contract between server and client.
 *
 * One conversation = one row in manuscript_chats, pinned to a manuscript.
 * Each turn = one row in manuscript_chat_messages. The assistant turns
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
 * Curated allow-list of chat models. Free-text would let a typo nuke a
 * conversation; the dropdown locks the writer to known-good options.
 * The default is the same as the rest of the app's assist surfaces.
 */
export const MANUSCRIPT_CHAT_MODELS = [
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini (fast, low cost — default)' },
  { id: 'gpt-4o',      label: 'gpt-4o (mid quality)' },
  { id: 'gpt-5-mini',  label: 'gpt-5-mini (newer reasoning, balanced)' },
  { id: 'gpt-5',       label: 'gpt-5 (newer reasoning, highest quality)' },
] as const

export type ManuscriptChatModelId = typeof MANUSCRIPT_CHAT_MODELS[number]['id']

export const DEFAULT_MANUSCRIPT_CHAT_MODEL: ManuscriptChatModelId = 'gpt-4o-mini'
