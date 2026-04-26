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
}
