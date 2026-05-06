/**
 * Manuscript chat controller.
 *
 * Routes (see manuscript.routes.ts for wiring):
 *   GET    /api/manuscripts/:manuscriptId/chats
 *   POST   /api/manuscripts/:manuscriptId/chats
 *   GET    /api/manuscripts/:manuscriptId/chats/models    -- model allow-list
 *   GET    /api/manuscripts/:manuscriptId/chats/:chatId
 *   POST   /api/manuscripts/:manuscriptId/chats/:chatId/messages
 *   PATCH  /api/manuscripts/:manuscriptId/chats/:chatId
 *   DELETE /api/manuscripts/:manuscriptId/chats/:chatId
 *
 * All routes require authMiddleware. Authorisation against the parent
 * manuscript is enforced inside the service via manuscriptService.get.
 */
import { Request, Response } from 'express'
import { manuscriptChatService } from '../services/manuscript-chat.service.js'
import { ValidationError } from '../utils/errors.js'
import { MANUSCRIPT_CHAT_MODELS, DEFAULT_MANUSCRIPT_CHAT_MODEL } from '../models/ManuscriptChat.js'

function requireUserId(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId
  if (!userId) throw new ValidationError('User not authenticated')
  return userId
}

function isAdminReq(req: Request): boolean {
  return (req as Request & { userRole?: string }).userRole === 'admin'
}

export const manuscriptChatController = {
  /** Returns the curated allow-list so the dropdown stays in sync with the server. */
  async listModels(_req: Request, res: Response) {
    res.json({
      data: {
        models: MANUSCRIPT_CHAT_MODELS,
        default: DEFAULT_MANUSCRIPT_CHAT_MODEL,
      },
    })
  },

  async listChats(req: Request, res: Response) {
    const userId = requireUserId(req)
    const isAdmin = isAdminReq(req)
    const chats = await manuscriptChatService.listChats(req.params.manuscriptId, userId, isAdmin)
    res.json({ data: chats })
  },

  async createChat(req: Request, res: Response) {
    const userId = requireUserId(req)
    const isAdmin = isAdminReq(req)
    const body = (req.body && typeof req.body === 'object') ? req.body : {}
    const chat = await manuscriptChatService.createChat({
      manuscriptId: req.params.manuscriptId,
      userId,
      title: typeof body.title === 'string' ? body.title : undefined,
      model:  typeof body.model === 'string' ? body.model : undefined,
    }, isAdmin)
    res.status(201).json({ data: chat })
  },

  async getChat(req: Request, res: Response) {
    const userId = requireUserId(req)
    const isAdmin = isAdminReq(req)
    const result = await manuscriptChatService.getChat(req.params.chatId, userId, isAdmin)
    res.json({ data: result })
  },

  async sendMessage(req: Request, res: Response) {
    const userId = requireUserId(req)
    const isAdmin = isAdminReq(req)
    const content = typeof req.body?.content === 'string' ? req.body.content : ''
    const result = await manuscriptChatService.sendMessage(
      req.params.chatId, userId, content, isAdmin
    )
    res.json({ data: result })
  },

  async updateChat(req: Request, res: Response) {
    const userId = requireUserId(req)
    const body = (req.body && typeof req.body === 'object') ? req.body : {}
    let chat
    if (typeof body.title === 'string') {
      chat = await manuscriptChatService.renameChat(req.params.chatId, userId, body.title)
    }
    if (typeof body.model === 'string') {
      chat = await manuscriptChatService.setChatModel(req.params.chatId, userId, body.model)
    }
    if (typeof body.archived === 'boolean') {
      chat = await manuscriptChatService.archiveChat(req.params.chatId, userId, body.archived)
    }
    if (!chat) throw new ValidationError('No updatable fields supplied (title, model, archived)')
    res.json({ data: chat })
  },

  async deleteChat(req: Request, res: Response) {
    const userId = requireUserId(req)
    await manuscriptChatService.deleteChat(req.params.chatId, userId)
    res.json({ data: { deleted: req.params.chatId } })
  },
}
