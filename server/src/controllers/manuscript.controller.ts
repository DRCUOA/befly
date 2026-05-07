import { Request, Response } from 'express'
import { manuscriptService } from '../services/manuscript.service.js'
import { manuscriptRepo } from '../repositories/manuscript.repo.js'
import {
  manuscriptToMarkdown,
  suggestFilename,
  MarkdownExportOptions,
} from '../services/manuscript-export.service.js'
import {
  buildManuscriptBriefing,
  briefingToJson,
  briefingToMarkdown,
  suggestBriefingFilename,
} from '../services/manuscript-briefing.service.js'
import { importBeats as importBeatsService } from '../services/beat-import.service.js'
import type { ProseLevel } from '../models/ManuscriptBriefing.js'
import { manuscriptAssistService } from '../services/manuscript-assist.service.js'
import { manuscriptArtifactRepo } from '../repositories/manuscript-artifact.repo.js'
import { LlmConfigurationError } from '../services/llm/llm-client.js'
import {
  ManuscriptArtifactType,
  ManuscriptArtifactStatus,
} from '../models/Manuscript.js'
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

  /**
   * GET /api/manuscripts/:id/briefing?format=json|markdown&prose=none|digest|full&artifactLimit=10&download=0
   *
   * Builds a "state snapshot" of the manuscript intended for AI consumption
   * or fast human review. Complements (does not replace) the full Markdown
   * export and the admin essay-export.
   *
   * - format=json (default): returns the canonical envelope as application/json.
   * - format=markdown:        returns a human-readable rendering of the same envelope.
   * - prose=digest (default): per-item first/last sentence; 'none' omits prose;
   *                           'full' includes whole bodies (heavy).
   * - artifactLimit=N:        cap on most-recent AI artifacts included. Default 10.
   * - download=1:             set Content-Disposition to attachment so the
   *                           browser saves the file. Default is inline so the
   *                           UI can preview it in a modal.
   */
  async briefing(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)

    const format = String(req.query.format ?? 'json').toLowerCase()
    if (format !== 'json' && format !== 'markdown' && format !== 'md') {
      throw new ValidationError(`Unsupported briefing format: ${format}. Supported: json, markdown`)
    }

    const proseRaw = String(req.query.prose ?? 'digest').toLowerCase()
    if (proseRaw !== 'none' && proseRaw !== 'digest' && proseRaw !== 'full') {
      throw new ValidationError(`Unsupported prose level: ${proseRaw}. Supported: none, digest, full`)
    }
    const proseLevel = proseRaw as ProseLevel

    let artifactLimit: number | undefined
    if (req.query.artifactLimit !== undefined) {
      const n = Number(req.query.artifactLimit)
      if (!Number.isFinite(n) || n < 0 || n > 200) {
        throw new ValidationError('artifactLimit must be a non-negative integer up to 200')
      }
      artifactLimit = Math.floor(n)
    }

    const wantsDownload = asBool(req.query.download) ?? false

    const envelope = await buildManuscriptBriefing(id, userId, admin, {
      proseLevel,
      artifactLimit,
    })

    await activityService.logManuscript('export', id, userId, getClientIp(req), getUserAgent(req), {
      format: format === 'md' ? 'briefing-markdown' : `briefing-${format}`,
      proseLevel,
      artifactLimit: artifactLimit ?? null,
    })

    if (format === 'markdown' || format === 'md') {
      const md = briefingToMarkdown(envelope)
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      if (wantsDownload) {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${suggestBriefingFilename(envelope.project.title, 'md')}"`
        )
      }
      res.send(md)
      return
    }

    // JSON
    const json = briefingToJson(envelope)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (wantsDownload) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${suggestBriefingFilename(envelope.project.title, 'json')}"`
      )
    }
    res.send(json)
  },

  /**
   * POST /api/manuscripts/:id/beats/import
   * Body: BeatsImportEnvelope — { beats, causalLinks?, characterNamesById?, motifNamesById? }
   *
   * Append the supplied beats to this manuscript. Owner-only (or admin).
   * Returns a BeatsImportResult describing what was created, what failed,
   * and which character/motif names couldn't be matched in the target.
   *
   * Beat ids in the payload are advisory: the server always assigns fresh
   * UUIDs, so re-importing the same payload yields duplicates rather than
   * collisions. Causal links are remapped to the new ids; any whose
   * endpoints didn't both map are counted as skipped, not failed.
   */
  async importBeats(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)

    const result = await importBeatsService(id, userId, admin, req.body)

    await activityService.logManuscript('beats_import', id, userId, getClientIp(req), getUserAgent(req), {
      total: result.total,
      created: result.created.length,
      errors: result.errors.length,
      causalLinksCreated: result.causalLinks.created,
      causalLinksSkipped: result.causalLinks.skipped,
      unmatchedCharacters: result.unmatched.characterNames.length,
      unmatchedMotifs: result.unmatched.motifNames.length,
    })

    res.status(201).json({ data: result })
  },

  /* ----- Assist & Artifacts ----- */

  /**
   * POST /api/manuscripts/:id/assist
   * Body: { mode: 'gaps', junction?: { fromItemId, toItemId }, dryRun?: boolean }
   *
   * Owner-only. Returns the generated artifacts.
   */
  async runAssist(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)

    const mode = String(req.body?.mode ?? '')
    if (mode !== 'gaps') {
      throw new ValidationError(`Unsupported assist mode: ${mode}. Supported: gaps`)
    }

    let junction: { fromItemId: string; toItemId: string } | undefined
    if (req.body?.junction) {
      const j = req.body.junction
      if (typeof j !== 'object' || typeof j.fromItemId !== 'string' || typeof j.toItemId !== 'string') {
        throw new ValidationError('junction must be { fromItemId, toItemId }')
      }
      junction = { fromItemId: j.fromItemId, toItemId: j.toItemId }
    }

    const dryRun = req.body?.dryRun === true

    try {
      const result = await manuscriptAssistService.run(
        { manuscriptId: id, mode: 'gaps', junction, dryRun },
        userId,
        admin
      )
      await activityService.logManuscript('assist_run', id, userId, getClientIp(req), getUserAgent(req), {
        mode,
        junctions: result.analyzedJunctions.length,
        skipped: result.skipped,
        artifacts: result.artifacts.length,
        model: result.model,
      })
      res.json({ data: result })
    } catch (err) {
      if (err instanceof LlmConfigurationError) {
        // Surface as 503 Service Unavailable so clients can show "AI not configured"
        // instead of a generic 500.
        res.status(503).json({ error: err.message })
        return
      }
      throw err
    }
  },

  /**
   * GET /api/manuscripts/:id/artifacts?type=...&status=...
   */
  async listArtifacts(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const filter: { type?: ManuscriptArtifactType; status?: ManuscriptArtifactStatus } = {}
    if (typeof req.query.type === 'string') filter.type = req.query.type as ManuscriptArtifactType
    if (typeof req.query.status === 'string') filter.status = req.query.status as ManuscriptArtifactStatus
    const artifacts = await manuscriptArtifactRepo.list(id, userId, admin, filter)
    res.json({ data: artifacts })
  },

  /** PUT /api/manuscripts/artifacts/:artifactId  Body: { status } */
  async updateArtifactStatus(req: Request, res: Response) {
    const { artifactId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)

    const status = req.body?.status
    if (typeof status !== 'string' || !['draft','accepted','rejected','archived'].includes(status)) {
      throw new ValidationError('status must be one of: draft, accepted, rejected, archived')
    }
    const updated = await manuscriptArtifactRepo.updateStatus(
      artifactId, userId, status as ManuscriptArtifactStatus, admin
    )
    await activityService.logManuscript('artifact_status', updated.manuscriptId, userId, getClientIp(req), getUserAgent(req), {
      artifactId, status,
    })
    res.json({ data: updated })
  },

  /** DELETE /api/manuscripts/artifacts/:artifactId */
  async deleteArtifact(req: Request, res: Response) {
    const { artifactId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const admin = isAdminRequest(req)
    await manuscriptArtifactRepo.delete(artifactId, userId, admin)
    await activityService.logManuscript('artifact_delete', artifactId, userId, getClientIp(req), getUserAgent(req))
    res.status(204).send()
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
