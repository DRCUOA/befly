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

  /* ----- RAG admin ----- */

  ragListManuscripts(): Promise<RagManuscriptRow[]> {
    return api.get<ApiResponse<RagManuscriptRow[]>>('/admin/rag/manuscripts').then(r => r.data)
  },

  ragStats(manuscriptId: string): Promise<RagStats> {
    return api
      .get<ApiResponse<RagStats>>(`/admin/rag/manuscripts/${manuscriptId}/stats`)
      .then(r => r.data)
  },

  ragListSources(manuscriptId: string, includeArchived = false): Promise<RagContextSource[]> {
    return api
      .get<ApiResponse<RagContextSource[]>>(
        `/admin/rag/manuscripts/${manuscriptId}/sources`,
        { params: { includeArchived: String(includeArchived) } }
      )
      .then(r => r.data)
  },

  ragDeleteSource(sourceId: string): Promise<{ deleted: string }> {
    return api
      .delete<ApiResponse<{ deleted: string }>>(`/admin/rag/sources/${sourceId}`)
      .then(r => r.data)
  },

  ragCompile(manuscriptId: string, force = false): Promise<RagCompileResult> {
    return api
      .post<ApiResponse<RagCompileResult>>(
        `/admin/rag/manuscripts/${manuscriptId}/compile`,
        { force }
      )
      .then(r => r.data)
  },

  ragChunk(manuscriptId: string): Promise<RagChunkResult> {
    return api
      .post<ApiResponse<RagChunkResult>>(`/admin/rag/manuscripts/${manuscriptId}/chunk`, {})
      .then(r => r.data)
  },

  ragEmbed(manuscriptId: string): Promise<RagEmbedResult> {
    return api
      .post<ApiResponse<RagEmbedResult>>(`/admin/rag/manuscripts/${manuscriptId}/embed`, {})
      .then(r => r.data)
  },

  ragReindex(manuscriptId: string, force = false): Promise<RagReindexResult> {
    return api
      .post<ApiResponse<RagReindexResult>>(
        `/admin/rag/manuscripts/${manuscriptId}/reindex`,
        { force }
      )
      .then(r => r.data)
  },

  ragSearch(manuscriptId: string, query: string, options: Partial<{
    topK: number
    maxContextTokens: number
    includeArchived: boolean
    sourceTypes: string[]
    contextRoles: string[]
  }> = {}): Promise<RagSearchResult> {
    return api
      .post<ApiResponse<RagSearchResult>>(
        `/admin/rag/manuscripts/${manuscriptId}/search`,
        { query, ...options }
      )
      .then(r => r.data)
  },

  ragListUploadedFiles(manuscriptId: string): Promise<RagUploadedFileRow[]> {
    return api
      .get<ApiResponse<RagUploadedFileRow[]>>(
        `/admin/rag/manuscripts/${manuscriptId}/uploaded-files`
      )
      .then(r => r.data)
  },

  ragAttachUploadedFile(manuscriptId: string, fileId: string, opts: { contextRole?: string; includeInAi?: boolean }) {
    return api
      .post<ApiResponse<{ manuscriptId: string; uploadedFileId: string; contextRole: string; includeInAi: boolean }>>(
        `/admin/rag/manuscripts/${manuscriptId}/uploaded-files/${fileId}`,
        opts
      )
      .then(r => r.data)
  },

  ragDetachUploadedFile(manuscriptId: string, fileId: string) {
    return api
      .delete<ApiResponse<{ detached: { manuscriptId: string; uploadedFileId: string } }>>(
        `/admin/rag/manuscripts/${manuscriptId}/uploaded-files/${fileId}`
      )
      .then(r => r.data)
  },
}

/* ----- RAG admin types ----- */

export interface RagManuscriptRow {
  id: string
  title: string
  userId: string
  form: string
  status: string
  updatedAt: string
  ownerDisplayName: string | null
  ownerEmail: string | null
  contextSources: number
  contextChunks: number
  contextEmbeddings: number
  aiExchanges: number
}

export interface RagStats {
  sources: number
  chunks: number
  embeddings: number
  recentExchanges: Array<{
    id: string
    feature: string
    mode: string | null
    model: string
    status: 'ok' | 'error'
    createdAt: string
  }>
}

export interface RagContextSource {
  id: string
  manuscriptId: string
  userId: string
  sourceType: string
  sourceId: string | null
  title: string
  body: string | null
  metadata: Record<string, unknown>
  contextRole: string
  priority: number
  status: string
  canonical: boolean
  includeInAi: boolean
  contentHash: string | null
  createdAt: string
  updatedAt: string
}

export interface RagCompileResult {
  manuscriptId: string
  sources: { sourceType: string; sourceId: string | null; sourceRowId: string; action: 'created' | 'updated' | 'unchanged' }[]
  superseded: string[]
  totalActive: number
}

export interface RagChunkResult {
  rebuiltSources: number
  totalChunks: number
  totalSources: number
}

export interface RagEmbedResult {
  embedded: number
  skipped: number
  total: number
  model: string
}

export interface RagReindexResult {
  manuscriptId: string
  compile: RagCompileResult
  chunk: RagChunkResult
  embed: RagEmbedResult
}

export interface RagSearchResult {
  query: string
  chunks: Array<{
    chunkId: string
    contextSourceId: string
    manuscriptId: string
    title: string
    sourceType: string
    contextRole: string
    text: string
    score: number
    metadata: Record<string, unknown>
  }>
  contextPack: string
}

export interface RagUploadedFileRow {
  id: string
  filename: string
  contentType: string
  sizeBytes: number
  createdAt: string
  attached: boolean
  contextRole: string | null
  includeInAi: boolean | null
}
