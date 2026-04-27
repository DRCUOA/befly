import { Request, Response } from 'express'
import { writingService } from '../services/writing.service.js'
import { writingAssistService } from '../services/writing-assist.service.js'
import { LlmConfigurationError, LlmRequestError } from '../services/llm/llm-client.js'
import { UnauthorizedError, ValidationError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent, getUserId } from '../utils/activity-logger.js'
import { isAdminRequest } from '../middleware/authorize.middleware.js'
import { logger } from '../utils/logger.js'
import type {
  WritingAssistMode,
  WritingAssistRequest,
} from '@shared/WritingAssist'

const VALID_ASSIST_MODES: readonly WritingAssistMode[] = [
  'coherence', 'define', 'focus', 'expand', 'proofread',
] as const

/**
 * Writing controller - handles HTTP requests/responses
 */
export const writingController = {
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const admin = isAdminRequest(req)
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0
    const writings = await writingService.getAll(userId, limit, offset, admin)
    
    // Log view activity
    await activityService.logView(
      'writing_block',
      null,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { action: 'list', limit, offset }
    )
    
    res.json({ data: writings })
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null // From optionalAuthMiddleware
    const admin = isAdminRequest(req)
    const writing = await writingService.getById(id, userId, admin)
    
    // Log view activity
    await activityService.logWriting(
      'view',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { title: writing.title }
    )
    
    res.json({ data: writing })
  },

  async create(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const writing = await writingService.create({
      userId,
      title: req.body.title,
      body: req.body.body,
      themeIds: req.body.themeIds || [],
      visibility: req.body.visibility || 'private',
      coverImageUrl: req.body.coverImageUrl,
      coverImagePosition: req.body.coverImagePosition
    })
    
    // Log create activity
    await activityService.logWriting(
      'create',
      writing.id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { title: writing.title, visibility: writing.visibility }
    )
    
    res.status(201).json({ data: writing })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    const admin = isAdminRequest(req)
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const writing = await writingService.update(id, userId, {
      title: req.body.title,
      body: req.body.body,
      themeIds: req.body.themeIds,
      visibility: req.body.visibility,
      coverImageUrl: req.body.coverImageUrl,
      coverImagePosition: req.body.coverImagePosition
    }, admin)
    
    // Log update activity
    await activityService.logWriting(
      'update',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { title: writing.title, visibility: writing.visibility }
    )
    
    res.json({ data: writing })
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    const admin = isAdminRequest(req)
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    // Get writing details before deletion for logging
    const writing = await writingService.getById(id, userId, admin)

    await writingService.delete(id, userId, admin)

    // Log delete activity
    await activityService.logWriting(
      'delete',
      id,
      userId,
      getClientIp(req),
      getUserAgent(req),
      { title: writing.title }
    )

    res.status(204).send()
  },

  /**
   * POST /api/writing/:id/assist
   *
   * Body: { mode, args }
   *   - mode: 'coherence' | 'define' | 'focus' | 'expand' | 'proofread'
   *   - args: per-mode shape (see shared/WritingAssist.ts)
   *
   * Returns the AI body + an optional drop-in replacement string.
   * The endpoint requires authentication and the same read-access policy
   * as GET /:id (via writingService.getById inside the assist service).
   *
   * If OPENAI_API_KEY isn't set, returns 503 with a clean message rather
   * than a 500 stack trace, matching the manuscript-assist convention.
   */
  async runAssist(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)

    // Debug: snapshot what arrived. Useful for diagnosing 'empty payload'
    // confusions where a wrong URL or CSRF block masks the real request.
    logger.debug('[writing-assist] controller hit', {
      writingId: id,
      userId,
      admin,
      bodyKeys: Object.keys(req.body || {}),
      mode: req.body?.mode,
      hasArgs: !!req.body?.args,
      argKeys: req.body?.args && typeof req.body.args === 'object' ? Object.keys(req.body.args) : [],
    })

    const mode = String(req.body?.mode ?? '') as WritingAssistMode
    if (!VALID_ASSIST_MODES.includes(mode)) {
      logger.warn('[writing-assist] unsupported mode', { mode, writingId: id })
      throw new ValidationError(
        `Unsupported writing-assist mode: "${mode}". Supported: ${VALID_ASSIST_MODES.join(', ')}`
      )
    }

    const argsRaw = req.body?.args
    if (!argsRaw || typeof argsRaw !== 'object') {
      logger.warn('[writing-assist] missing args object', { writingId: id, mode })
      throw new ValidationError('args object is required')
    }

    // Build the typed request. Shape validation happens inside the service
    // (which already returns ValidationError with clear messages); we only
    // assemble the discriminated union here so TypeScript stays happy.
    const request = { mode, args: argsRaw } as WritingAssistRequest

    const startedAt = Date.now()
    try {
      const result = await writingAssistService.run(
        { writingId: id, request },
        userId,
        admin
      )
      logger.info('[writing-assist] request ok', {
        writingId: id,
        userId,
        mode,
        model: result.model,
        ms: Date.now() - startedAt,
        bodyChars: result.body?.length ?? 0,
        hasReplacement: !!result.replacement,
      })
      // Activity log — we deliberately don't log args (could contain
      // selection text the writer hasn't published yet); only mode + model.
      await activityService.logWriting(
        'view', // closest existing action; no 'assist' action defined yet
        id,
        userId,
        getClientIp(req),
        getUserAgent(req),
        { assistMode: mode, model: result.model }
      )
      res.json({ data: result })
    } catch (err) {
      if (err instanceof LlmConfigurationError) {
        logger.warn('[writing-assist] LLM not configured', {
          writingId: id,
          mode,
          message: err.message,
        })
        // Match the manuscript-assist convention.
        res.status(503).json({ error: err.message })
        return
      }
      if (err instanceof LlmRequestError) {
        // The upstream LLM provider returned a non-2xx (bad key, rate
        // limit, model unavailable, etc.) or the request never landed.
        // Surface as 502 Bad Gateway with the actual upstream message
        // so the writer sees something useful instead of a generic 500.
        logger.error('[writing-assist] LLM request failed', {
          writingId: id,
          mode,
          ms: Date.now() - startedAt,
          status: err.statusCode,
          message: err.message,
        })
        res.status(502).json({
          error: `AI provider error: ${err.message}`,
        })
        return
      }
      logger.error('[writing-assist] request failed', {
        writingId: id,
        userId,
        mode,
        ms: Date.now() - startedAt,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
      })
      throw err
    }
  }
}
