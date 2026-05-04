/**
 * Admin-only API helpers.
 *
 * Wraps the /api/admin endpoints used by the Admin view. Returns plain data
 * (not the {data} envelope) so call sites are tidy.
 */
import { api } from './client'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
  EssayExportEnvelope,
  EssayImportOptions,
  EssayImportResult,
} from '@shared/EssayExport'

/* ----- Admin essays list ----- */

/** Row shape returned by GET /api/admin/writings. */
export interface AdminEssayRow {
  id: string
  userId: string
  authorDisplayName: string | null
  authorEmail: string | null
  title: string
  bodyPreview: string | null
  bodyLength: number
  visibility: 'private' | 'shared' | 'public'
  coverImageUrl: string | null
  coverImagePosition: string
  createdAt: string
  updatedAt: string
  themeCount: number
  commentCount: number
  appreciationCount: number
  viewCount: number
}

export interface AdminEssayFilter {
  q?: string
  userId?: string
  visibility?: 'private' | 'shared' | 'public'
  sort?: 'created_at' | 'updated_at' | 'title' | 'author'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface AdminEssayListResponse {
  data: AdminEssayRow[]
  meta: {
    total: number
    limit: number
    offset: number
    filter: Record<string, unknown>
  }
}

export const adminApi = {
  /* ----- Admin essays ----- */

  listEssays(filter: AdminEssayFilter = {}): Promise<AdminEssayListResponse> {
    const params: Record<string, string> = {}
    if (filter.q) params.q = filter.q
    if (filter.userId) params.userId = filter.userId
    if (filter.visibility) params.visibility = filter.visibility
    if (filter.sort) params.sort = filter.sort
    if (filter.order) params.order = filter.order
    if (filter.limit !== undefined) params.limit = String(filter.limit)
    if (filter.offset !== undefined) params.offset = String(filter.offset)
    return api.get<AdminEssayListResponse>('/admin/writings', { params })
  },

  /**
   * Update visibility on any user's essay. Hits the dedicated admin endpoint
   * (which logs the action). For broader updates (title/body/themes) the
   * admin can use the standard `PUT /api/writing/:id` — that endpoint already
   * bypasses ownership when called by an admin.
   */
  setEssayVisibility(id: string, visibility: 'private' | 'shared' | 'public') {
    return api
      .put<ApiResponse<{ id: string; visibility: string }>>(
        `/admin/writings/${id}/visibility`,
        { visibility }
      )
      .then(r => r.data)
  },

  deleteEssay(id: string) {
    return api.delete(`/admin/writings/${id}`)
  },

  /**
   * Build the URL for the export endpoint. We return a URL string rather
   * than calling fetch ourselves so the modal can use a plain anchor tag
   * with the `download` attribute - cookie auth carries through, no
   * blob-and-revoke gymnastics.
   */
  buildEssayExportUrl(opts: { userId?: string; ids?: string[] } = {}): string {
    const params = new URLSearchParams()
    if (opts.userId) params.set('userId', opts.userId)
    if (opts.ids && opts.ids.length > 0) params.set('ids', opts.ids.join(','))
    const qs = params.toString()
    return `/api/admin/essays/export${qs ? `?${qs}` : ''}`
  },

  /**
   * Stable URL for the import-template download. Plain anchor target.
   */
  essayImportTemplateUrl(): string {
    return '/api/admin/essays/template'
  },

  /**
   * POST the parsed envelope back to the server for import. The server
   * decides where to place the essays (target user) based on the options.
   */
  importEssays(envelope: EssayExportEnvelope, options: EssayImportOptions): Promise<EssayImportResult> {
    return api
      .post<ApiResponse<EssayImportResult>>('/admin/essays/import', { envelope, options })
      .then(r => r.data)
  },
}
