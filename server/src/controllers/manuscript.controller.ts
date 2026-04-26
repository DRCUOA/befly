import { Request, Response } from 'express'
import { manuscriptService } from '../services/manuscript.service.js'
import { manuscriptRepo } from '../repositories/manuscript.repo.js'
import {
  manuscriptToMarkdown,
  suggestFilename,
  MarkdownExportOptions,
} from '../services/manuscript-export.service.js'
import { UnauthorizedError, ValidationError } from '../utils/errors.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'
import { isAdminRequest } from '../middleware/authorize.middleware.js'

/**
 * Coerce a string query parameter to boolean. We accept the values typically
 * sent by HTML forms ('1', 'true', 'on', 'yes') so the export dialog can stay
 * a plain anchor with a query string and not a fetch + blob dance.
 */
function asBool(v: unknown): boolean | undefined {
  if (v === undefined) return undefined
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.toLowerCase()
    if (['1', 'true', 'on', 'yes'].includes(s)) return true
    if (['0', 'false', 'off', 'no'].includes(s)) return false
  }
  return undefined
}

/**
 * Manuscript controller - handles HTTP requests for manuscript projects,
 * sections, and items. Mirrors the structure of theme.controller.ts.
 */
export const manuscriptController = {
  // ---------- projects ----------

  async list(req: Request, res: Response) {
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const manuscripts = await manuscriptService.list(userId, admin)
    await activityService.logView('manuscript', null, userId, getClientIp(req), getUserAgent(req), { action: 'list' })
    res.json({ data: manuscripts })
  },

  async get(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const manuscript = await manuscriptService.get(id, userId, admin)
    await activityService.logManuscript('view', id, userId, getClientIp(req), getUserAgent(req), { title: manuscript.title })
    res.json({ data: manuscript })
  },

  /** GET /api/manuscripts/:id/spine - manuscript + sections + items in one call. */
  async getSpine(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const spine = await manuscriptService.getWithSpine(id, userId, admin)
    res.json({ data: spine })
  },

  async create(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const manuscript = await manuscriptService.create({ userId, ...req.body })
    await activityService.logManuscript('create', manuscript.id, userId, getClientIp(req), getUserAgent(req), {
      title: manuscript.title,
      form: manuscript.form,
    })
    res.status(201).json({ data: manuscript })
  },

  async update(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    const manuscript = await manuscriptService.update(id, userId, req.body, admin)
    await activityService.logManuscript('update', id, userId, getClientIp(req), getUserAgent(req), { title: manuscript.title })
    res.json({ data: manuscript })
  },

  async delete(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    const manuscript = await manuscriptService.get(id, userId, admin)
    await manuscriptService.delete(id, userId, admin)
    await activityService.logManuscript('delete', id, userId, getClientIp(req), getUserAgent(req), { title: manuscript.title })
    res.status(204).send()
  },

  // ---------- sections ----------

  async listSections(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const sections = await manuscriptService.listSections(id, userId, admin)
    res.json({ data: sections })
  },

  async createSection(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    const section = await manuscriptService.createSection(id, userId, req.body, admin)
    await activityService.logManuscript('section_create', id, userId, getClientIp(req), getUserAgent(req), {
      sectionId: section.id,
      title: section.title,
    })
    res.status(201).json({ data: section })
  },

  async updateSection(req: Request, res: Response) {
    const { sectionId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    const section = await manuscriptService.updateSection(sectionId, userId, req.body, admin)
    await activityService.logManuscript('section_update', section.manuscriptId, userId, getClientIp(req), getUserAgent(req), {
      sectionId,
    })
    res.json({ data: section })
  },

  async deleteSection(req: Request, res: Response) {
    const { sectionId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    await manuscriptService.deleteSection(sectionId, userId, admin)
    await activityService.logManuscript('section_delete', sectionId, userId, getClientIp(req), getUserAgent(req))
    res.status(204).send()
  },

  // ---------- items ----------

  async listItems(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const items = await manuscriptService.listItems(id, userId, admin)
    res.json({ data: items })
  },

  async createItem(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    const item = await manuscriptService.createItem(id, userId, req.body, admin)
    await activityService.logManuscript('item_create', id, userId, getClientIp(req), getUserAgent(req), {
      itemId: item.id,
      title: item.title,
      itemType: item.itemType,
    })
    res.status(201).json({ data: item })
  },

  async updateItem(req: Request, res: Response) {
    const { itemId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    const item = await manuscriptService.updateItem(itemId, userId, req.body, admin)
    await activityService.logManuscript('item_update', item.manuscriptId, userId, getClientIp(req), getUserAgent(req), { itemId })
    res.json({ data: item })
  },

  async deleteItem(req: Request, res: Response) {
    const { itemId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    await manuscriptService.deleteItem(itemId, userId, admin)
    await activityService.logManuscript('item_delete', itemId, userId, getClientIp(req), getUserAgent(req))
    res.status(204).send()
  },

  /**
   * GET /api/manuscripts/:id/export?format=markdown&toc=1&placeholders=0&aiNotes=1...
   * Returns the manuscript as a downloadable file. Markdown only for now;
   * format param is forward-looking so we can add docx/pdf without changing the URL shape.
   */
  async exportFile(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)

    const format = String(req.query.format ?? 'markdown').toLowerCase()
    if (format !== 'markdown' && format !== 'md') {
      throw new ValidationError(`Unsupported export format: ${format}. Supported: markdown`)
    }

    const manuscript = await manuscriptService.get(id, userId, admin)
    const [sections, itemsWithBodies] = await Promise.all([
      manuscriptService.listSections(id, userId, admin),
      manuscriptRepo.listItemsWithBodies(id, userId, admin),
    ])

    const options: MarkdownExportOptions = {
      includeFrontMatter: asBool(req.query.frontMatter) ?? true,
      includeToc:         asBool(req.query.toc) ?? false,
      includeAiNotes:     asBool(req.query.aiNotes) ?? false,
      includeNotes:       asBool(req.query.notes) ?? false,
      includeFragments:   asBool(req.query.fragments) ?? false,
      includePlaceholders: asBool(req.query.placeholders) ?? true,
      numberItems:        asBool(req.query.number) ?? false,
    }

    const markdown = manuscriptToMarkdown(manuscript, sections, itemsWithBodies, options)
    const filename = suggestFilename(manuscript, 'md')

    await activityService.logManuscript('export', id, userId, getClientIp(req), getUserAgent(req), {
      format: 'markdown',
      bytes: Buffer.byteLength(markdown, 'utf8'),
      options,
    })

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(markdown)
  },

  /** PUT /api/manuscripts/:id/items/reorder - bulk reorder for drag-and-drop. */
  async reorderItems(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    const moves = (req.body && (req.body.moves ?? req.body)) as unknown
    const items = await manuscriptService.reorderItems(id, userId, moves, admin)
    await activityService.logManuscript('items_reorder', id, userId, getClientIp(req), getUserAgent(req), {
      count: Array.isArray(moves) ? moves.length : 0,
    })
    res.json({ data: items })
  },
}
