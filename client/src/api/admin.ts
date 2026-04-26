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

export const adminApi = {
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
