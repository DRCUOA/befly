/**
 * Book printing API client.
 *
 * Mirrors the server's /api/manuscripts/:manuscriptId/printings routes
 * one-for-one. Returns the inner `data` payload (no envelope) to match
 * the rest of client/api/*.
 */
import { api } from './client'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
  BookPrinting,
  BookPrintingInput,
  BookPrintingSummary,
} from '@shared/BookPrinting'

export const bookPrintingApi = {
  list(manuscriptId: string): Promise<BookPrintingSummary[]> {
    return api
      .get<ApiResponse<BookPrintingSummary[]>>(
        `/manuscripts/${manuscriptId}/printings`
      )
      .then(r => r.data)
  },

  get(manuscriptId: string, printingId: string): Promise<BookPrinting> {
    return api
      .get<ApiResponse<BookPrinting>>(
        `/manuscripts/${manuscriptId}/printings/${printingId}`
      )
      .then(r => r.data)
  },

  create(manuscriptId: string, input: BookPrintingInput): Promise<BookPrinting> {
    return api
      .post<ApiResponse<BookPrinting>>(
        `/manuscripts/${manuscriptId}/printings`,
        input
      )
      .then(r => r.data)
  },

  update(
    manuscriptId: string,
    printingId: string,
    input: BookPrintingInput
  ): Promise<BookPrinting> {
    return api
      .put<ApiResponse<BookPrinting>>(
        `/manuscripts/${manuscriptId}/printings/${printingId}`,
        input
      )
      .then(r => r.data)
  },

  delete(manuscriptId: string, printingId: string): Promise<{ deleted: string }> {
    return api
      .delete<ApiResponse<{ deleted: string }>>(
        `/manuscripts/${manuscriptId}/printings/${printingId}`
      )
      .then(r => r.data)
  },
}
