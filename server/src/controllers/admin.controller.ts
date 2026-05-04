import { Request, Response } from 'express'
import { pool } from '../config/db.js'
import { userRepo } from '../repositories/user.repo.js'
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'
import {
  buildEssayExport,
  envelopeToJson,
  buildEssayTemplate,
  ExportScope,
} from '../services/essay-export.service.js'
import { runEssayImport } from '../services/essay-import.service.js'
import { EssayImportOptions } from '../models/EssayExport.js'
import { aiExchangeRepo } from '../repositories/ai-exchange.repo.js'
import type { AiExchangeListFilter, AiExchangeStatus } from '../models/AiExchange.js'

/**
 * Admin controller - handles admin-only operations
 * All routes using this controller must be protected by authMiddleware + requireAdmin
 */
export const adminController = {
  /**
   * List all users with pagination
   */
  async listUsers(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0

    const [users, total] = await Promise.all([
      userRepo.findAll(limit, offset),
      userRepo.count()
    ])

    res.json({
      data: users,
      meta: { total, limit, offset }
    })
  },

  /**
   * Get a single user by ID
   */
  async getUser(req: Request, res: Response) {
    const { id } = req.params
    const user = await userRepo.findById(id)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    res.json({ data: user })
  },

  /**
   * Get all content for a specific user (writings, comments, appreciations)
   * Admin-only endpoint for full visibility into user's data
   */
  async getUserContent(req: Request, res: Response) {
    const { id } = req.params

    // Fetch all four in parallel
    const [writings, comments, appreciations, essayEngagement] = await Promise.all([
      pool.query(
        `SELECT 
          wb.id, 
          wb.user_id as "userId", 
          wb.title, 
          SUBSTRING(wb.body, 1, 200) as "bodyPreview",
          LENGTH(wb.body) as "bodyLength",
          COALESCE(wb.visibility, 'private') as visibility,
          wb.cover_image_url as "coverImageUrl",
          COALESCE(wb.cover_image_position, '50% 50%') as "coverImagePosition",
          wb.created_at as "createdAt", 
          wb.updated_at as "updatedAt"
        FROM writing_blocks wb
        WHERE wb.user_id = $1
        ORDER BY wb.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT 
          c.id,
          c.writing_id as "writingId",
          c.user_id as "userId",
          SUBSTRING(c.content, 1, 200) as "contentPreview",
          c.content,
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          wb.title as "writingTitle"
        FROM comments c
        LEFT JOIN writing_blocks wb ON c.writing_id = wb.id
        WHERE c.user_id = $1
        ORDER BY c.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT 
          a.id,
          a.writing_id as "writingId",
          a.user_id as "userId",
          COALESCE(a.reaction_type, 'like') as "reactionType",
          a.created_at as "createdAt",
          wb.title as "writingTitle"
        FROM appreciations a
        LEFT JOIN writing_blocks wb ON a.writing_id = wb.id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT
          wb.id as "writingId",
          COALESCE(v.view_count, 0)::int as "viewCount",
          COALESCE(v.unique_viewers, 0)::int as "uniqueViewers",
          v.last_viewed_at as "lastViewedAt",
          v.first_viewed_at as "firstViewedAt",
          COALESCE(cc.comment_count, 0)::int as "commentCount",
          COALESCE(ac.appreciation_count, 0)::int as "appreciationCount",
          COALESCE(ac.reaction_types, '{}') as "reactionTypes"
        FROM writing_blocks wb
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) as view_count,
            COUNT(DISTINCT ual.user_id) as unique_viewers,
            MAX(ual.created_at) as last_viewed_at,
            MIN(ual.created_at) as first_viewed_at
          FROM user_activity_logs ual
          WHERE ual.resource_type = 'writing_block'
            AND ual.resource_id = wb.id
            AND ual.action = 'view'
        ) v ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) as comment_count
          FROM comments c
          WHERE c.writing_id = wb.id
        ) cc ON true
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) as appreciation_count,
            jsonb_object_agg(
              COALESCE(sub.reaction_type, 'like'),
              sub.cnt
            ) as reaction_types
          FROM (
            SELECT COALESCE(a.reaction_type, 'like') as reaction_type, COUNT(*) as cnt
            FROM appreciations a
            WHERE a.writing_id = wb.id
            GROUP BY COALESCE(a.reaction_type, 'like')
          ) sub
        ) ac ON true
        WHERE wb.user_id = $1`,
        [id]
      )
    ])

    // Build engagement map keyed by writingId
    const engagementMap: Record<string, any> = {}
    for (const row of essayEngagement.rows) {
      engagementMap[row.writingId] = {
        viewCount: row.viewCount,
        uniqueViewers: row.uniqueViewers,
        lastViewedAt: row.lastViewedAt,
        firstViewedAt: row.firstViewedAt,
        commentCount: row.commentCount,
        appreciationCount: row.appreciationCount,
        reactionTypes: row.reactionTypes
      }
    }

    // Merge engagement into each writing row
    const writingsWithEngagement = writings.rows.map((w: any) => ({
      ...w,
      engagement: engagementMap[w.id] || {
        viewCount: 0,
        uniqueViewers: 0,
        lastViewedAt: null,
        firstViewedAt: null,
        commentCount: 0,
        appreciationCount: 0,
        reactionTypes: {}
      }
    }))

    res.json({
      data: {
        writings: writingsWithEngagement,
        comments: comments.rows,
        appreciations: appreciations.rows
      }
    })
  },

  /**
   * Update a user's role or status (admin-only)
   */
  async updateUser(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId
    const { role, status, displayName, latitude, longitude } = req.body

    // Prevent admin from demoting themselves
    if (id === adminUserId && role && role !== 'admin') {
      throw new ForbiddenError('Cannot change your own admin role')
    }

    // Prevent admin from deactivating themselves
    if (id === adminUserId && status && status !== 'active') {
      throw new ForbiddenError('Cannot deactivate your own account')
    }

    // Validate role if provided
    if (role !== undefined && !['user', 'admin'].includes(role)) {
      throw new ValidationError('Role must be "user" or "admin"')
    }

    // Validate status if provided
    if (status !== undefined && !['active', 'inactive', 'suspended'].includes(status)) {
      throw new ValidationError('Status must be "active", "inactive", or "suspended"')
    }

    if (latitude !== undefined && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
      throw new ValidationError('Latitude must be a number between -90 and 90')
    }
    if (longitude !== undefined && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
      throw new ValidationError('Longitude must be a number between -180 and 180')
    }

    const updates: Record<string, any> = {}
    if (role !== undefined) updates.role = role
    if (status !== undefined) updates.status = status
    if (displayName !== undefined) updates.displayName = displayName
    if (latitude !== undefined) updates.latitude = latitude
    if (longitude !== undefined) updates.longitude = longitude

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No updates provided')
    }

    const updatedUser = await userRepo.update(id, updates)

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'user',
      resourceId: id,
      action: 'update_user',
      details: { updates, targetUserId: id },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.json({ data: updatedUser })
  },

  /**
   * Delete a user (admin-only)
   * Cannot delete yourself
   */
  async deleteUser(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId

    // Prevent admin from deleting themselves
    if (id === adminUserId) {
      throw new ForbiddenError('Cannot delete your own account')
    }

    // Get user details before deletion for logging
    const user = await userRepo.findById(id)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    await userRepo.delete(id)

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'user',
      resourceId: id,
      action: 'delete_user',
      details: { email: user.email, displayName: user.displayName },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(204).send()
  },

  // ─── Content management (admin CRUD on any content) ──────────────

  /**
   * GET /api/admin/writings
   *
   * Admin-scoped list of every essay across every user. Optional filters:
   *   q          — case-insensitive substring match against title or body
   *   userId     — restrict to one author
   *   visibility — 'private' | 'shared' | 'public'
   *   sort       — 'created_at' (default) | 'updated_at' | 'title' | 'author'
   *   order      — 'asc' | 'desc' (default)
   *   limit      — 1..200 (default 50)
   *   offset     — default 0
   *
   * Joins author display name and counts (themes, comments, appreciations,
   * views) so the admin table is one round-trip. Body is truncated to a
   * preview field; pulling full bodies for hundreds of rows would blow up
   * the response size with no benefit (the table doesn't render them).
   */
  async listWritings(req: Request, res: Response) {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 50, 200))
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0)

    const conditions: string[] = []
    const params: unknown[] = []

    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const q = `%${req.query.q.trim()}%`
      params.push(q)
      const idx = params.length
      // ILIKE matches title OR body. Body LIKE on a long-text column is not
      // indexed, but at admin scale this is fine — and it's more useful than
      // title-only search when the writer remembers a phrase, not a title.
      conditions.push(`(wb.title ILIKE $${idx} OR wb.body ILIKE $${idx})`)
    }
    if (typeof req.query.userId === 'string' && req.query.userId.trim()) {
      params.push(req.query.userId.trim())
      conditions.push(`wb.user_id = $${params.length}`)
    }
    if (typeof req.query.visibility === 'string' && ['private','shared','public'].includes(req.query.visibility)) {
      params.push(req.query.visibility)
      conditions.push(`COALESCE(wb.visibility, 'private') = $${params.length}`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const SORT_COLUMNS: Record<string, string> = {
      created_at: 'wb.created_at',
      updated_at: 'wb.updated_at',
      title:      'wb.title',
      author:     'author_display_name',
    }
    const sortKey = typeof req.query.sort === 'string' && SORT_COLUMNS[req.query.sort]
      ? req.query.sort
      : 'created_at'
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC'
    const orderClause = `ORDER BY ${SORT_COLUMNS[sortKey]} ${order} NULLS LAST`

    // Total count for pagination — built without LIMIT/OFFSET, same WHERE.
    const countParams = [...params]
    const countSql = `SELECT COUNT(*)::int AS count FROM writing_blocks wb ${where}`

    // Push limit/offset for the data query.
    params.push(limit)
    const limitIdx = params.length
    params.push(offset)
    const offsetIdx = params.length

    const dataSql = `
      SELECT
        wb.id,
        wb.user_id                         AS "userId",
        COALESCE(u.display_name, u.email)  AS "authorDisplayName",
        u.email                            AS "authorEmail",
        wb.title,
        SUBSTRING(wb.body, 1, 280)         AS "bodyPreview",
        LENGTH(wb.body)                    AS "bodyLength",
        COALESCE(wb.visibility, 'private') AS visibility,
        wb.cover_image_url                 AS "coverImageUrl",
        COALESCE(wb.cover_image_position, '50% 50%') AS "coverImagePosition",
        wb.created_at                      AS "createdAt",
        wb.updated_at                      AS "updatedAt",
        COALESCE(u.display_name, u.email)  AS author_display_name,
        (SELECT COUNT(*)::int FROM writing_themes wt WHERE wt.writing_id = wb.id)  AS "themeCount",
        (SELECT COUNT(*)::int FROM comments c WHERE c.writing_id = wb.id)          AS "commentCount",
        (SELECT COUNT(*)::int FROM appreciations a WHERE a.writing_id = wb.id)     AS "appreciationCount",
        (SELECT COUNT(*)::int FROM user_activity_logs ual
           WHERE ual.resource_type = 'writing_block'
             AND ual.resource_id = wb.id
             AND ual.action = 'view')                                              AS "viewCount"
      FROM writing_blocks wb
      LEFT JOIN users u ON u.id = wb.user_id
      ${where}
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `

    const [data, total] = await Promise.all([
      pool.query(dataSql, params),
      pool.query(countSql, countParams),
    ])

    // Strip the helper sort alias from the row payload.
    const rows = data.rows.map((r: any) => {
      const { author_display_name, ...rest } = r
      return rest
    })

    res.json({
      data: rows,
      meta: {
        total: total.rows[0].count as number,
        limit,
        offset,
        filter: {
          q: req.query.q ?? null,
          userId: req.query.userId ?? null,
          visibility: req.query.visibility ?? null,
          sort: sortKey,
          order: order.toLowerCase(),
        },
      },
    })
  },

  /**
   * Update a writing's visibility (admin-only)
   */
  async updateWritingVisibility(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId
    const { visibility } = req.body

    if (!visibility || !['private', 'shared', 'public'].includes(visibility)) {
      throw new ValidationError('Visibility must be "private", "shared", or "public"')
    }

    // Verify writing exists
    const existing = await pool.query(
      'SELECT id, title, user_id, visibility FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing not found')
    }

    await pool.query(
      'UPDATE writing_blocks SET visibility = $1, updated_at = NOW() WHERE id = $2',
      [visibility, id]
    )

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'writing_block',
      resourceId: id,
      action: 'update_visibility',
      details: {
        title: existing.rows[0].title,
        oldVisibility: existing.rows[0].visibility,
        newVisibility: visibility,
        ownerId: existing.rows[0].user_id
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.json({ data: { id, visibility } })
  },

  /**
   * Set cover image path and position for a writing (admin-only)
   * Body: { coverImageUrl: string, coverImagePosition?: string } - position e.g. "50% 50%"
   */
  async updateWritingCoverImage(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId
    const { coverImageUrl, coverImagePosition } = req.body

    if (typeof coverImageUrl !== 'string') {
      throw new ValidationError('coverImageUrl must be a string')
    }

    const trimmed = coverImageUrl.trim()
    if (trimmed) {
      if (!trimmed.startsWith('/uploads/')) {
        throw new ValidationError('Cover image must be an uploaded file path (e.g. /uploads/cover/xxx.jpg)')
      }
      if (trimmed.includes('..')) {
        throw new ValidationError('Invalid cover image path')
      }
    }

    const pos = typeof coverImagePosition === 'string' && coverImagePosition.trim()
      ? coverImagePosition.trim()
      : '50% 50%'

    const existing = await pool.query(
      'SELECT id, title, user_id FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing not found')
    }

    await pool.query(
      'UPDATE writing_blocks SET cover_image_url = $1, cover_image_position = $2, updated_at = NOW() WHERE id = $3',
      [trimmed || null, pos, id]
    )

    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'writing_block',
      resourceId: id,
      action: 'update_cover_image',
      details: {
        title: existing.rows[0].title,
        coverImageUrl: trimmed || null,
        coverImagePosition: pos
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.json({ data: { id, coverImageUrl: trimmed || null, coverImagePosition: pos } })
  },

  /**
   * Delete a writing (admin-only, any user's writing)
   */
  async deleteWriting(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId

    // Get details before deletion
    const existing = await pool.query(
      'SELECT id, title, user_id FROM writing_blocks WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Writing not found')
    }

    await pool.query('DELETE FROM writing_blocks WHERE id = $1', [id])

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'writing_block',
      resourceId: id,
      action: 'delete_writing',
      details: {
        title: existing.rows[0].title,
        ownerId: existing.rows[0].user_id
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(204).send()
  },

  /**
   * Delete a comment (admin-only, any user's comment)
   */
  async deleteComment(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId

    // Get details before deletion
    const existing = await pool.query(
      `SELECT c.id, c.content, c.user_id, c.writing_id, wb.title as writing_title
       FROM comments c
       LEFT JOIN writing_blocks wb ON c.writing_id = wb.id
       WHERE c.id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Comment not found')
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [id])

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'comment',
      resourceId: id,
      action: 'delete_comment',
      details: {
        ownerId: existing.rows[0].user_id,
        writingId: existing.rows[0].writing_id,
        writingTitle: existing.rows[0].writing_title
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(204).send()
  },

  /**
   * Delete an appreciation (admin-only, any user's appreciation)
   */
  async deleteAppreciation(req: Request, res: Response) {
    const { id } = req.params
    const adminUserId = (req as any).userId

    // Get details before deletion
    const existing = await pool.query(
      `SELECT a.id, a.user_id, a.writing_id, COALESCE(a.reaction_type, 'like') as reaction_type, wb.title as writing_title
       FROM appreciations a
       LEFT JOIN writing_blocks wb ON a.writing_id = wb.id
       WHERE a.id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      throw new NotFoundError('Appreciation not found')
    }

    await pool.query('DELETE FROM appreciations WHERE id = $1', [id])

    // Log admin action
    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'appreciation',
      resourceId: id,
      action: 'delete_appreciation',
      details: {
        ownerId: existing.rows[0].user_id,
        writingId: existing.rows[0].writing_id,
        writingTitle: existing.rows[0].writing_title,
        reactionType: existing.rows[0].reaction_type
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    res.status(204).send()
  },

  // ─── Essay import / export (admin-only) ──────────────────────────

  /**
   * GET /api/admin/essays/export?userId=...&ids=uuid1,uuid2,...
   *
   * Returns a JSON file containing the matching essays plus the themes they
   * reference. With no query params, exports every essay from every user -
   * use carefully on large datasets.
   */
  async exportEssays(req: Request, res: Response) {
    const adminUserId = (req as any).userId
    const scope: ExportScope = {}
    if (typeof req.query.userId === 'string' && req.query.userId.trim()) {
      scope.userId = req.query.userId.trim()
    }
    if (typeof req.query.ids === 'string' && req.query.ids.trim()) {
      scope.writingIds = req.query.ids.split(',').map(s => s.trim()).filter(Boolean)
    }

    const envelope = await buildEssayExport(scope)
    const json = envelopeToJson(envelope)

    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'writing_block',
      resourceId: null,
      action: 'export_essays',
      details: {
        scope,
        essays: envelope.essays.length,
        themes: envelope.themes.length,
        bytes: Buffer.byteLength(json, 'utf8'),
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const suffix = scope.userId
      ? (scope.writingIds ? 'subset' : `user-${scope.userId.slice(0, 8)}`)
      : (scope.writingIds ? 'subset' : 'all')
    const filename = `essays-export-${suffix}-${stamp}.json`

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(json)
  },

  /**
   * GET /api/admin/essays/template
   * Returns a downloadable template envelope showing the import format with
   * example data and inline _documentation.
   */
  async exportEssaysTemplate(_req: Request, res: Response) {
    const template = buildEssayTemplate()
    const json = JSON.stringify(template, null, 2) + '\n'
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="essays-import-template.json"`)
    res.send(json)
  },

  /**
   * POST /api/admin/essays/import
   *
   * Body: {
   *   envelope: EssayExportEnvelope,
   *   options: { ownership: 'self' | 'target', targetUserId?, onlyEssayIds? }
   * }
   *
   * Returns a per-essay result so the UI can show a partial-success report.
   */
  async importEssays(req: Request, res: Response) {
    const adminUserId = (req as any).userId
    const body = req.body || {}
    const envelope = body.envelope
    const options: EssayImportOptions = body.options || { ownership: 'self' }
    if (!envelope) throw new ValidationError('Request body must contain an "envelope" field')

    const result = await runEssayImport(envelope, adminUserId, options)

    await activityService.logActivity({
      userId: adminUserId,
      activityType: 'admin',
      resourceType: 'writing_block',
      resourceId: null,
      action: 'import_essays',
      details: {
        ownership: options.ownership,
        targetUserId: options.targetUserId ?? null,
        total: result.total,
        created: result.created.length,
        themesCreated: result.themes.filter(t => t.created).length,
        errors: result.errors.length,
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    })

    res.json({ data: result })
  },

  // ─── Usage analytics ─────────────────────────────────────────────

  /**
   * Get aggregated usage statistics from activity logs
   * Includes both authenticated and anonymous activity
   */
  async getStats(req: Request, res: Response) {
    const queries: Record<string, string> = {
      total: 'SELECT COUNT(*) as count FROM user_activity_logs',

      byType: `SELECT activity_type as "activityType", COUNT(*) as count
        FROM user_activity_logs GROUP BY activity_type ORDER BY count DESC`,

      byAction: `SELECT action, COUNT(*) as count
        FROM user_activity_logs GROUP BY action ORDER BY count DESC`,

      daily: `SELECT created_at::date as date, COUNT(*) as total,
        COUNT(user_id) as authenticated, COUNT(*) - COUNT(user_id) as anonymous
        FROM user_activity_logs WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY created_at::date ORDER BY date ASC`,

      hourly: `SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as count
        FROM user_activity_logs GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY hour ASC`,

      anonVsAuth: `SELECT COUNT(*) as total, COUNT(user_id) as authenticated,
        COUNT(*) - COUNT(user_id) as anonymous, COUNT(DISTINCT user_id) as "uniqueUsers"
        FROM user_activity_logs`,

      topUsers: `SELECT ual.user_id as "userId",
        COALESCE(u.display_name, u.email, 'Unknown') as "displayName", COUNT(*) as count
        FROM user_activity_logs ual LEFT JOIN users u ON ual.user_id = u.id
        WHERE ual.user_id IS NOT NULL
        GROUP BY ual.user_id, u.display_name, u.email ORDER BY count DESC LIMIT 10`,

      topWritings: `SELECT ual.resource_id as "resourceId",
        COALESCE(wb.title, 'Deleted') as title, COUNT(*) as count,
        COUNT(DISTINCT ual.user_id) as "uniqueVisitors"
        FROM user_activity_logs ual LEFT JOIN writing_blocks wb ON ual.resource_id = wb.id
        WHERE ual.resource_type = 'writing_block' AND ual.resource_id IS NOT NULL
        GROUP BY ual.resource_id, wb.title ORDER BY count DESC LIMIT 10`,

      recent: `SELECT ual.id, ual.user_id as "userId",
        COALESCE(u.display_name, u.email) as "userDisplayName",
        ual.activity_type as "activityType", ual.action,
        ual.resource_type as "resourceType", ual.resource_id as "resourceId",
        ual.details, ual.ip_address as "ipAddress", ual.created_at as "createdAt"
        FROM user_activity_logs ual LEFT JOIN users u ON ual.user_id = u.id
        ORDER BY ual.created_at DESC LIMIT 50`
    }

    // Run each query individually so we can log which one fails
    const results: Record<string, any> = {}
    for (const [name, sql] of Object.entries(queries)) {
      try {
        results[name] = await pool.query(sql)
      } catch (err: any) {
        throw err
      }
    }

    const { total: totalResult, byType: byTypeResult, byAction: byActionResult,
      daily: dailyResult, hourly: hourlyResult, anonVsAuth: anonVsAuthResult,
      topUsers: topUsersResult, topWritings: topWritingsResult, recent: recentResult
    } = results

    // Build hourly histogram (fill in missing hours with 0)
    const hourlyMap = new Map<number, number>()
    for (const row of hourlyResult.rows) {
      hourlyMap.set(row.hour, parseInt(row.count, 10))
    }
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyMap.get(i) || 0
    }))

    res.json({
      data: {
        total: parseInt(totalResult.rows[0].count, 10),
        byType: byTypeResult.rows.map((r: any) => ({
          activityType: r.activityType,
          count: parseInt(r.count, 10)
        })),
        byAction: byActionResult.rows.map((r: any) => ({
          action: r.action,
          count: parseInt(r.count, 10)
        })),
        daily: dailyResult.rows.map((r: any) => ({
          date: r.date,
          total: parseInt(r.total, 10),
          authenticated: parseInt(r.authenticated, 10),
          anonymous: parseInt(r.anonymous, 10)
        })),
        hourly,
        anonVsAuth: {
          total: parseInt(anonVsAuthResult.rows[0].total, 10),
          authenticated: parseInt(anonVsAuthResult.rows[0].authenticated, 10),
          anonymous: parseInt(anonVsAuthResult.rows[0].anonymous, 10),
          uniqueUsers: parseInt(anonVsAuthResult.rows[0].uniqueUsers, 10)
        },
        topUsers: topUsersResult.rows.map((r: any) => ({
          userId: r.userId,
          displayName: r.displayName,
          count: parseInt(r.count, 10)
        })),
        topWritings: topWritingsResult.rows.map((r: any) => ({
          resourceId: r.resourceId,
          title: r.title,
          count: parseInt(r.count, 10),
          uniqueVisitors: parseInt(r.uniqueVisitors, 10)
        })),
        recentActivity: recentResult.rows
      }
    })
  },

  // ─── AI exchanges (diagnostic log) ───────────────────────────────
  //
  // Returns the most recent rows from the ai_exchanges table so an admin
  // can see exactly what prompts the app sent and what the LLM returned.
  // This is a temporary diagnostic surface — see migration 019. The full
  // row payload (including system + user prompts and the raw response
  // body) ships in the response on purpose; the page is admin-only and
  // the whole point is inspection.

  async listAiExchanges(req: Request, res: Response) {
    const limit  = Math.max(1, Math.min(parseInt(req.query.limit  as string) || 25, 200))
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0)

    const filter: AiExchangeListFilter = {}
    if (typeof req.query.feature === 'string' && req.query.feature.trim()) {
      filter.feature = req.query.feature.trim()
    }
    if (req.query.status === 'ok' || req.query.status === 'error') {
      filter.status = req.query.status as AiExchangeStatus
    }
    if (typeof req.query.userId === 'string' && req.query.userId.trim()) {
      filter.userId = req.query.userId.trim()
    }
    if (typeof req.query.resourceId === 'string' && req.query.resourceId.trim()) {
      filter.resourceId = req.query.resourceId.trim()
    }

    const [rows, total] = await Promise.all([
      aiExchangeRepo.list(filter, limit, offset),
      aiExchangeRepo.count(filter),
    ])

    res.json({
      data: rows,
      meta: { total, limit, offset, filter },
    })
  }
}
