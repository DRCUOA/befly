/**
 * Manuscript chat API client.
 *
 * Mirrors the server's manuscript_chat routes one-for-one. Returns the
 * inner `data` payloads (not the {data} envelope) so call sites stay
 * tidy, matching the rest of the client/api/* style.
 */
import { api } from './client'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
  ManuscriptChat,
  ManuscriptChatWithMessages,
  ChatChunkCitation,
  ManuscriptChatMessage,
} from '@shared/ManuscriptChat'

/** Server's response when sending a turn — both rows + provenance. */
export interface SendMessageResponse {
  chat: ManuscriptChat
  userMessage: ManuscriptChatMessage
  assistantMessage: ManuscriptChatMessage
  citations: ChatChunkCitation[]
}

export interface ChatModelsResponse {
  models: { id: string; label: string }[]
  default: string
}

export const manuscriptChatApi = {
  listModels(): Promise<ChatModelsResponse> {
    return api
      .get<ApiResponse<ChatModelsResponse>>('/manuscripts/chats/models')
      .then(r => r.data)
  },

  list(manuscriptId: string): Promise<ManuscriptChat[]> {
    return api
      .get<ApiResponse<ManuscriptChat[]>>(`/manuscripts/${manuscriptId}/chats`)
      .then(r => r.data)
  },

  create(manuscriptId: string, opts: { title?: string; model?: string } = {}): Promise<ManuscriptChat> {
    return api
      .post<ApiResponse<ManuscriptChat>>(`/manuscripts/${manuscriptId}/chats`, opts)
      .then(r => r.data)
  },

  get(manuscriptId: string, chatId: string): Promise<ManuscriptChatWithMessages> {
    // cache: 'no-store' is defence in depth on top of the server's
    // Cache-Control: no-store header. The poll path needs the freshest
    // possible row to detect when a pending placeholder has been
    // finalised by the background worker.
    return api
      .get<ApiResponse<ManuscriptChatWithMessages>>(
        `/manuscripts/${manuscriptId}/chats/${chatId}`,
        { cache: 'no-store' }
      )
      .then(r => r.data)
  },

  sendMessage(manuscriptId: string, chatId: string, content: string): Promise<SendMessageResponse> {
    return api
      .post<ApiResponse<SendMessageResponse>>(
        `/manuscripts/${manuscriptId}/chats/${chatId}/messages`,
        { content }
      )
      .then(r => r.data)
  },

  rename(manuscriptId: string, chatId: string, title: string): Promise<ManuscriptChat> {
    return api
      .put<ApiResponse<ManuscriptChat>>(`/manuscripts/${manuscriptId}/chats/${chatId}`, { title })
      .then(r => r.data)
  },

  setModel(manuscriptId: string, chatId: string, model: string): Promise<ManuscriptChat> {
    return api
      .put<ApiResponse<ManuscriptChat>>(`/manuscripts/${manuscriptId}/chats/${chatId}`, { model })
      .then(r => r.data)
  },

  archive(manuscriptId: string, chatId: string, archived = true): Promise<ManuscriptChat> {
    return api
      .put<ApiResponse<ManuscriptChat>>(`/manuscripts/${manuscriptId}/chats/${chatId}`, { archived })
      .then(r => r.data)
  },

  delete(manuscriptId: string, chatId: string): Promise<{ deleted: string }> {
    return api
      .delete<ApiResponse<{ deleted: string }>>(`/manuscripts/${manuscriptId}/chats/${chatId}`)
      .then(r => r.data)
  },
}
