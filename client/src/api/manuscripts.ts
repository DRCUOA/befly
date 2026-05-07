/**
 * Manuscript API client. Thin wrapper over the shared `api` fetch helper.
 *
 * Mirrors the backend route shape:
 *   /api/manuscripts                            list, create
 *   /api/manuscripts/:id                        get, update, delete
 *   /api/manuscripts/:id/spine                  get manuscript + sections + items
 *   /api/manuscripts/:id/sections               list, create
 *   /api/manuscripts/sections/:sectionId        update, delete
 *   /api/manuscripts/:id/items                  list, create
 *   /api/manuscripts/:id/items/reorder          bulk reorder
 *   /api/manuscripts/items/:itemId              update, delete
 */
import { api } from './client'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
  ManuscriptProject,
  ManuscriptSection,
  ManuscriptItem,
  ManuscriptWithSpine,
  ManuscriptArtifact,
  ManuscriptArtifactStatus,
  ManuscriptArtifactType,
} from '@shared/Manuscript'
import type {
  ManuscriptBriefingEnvelope,
  ProseLevel,
  BeatsImportEnvelope,
  BeatsImportResult,
} from '@shared/ManuscriptBriefing'

export interface GetBriefingOptions {
  proseLevel?: ProseLevel
  /** Cap on most-recent AI artifacts. Pass 0 to exclude artifacts entirely. */
  artifactLimit?: number
}

export interface AssistRunResult {
  mode: string
  artifacts: ManuscriptArtifact[]
  analyzedJunctions: { fromItemId: string; toItemId: string }[]
  skipped: number
  model?: string
}

export const manuscriptsApi = {
  list: () => api.get<ApiResponse<ManuscriptProject[]>>('/manuscripts').then(r => r.data),

  get: (id: string) => api.get<ApiResponse<ManuscriptProject>>(`/manuscripts/${id}`).then(r => r.data),

  getSpine: (id: string) =>
    api.get<ApiResponse<ManuscriptWithSpine>>(`/manuscripts/${id}/spine`).then(r => r.data),

  create: (input: Partial<ManuscriptProject>) =>
    api.post<ApiResponse<ManuscriptProject>>('/manuscripts', input).then(r => r.data),

  update: (id: string, input: Partial<ManuscriptProject>) =>
    api.put<ApiResponse<ManuscriptProject>>(`/manuscripts/${id}`, input).then(r => r.data),

  delete: (id: string) => api.delete(`/manuscripts/${id}`),

  // Sections
  createSection: (manuscriptId: string, input: Partial<ManuscriptSection>) =>
    api.post<ApiResponse<ManuscriptSection>>(`/manuscripts/${manuscriptId}/sections`, input).then(r => r.data),

  updateSection: (sectionId: string, input: Partial<ManuscriptSection>) =>
    api.put<ApiResponse<ManuscriptSection>>(`/manuscripts/sections/${sectionId}`, input).then(r => r.data),

  deleteSection: (sectionId: string) => api.delete(`/manuscripts/sections/${sectionId}`),

  // Items
  createItem: (manuscriptId: string, input: Partial<ManuscriptItem>) =>
    api.post<ApiResponse<ManuscriptItem>>(`/manuscripts/${manuscriptId}/items`, input).then(r => r.data),

  updateItem: (itemId: string, input: Partial<ManuscriptItem>) =>
    api.put<ApiResponse<ManuscriptItem>>(`/manuscripts/items/${itemId}`, input).then(r => r.data),

  deleteItem: (itemId: string) => api.delete(`/manuscripts/items/${itemId}`),

  /** Bulk reorder for drag-and-drop. */
  reorderItems: (
    manuscriptId: string,
    moves: { id: string; orderIndex: number; sectionId?: string | null }[]
  ) =>
    api
      .put<ApiResponse<ManuscriptItem[]>>(`/manuscripts/${manuscriptId}/items/reorder`, { moves })
      .then(r => r.data),

  // Assist & artifacts
  runAssist: (
    manuscriptId: string,
    body: { mode: 'gaps'; junction?: { fromItemId: string; toItemId: string }; dryRun?: boolean }
  ) =>
    api.post<ApiResponse<AssistRunResult>>(`/manuscripts/${manuscriptId}/assist`, body).then(r => r.data),

  listArtifacts: (
    manuscriptId: string,
    filter?: { type?: ManuscriptArtifactType; status?: ManuscriptArtifactStatus }
  ) => {
    const params: Record<string, string> = {}
    if (filter?.type) params.type = filter.type
    if (filter?.status) params.status = filter.status
    return api
      .get<ApiResponse<ManuscriptArtifact[]>>(`/manuscripts/${manuscriptId}/artifacts`, { params })
      .then(r => r.data)
  },

  updateArtifactStatus: (artifactId: string, status: ManuscriptArtifactStatus) =>
    api
      .put<ApiResponse<ManuscriptArtifact>>(`/manuscripts/artifacts/${artifactId}`, { status })
      .then(r => r.data),

  deleteArtifact: (artifactId: string) => api.delete(`/manuscripts/artifacts/${artifactId}`),

  /**
   * Fetch the structured "briefing" envelope as JSON. The envelope is intended
   * for AI consumption or a fast human review — it carries literary direction,
   * spine, beats, knowledge ledger, characters, causal links, silences, and
   * recent AI artifacts. By default prose is included as per-item digests
   * (first/last sentence). Pass proseLevel='none' for the lightest payload or
   * 'full' for a deep critique.
   *
   * Note: the briefing endpoint returns the bare envelope (no ApiResponse
   * wrapper), so we type the response as the envelope itself.
   */
  getBriefing: (manuscriptId: string, opts: GetBriefingOptions = {}) => {
    const params: Record<string, string> = { format: 'json' }
    if (opts.proseLevel) params.prose = opts.proseLevel
    if (opts.artifactLimit !== undefined) params.artifactLimit = String(opts.artifactLimit)
    return api.get<ManuscriptBriefingEnvelope>(`/manuscripts/${manuscriptId}/briefing`, { params })
  },

  /**
   * Fetch the briefing rendered as Markdown. The shared `api` wrapper only
   * parses application/json bodies, so we go through plain fetch here.
   */
  getBriefingMarkdown: async (manuscriptId: string, opts: GetBriefingOptions = {}): Promise<string> => {
    const params = new URLSearchParams({ format: 'markdown' })
    if (opts.proseLevel) params.set('prose', opts.proseLevel)
    if (opts.artifactLimit !== undefined) params.set('artifactLimit', String(opts.artifactLimit))
    const res = await fetch(`/api/manuscripts/${manuscriptId}/briefing?${params.toString()}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      let msg: string | undefined
      try {
        const body = await res.json()
        msg = body?.error
      } catch { /* not JSON */ }
      throw new Error(msg || `Briefing request failed (${res.status})`)
    }
    return res.text()
  },

  /**
   * Build a download URL for the briefing in the given format. Used by the
   * modal's "Download" link so the browser handles the save dialog itself.
   */
  briefingDownloadUrl: (
    manuscriptId: string,
    format: 'json' | 'markdown',
    opts: GetBriefingOptions = {}
  ) => {
    const params = new URLSearchParams({ format, download: '1' })
    if (opts.proseLevel) params.set('prose', opts.proseLevel)
    if (opts.artifactLimit !== undefined) params.set('artifactLimit', String(opts.artifactLimit))
    return `/api/manuscripts/${manuscriptId}/briefing?${params.toString()}`
  },

  /**
   * Append beats to this manuscript from a JSON payload. The server is the
   * authority on validation and reference resolution — the client just
   * forwards the parsed envelope. Owner-only (or admin).
   */
  importBeats: (manuscriptId: string, payload: BeatsImportEnvelope) =>
    api
      .post<ApiResponse<BeatsImportResult>>(`/manuscripts/${manuscriptId}/beats/import`, payload)
      .then(r => r.data),
}
