/**
 * Library API client. Wraps the /api/library endpoints used by the
 * MyLibrary view: list, ISBN lookup (server-side enrichment via
 * @library-pals/isbn), create, update, delete, and scan-funnel telemetry.
 */
import { api } from './client'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
  LibraryBook,
  LibraryBookLookup,
  LibraryBookUpdate,
  LibraryScanEventInput,
} from '@shared/LibraryBook'

export type LibraryCreatePayload = LibraryBookLookup & Partial<{
  read: boolean
  readMotivation: number
  physicalCondition: number
  owner: string
  notes: string
}>

export const libraryApi = {
  list: () =>
    api.get<ApiResponse<LibraryBook[]>>('/library').then(r => r.data),

  lookup: (isbn: string) =>
    api.get<ApiResponse<LibraryBookLookup>>(`/library/lookup/${encodeURIComponent(isbn)}`).then(r => r.data),

  create: (book: LibraryCreatePayload) =>
    api.post<ApiResponse<LibraryBook>>('/library', book).then(r => r.data),

  update: (id: string, updates: LibraryBookUpdate) =>
    api.patch<ApiResponse<LibraryBook>>(`/library/${id}`, updates).then(r => r.data),

  delete: (id: string) =>
    api.delete<void>(`/library/${id}`),

  /** Fire-and-forget client-side telemetry for the scan funnel. */
  logScanEvent: (event: LibraryScanEventInput) =>
    api.post<void>('/library/telemetry', event).catch(err => {
      console.error('library telemetry write failed', err)
    }),
}
