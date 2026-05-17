/**
 * Library API client. Wraps the /api/library endpoints used by the
 * MyLibrary view: list, ISBN lookup (server-side enrichment via
 * @library-pals/isbn), create, update notes, delete.
 */
import { api } from './client'
import type { ApiResponse } from '@shared/ApiResponses'
import type { LibraryBook, LibraryBookLookup } from '@shared/LibraryBook'

export const libraryApi = {
  list: () =>
    api.get<ApiResponse<LibraryBook[]>>('/library').then(r => r.data),

  lookup: (isbn: string) =>
    api.get<ApiResponse<LibraryBookLookup>>(`/library/lookup/${encodeURIComponent(isbn)}`).then(r => r.data),

  create: (book: LibraryBookLookup & { notes?: string }) =>
    api.post<ApiResponse<LibraryBook>>('/library', book).then(r => r.data),

  updateNotes: (id: string, notes: string) =>
    api.patch<ApiResponse<LibraryBook>>(`/library/${id}/notes`, { notes }).then(r => r.data),

  delete: (id: string) =>
    api.delete<void>(`/library/${id}`),
}
