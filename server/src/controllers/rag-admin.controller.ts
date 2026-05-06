/**
 * RAG admin controller — HTTP surface for the manuscript-scoped RAG
 * pipeline. Mirrors the operations exposed by the rag-cli, so the admin
 * UI and CLI are interchangeable.
 *
 * All routes assume the caller is an admin (gated at the router level
 * by `requireAdmin`). The compile/chunk/embed/reindex/search ops
 * delegate straight to the same service functions the assist code uses
 * — the controller just validates input and shapes responses.
 */
import { Request, Response } from 'express'
import { pool } from '../config/db.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'
import {
  compileManuscriptContext,
  chunkManuscriptContext,
  embedManuscriptContext,
  reindexManuscript,
  retrieveManuscriptContext,
  manuscriptContextStats,
  listManuscriptContextSources,
  deleteManuscriptContextSource,
} from '../services/rag/index.js'
import { manuscriptContextRepo } from '../repositories/manuscript-context.repo.js'
import { aiExchangeRepo } from '../repositories/ai-exchange.repo.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ValidationError(`${label} must be a UUID`)
  }
  return value
}

async function assertManuscriptExists(id: string): Promise<{ id: string; userId: string; title: string }> {
  const r = await pool.query(
    `SELECT id, user_id AS "userId", title FROM manuscript_projects WHERE id = $1`,
    [id]
  )
  if (r.rows.length === 0) throw new NotFoundError('Manuscript not found')
  return r.rows[0]
}

export const ragAdminController = {
  /**
   * GET /api/admin/rag/manuscripts
   *
   * Lightweight list of every manuscript with a few useful columns for
   * the picker (title, owner display name, current RAG counts). The
   * counts are inexpensive — three COUNT(*)s scoped by manuscript_id.
   */
  async listManuscripts(_req: Request, res: Response) {
    const r = await pool.query(
      `SELECT
         mp.id,
         mp.title,
         mp.user_id        AS "userId",
         mp.form,
         mp.status,
         mp.updated_at     AS "updatedAt",
         u.display_name    AS "ownerDisplayName",
         u.email           AS "ownerEmail",
         (SELECT COUNT(*)::int FROM manuscript_context_sources s WHERE s.manuscript_id = mp.id) AS "contextSources",
         (SELECT COUNT(*)::int FROM context_chunks            c WHERE c.manuscript_id = mp.id) AS "contextChunks",
         (SELECT COUNT(*)::int FROM context_embeddings        e WHERE e.manuscript_id = mp.id) AS "contextEmbeddings",
         (SELECT COUNT(*)::int FROM ai_exchanges              x WHERE x.manuscript_id = mp.id) AS "aiExchanges"
       FROM manuscript_projects mp
       LEFT JOIN users u ON u.id = mp.user_id
       ORDER BY mp.updated_at DESC`
    )
    res.json({ data: r.rows })
  },

  /**
   * GET /api/admin/rag/manuscripts/:id/stats
   *
   * Returns counts plus the most recent AI exchange row for context.
   */
  async getStats(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    await assertManuscriptExists(id)
    const stats = await manuscriptContextStats(id)
    const recentExchanges = await aiExchangeRepo.list({ manuscriptId: id }, 5, 0)
    res.json({ data: { ...stats, recentExchanges } })
  },

  /**
   * GET /api/admin/rag/manuscripts/:id/sources
   *
   * List the compiled context sources. Returns the body too — the admin
   * surface explicitly wants to inspect what the compiler produced.
   */
  async listSources(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    await assertManuscriptExists(id)
    const includeArchived = req.query.includeArchived === 'true'
    const sources = await manuscriptContextRepo.listSources(id, { includeArchived })
    res.json({ data: sources })
  },

  /**
   * DELETE /api/admin/rag/sources/:sourceId
   *
   * Hard-delete a single context source row. Chunks + embeddings cascade
   * via FK. Use sparingly — the compiler will recreate the source on the
   * next reindex if its origin row still exists.
   */
  async deleteSource(req: Request, res: Response) {
    const sourceId = requireUuid(req.params.sourceId, 'sourceId')
    const existing = await manuscriptContextRepo.findSourceById(sourceId)
    if (!existing) throw new NotFoundError('Context source not found')
    await deleteManuscriptContextSource(sourceId)
    res.json({ data: { deleted: sourceId } })
  },

  /**
   * POST /api/admin/rag/manuscripts/:id/compile
   * POST /api/admin/rag/manuscripts/:id/chunk
   * POST /api/admin/rag/manuscripts/:id/embed
   * POST /api/admin/rag/manuscripts/:id/reindex
   *
   * Each delegates to the corresponding service function. `force` is
   * accepted for compile and reindex.
   *
   * Embed in particular makes outbound calls to OpenAI — the admin
   * needs to know that the request can take many seconds. We don't
   * stream progress back; the client shows a spinner and waits.
   */
  async compile(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    await assertManuscriptExists(id)
    const force = req.body?.force === true
    const result = await compileManuscriptContext(id, { force })
    res.json({ data: result })
  },

  async chunk(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    await assertManuscriptExists(id)
    const result = await chunkManuscriptContext(id)
    res.json({ data: result })
  },

  async embed(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    await assertManuscriptExists(id)
    const result = await embedManuscriptContext(id)
    res.json({ data: result })
  },

  async reindex(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    await assertManuscriptExists(id)
    const force = req.body?.force === true
    const result = await reindexManuscript(id, { force })
    res.json({ data: result })
  },

  /**
   * POST /api/admin/rag/manuscripts/:id/search
   *
   * Body: { query, topK?, maxContextTokens?, includeArchived?, sourceTypes?, contextRoles? }
   *
   * Returns the same shape `retrieveManuscriptContext` returns, including
   * the rendered contextPack so the admin can preview what an assist
   * call would inject into a prompt.
   */
  async search(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    await assertManuscriptExists(id)

    const body = (req.body && typeof req.body === 'object') ? req.body : {}
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query) throw new ValidationError('query is required')

    const topK = typeof body.topK === 'number' && body.topK > 0 ? Math.min(50, body.topK) : 8
    const maxContextTokens = typeof body.maxContextTokens === 'number' && body.maxContextTokens > 0
      ? Math.min(20000, body.maxContextTokens)
      : 4000
    const includeArchived = body.includeArchived === true

    const arrOfStrings = (v: unknown): string[] | undefined =>
      Array.isArray(v) && v.every(x => typeof x === 'string') ? v as string[] : undefined

    const sourceTypes = arrOfStrings(body.sourceTypes)
    const contextRoles = arrOfStrings(body.contextRoles)

    const result = await retrieveManuscriptContext(id, query, {
      topK,
      maxContextTokens,
      includeArchived,
      // Cast to the narrower union types the service expects; values that
      // aren't valid will simply not match anything in the DB.
      sourceTypes: sourceTypes as unknown as undefined,
      contextRoles: contextRoles as unknown as undefined,
    })

    res.json({ data: result })
  },

  /* ============================================================
   *  Uploaded-file membership
   * ============================================================ */

  /**
   * GET /api/admin/rag/manuscripts/:id/uploaded-files
   *
   * Returns the union of:
   *   - files attached to the manuscript via manuscript_uploaded_files
   *   - files belonging to the manuscript's owner that are NOT attached
   *
   * The admin can flip an attachment on/off from a single list.
   */
  async listUploadedFiles(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    const m = await assertManuscriptExists(id)

    const r = await pool.query(
      `SELECT
         uf.id,
         uf.filename,
         uf.content_type            AS "contentType",
         uf.size_bytes              AS "sizeBytes",
         uf.created_at              AS "createdAt",
         (muf.manuscript_id IS NOT NULL) AS attached,
         muf.context_role           AS "contextRole",
         muf.include_in_ai          AS "includeInAi"
       FROM uploaded_files uf
       LEFT JOIN manuscript_uploaded_files muf
              ON muf.uploaded_file_id = uf.id
             AND muf.manuscript_id = $1
       WHERE uf.uploaded_by = $2
       ORDER BY (muf.manuscript_id IS NOT NULL) DESC, uf.created_at DESC`,
      [id, m.userId]
    )
    res.json({ data: r.rows })
  },

  /**
   * POST /api/admin/rag/manuscripts/:id/uploaded-files/:fileId
   *
   * Attach (or update) an uploaded file's role / include_in_ai flag.
   * Body: { contextRole?: string; includeInAi?: boolean }
   */
  async attachUploadedFile(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    const fileId = requireUuid(req.params.fileId, 'fileId')
    await assertManuscriptExists(id)

    // Sanity-check the file actually exists.
    const f = await pool.query(`SELECT id FROM uploaded_files WHERE id = $1`, [fileId])
    if (f.rows.length === 0) throw new NotFoundError('Uploaded file not found')

    const body = (req.body && typeof req.body === 'object') ? req.body : {}
    const contextRole = typeof body.contextRole === 'string' ? body.contextRole : 'supporting'
    const includeInAi = body.includeInAi === false ? false : true

    await pool.query(
      `INSERT INTO manuscript_uploaded_files (manuscript_id, uploaded_file_id, context_role, include_in_ai)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (manuscript_id, uploaded_file_id)
       DO UPDATE SET context_role = EXCLUDED.context_role,
                     include_in_ai = EXCLUDED.include_in_ai`,
      [id, fileId, contextRole, includeInAi]
    )
    res.json({ data: { manuscriptId: id, uploadedFileId: fileId, contextRole, includeInAi } })
  },

  /**
   * DELETE /api/admin/rag/manuscripts/:id/uploaded-files/:fileId
   */
  async detachUploadedFile(req: Request, res: Response) {
    const id = requireUuid(req.params.id, 'manuscriptId')
    const fileId = requireUuid(req.params.fileId, 'fileId')
    await assertManuscriptExists(id)
    await pool.query(
      `DELETE FROM manuscript_uploaded_files WHERE manuscript_id = $1 AND uploaded_file_id = $2`,
      [id, fileId]
    )
    res.json({ data: { detached: { manuscriptId: id, uploadedFileId: fileId } } })
  },
}
