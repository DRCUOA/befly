/**
 * Manuscript chat repository — DAO for manuscript_chats and
 * manuscript_chat_messages.
 *
 * Access is gated at the service layer (which already owns the
 * manuscript visibility/ownership rules), so the repo only checks
 * ownership where doing it inline is cheaper than a round-trip up to
 * the service. The list/get methods take a userId for that purpose.
 */
import { pool } from '../config/db.js'
import {
  ManuscriptChat,
  ManuscriptChatMessage,
  ChatMessageRole,
} from '../models/ManuscriptChat.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'

const CHAT_COLUMNS = `
  id,
  manuscript_id  AS "manuscriptId",
  user_id        AS "userId",
  title,
  model,
  archived,
  created_at     AS "createdAt",
  updated_at     AS "updatedAt"
`

const MESSAGE_COLUMNS = `
  id,
  chat_id              AS "chatId",
  role,
  content,
  status,
  retrieved_chunk_ids  AS "retrievedChunkIds",
  ai_exchange_id       AS "aiExchangeId",
  model,
  prompt_tokens        AS "promptTokens",
  completion_tokens    AS "completionTokens",
  created_at           AS "createdAt"
`

export const manuscriptChatRepo = {
  async listForManuscript(
    manuscriptId: string,
    userId: string,
    opts: { includeArchived?: boolean } = {}
  ): Promise<ManuscriptChat[]> {
    const where: string[] = ['manuscript_id = $1', 'user_id = $2']
    const params: unknown[] = [manuscriptId, userId]
    if (!opts.includeArchived) where.push('archived = FALSE')
    const r = await pool.query(
      `SELECT ${CHAT_COLUMNS}
         FROM manuscript_chats
        WHERE ${where.join(' AND ')}
        ORDER BY updated_at DESC`,
      params
    )
    return r.rows
  },

  async findById(chatId: string, userId: string): Promise<ManuscriptChat> {
    const r = await pool.query(
      `SELECT ${CHAT_COLUMNS} FROM manuscript_chats WHERE id = $1`,
      [chatId]
    )
    if (r.rows.length === 0) throw new NotFoundError('Chat not found')
    const row = r.rows[0] as ManuscriptChat
    // Chats are private to their author. The manuscript may be shared,
    // but other users should not see another writer's chat history.
    if (row.userId !== userId) throw new NotFoundError('Chat not found')
    return row
  },

  async create(input: {
    manuscriptId: string
    userId: string
    title: string
    model: string
  }): Promise<ManuscriptChat> {
    const r = await pool.query(
      `INSERT INTO manuscript_chats (manuscript_id, user_id, title, model)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CHAT_COLUMNS}`,
      [input.manuscriptId, input.userId, input.title, input.model]
    )
    return r.rows[0]
  },

  async update(
    chatId: string,
    userId: string,
    updates: Partial<{ title: string; model: string; archived: boolean }>
  ): Promise<ManuscriptChat> {
    // Verify ownership before issuing the UPDATE.
    await this.findById(chatId, userId)
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1
    if (updates.title !== undefined)    { fields.push(`title = $${i++}`);    values.push(updates.title) }
    if (updates.model !== undefined)    { fields.push(`model = $${i++}`);    values.push(updates.model) }
    if (updates.archived !== undefined) { fields.push(`archived = $${i++}`); values.push(updates.archived) }
    if (fields.length === 0) return this.findById(chatId, userId)
    fields.push(`updated_at = NOW()`)
    values.push(chatId)
    const r = await pool.query(
      `UPDATE manuscript_chats SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${CHAT_COLUMNS}`,
      values
    )
    return r.rows[0]
  },

  async delete(chatId: string, userId: string): Promise<void> {
    const owner = await pool.query(
      `SELECT user_id FROM manuscript_chats WHERE id = $1`,
      [chatId]
    )
    if (owner.rows.length === 0) throw new NotFoundError('Chat not found')
    if (owner.rows[0].user_id !== userId) throw new ForbiddenError('Not authorized')
    await pool.query(`DELETE FROM manuscript_chats WHERE id = $1`, [chatId])
  },

  /** Touch updated_at — called when a new message is appended. */
  async touch(chatId: string): Promise<void> {
    await pool.query(`UPDATE manuscript_chats SET updated_at = NOW() WHERE id = $1`, [chatId])
  },

  /* ============================================================
   *  Messages
   * ============================================================ */

  async listMessages(chatId: string): Promise<ManuscriptChatMessage[]> {
    const r = await pool.query(
      `SELECT ${MESSAGE_COLUMNS}
         FROM manuscript_chat_messages
        WHERE chat_id = $1
        ORDER BY created_at ASC, id ASC`,
      [chatId]
    )
    return r.rows
  },

  async appendMessage(input: {
    chatId: string
    role: ChatMessageRole
    content: string
    retrievedChunkIds?: string[]
    aiExchangeId?: string | null
    model?: string | null
    promptTokens?: number | null
    completionTokens?: number | null
  }): Promise<ManuscriptChatMessage> {
    const r = await pool.query(
      `INSERT INTO manuscript_chat_messages (
         chat_id, role, content, status,
         retrieved_chunk_ids, ai_exchange_id, model,
         prompt_tokens, completion_tokens
       ) VALUES ($1, $2, $3, 'complete', $4::uuid[], $5, $6, $7, $8)
       RETURNING ${MESSAGE_COLUMNS}`,
      [
        input.chatId,
        input.role,
        input.content,
        input.retrievedChunkIds ?? [],
        input.aiExchangeId ?? null,
        input.model ?? null,
        input.promptTokens ?? null,
        input.completionTokens ?? null,
      ]
    )
    await this.touch(input.chatId)
    return r.rows[0]
  },

  /**
   * Insert a placeholder assistant message in the 'pending' state. The
   * background LLM worker later calls finalizeAssistantMessage() or
   * errorAssistantMessage() to flip it to a terminal state. Empty content
   * + pending status is what the polling client uses as the spinner cue.
   */
  async appendPendingAssistant(chatId: string, model: string): Promise<ManuscriptChatMessage> {
    const r = await pool.query(
      `INSERT INTO manuscript_chat_messages (
         chat_id, role, content, status, model
       ) VALUES ($1, 'assistant', '', 'pending', $2)
       RETURNING ${MESSAGE_COLUMNS}`,
      [chatId, model]
    )
    await this.touch(chatId)
    return r.rows[0]
  },

  async finalizeAssistantMessage(input: {
    id: string
    content: string
    retrievedChunkIds: string[]
    aiExchangeId: string | null
    model: string
    promptTokens: number | null
    completionTokens: number | null
  }): Promise<ManuscriptChatMessage> {
    const r = await pool.query(
      `UPDATE manuscript_chat_messages
          SET content             = $2,
              status              = 'complete',
              retrieved_chunk_ids = $3::uuid[],
              ai_exchange_id      = $4,
              model               = $5,
              prompt_tokens       = $6,
              completion_tokens   = $7
        WHERE id = $1
        RETURNING ${MESSAGE_COLUMNS}`,
      [
        input.id,
        input.content,
        input.retrievedChunkIds,
        input.aiExchangeId,
        input.model,
        input.promptTokens,
        input.completionTokens,
      ]
    )
    if (r.rows.length > 0) {
      await this.touch(r.rows[0].chatId)
    }
    return r.rows[0]
  },

  async errorAssistantMessage(id: string, errorContent: string): Promise<ManuscriptChatMessage | null> {
    const r = await pool.query(
      `UPDATE manuscript_chat_messages
          SET content = $2,
              status  = 'error'
        WHERE id = $1
        RETURNING ${MESSAGE_COLUMNS}`,
      [id, errorContent]
    )
    if (r.rows.length === 0) return null
    await this.touch(r.rows[0].chatId)
    return r.rows[0]
  },
}
