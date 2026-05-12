/**
 * Writing collaboration API — editors, revisions, restore, user search.
 *
 * Mirrors the backend route shape:
 *   /api/writing/:id/editors                       list, upsert
 *   /api/writing/:id/editors/:targetUserId         patch, remove
 *   /api/writing/:id/revisions                     list
 *   /api/writing/:id/revisions/:versionNumber      full revision (body)
 *   /api/writing/:id/restore/:versionNumber        rollback
 *   /api/users/search?q=                           authenticated user search
 */
import { api } from './client'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
  WritingBlockEditor,
  WritingBlockEditorPermission,
} from '@shared/WritingBlockEditor'
import type {
  WritingBlockRevision,
  WritingBlockRevisionSummary,
} from '@shared/WritingBlockRevision'
import type { WritingBlock } from '@shared/WritingBlock'

export interface UserSearchHit {
  id: string
  displayName: string
  email: string
}

export const writingApi = {
  // --- Editors ---
  listEditors: (writingId: string) =>
    api
      .get<ApiResponse<WritingBlockEditor[]>>(`/writing/${writingId}/editors`)
      .then(r => r.data),

  upsertEditor: (
    writingId: string,
    body: { userId: string; permission: WritingBlockEditorPermission }
  ) =>
    api
      .post<ApiResponse<WritingBlockEditor>>(`/writing/${writingId}/editors`, body)
      .then(r => r.data),

  changeEditor: (
    writingId: string,
    targetUserId: string,
    permission: WritingBlockEditorPermission
  ) =>
    api
      .patch<ApiResponse<WritingBlockEditor>>(
        `/writing/${writingId}/editors/${targetUserId}`,
        { permission }
      )
      .then(r => r.data),

  removeEditor: (writingId: string, targetUserId: string) =>
    api.delete(`/writing/${writingId}/editors/${targetUserId}`),

  // --- Revisions ---
  listRevisions: (writingId: string) =>
    api
      .get<ApiResponse<WritingBlockRevisionSummary[]>>(`/writing/${writingId}/revisions`)
      .then(r => r.data),

  getRevision: (writingId: string, versionNumber: number) =>
    api
      .get<ApiResponse<WritingBlockRevision>>(
        `/writing/${writingId}/revisions/${versionNumber}`
      )
      .then(r => r.data),

  restore: (writingId: string, versionNumber: number, note?: string) =>
    api
      .post<ApiResponse<WritingBlock>>(
        `/writing/${writingId}/restore/${versionNumber}`,
        note ? { note } : {}
      )
      .then(r => r.data),
}

export const userSearchApi = {
  search: (q: string) =>
    api.get<ApiResponse<UserSearchHit[]>>(`/users/search?q=${encodeURIComponent(q)}`).then(r => r.data),
}
