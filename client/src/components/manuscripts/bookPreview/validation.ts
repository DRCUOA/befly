// Validation rules for a PreviewConfig. The hard errors come from the spec's
// `validation_requirements.hard_errors`; warnings come from `warnings`. Both
// lists are stable across calls — order matches the spec — so the UI can
// surface them directly.

import type { PreviewConfig, ValidationResult } from './types'

export interface ValidateOpts {
  /** When known, used to flag narrow gutters on thick books. */
  estimatedPageCount?: number
}

const SANS_SERIF_HINTS = [
  'arial',
  'helvetica',
  'tahoma',
  'verdana',
  'trebuchet',
  'gill sans',
  'futura',
  'roboto',
  'open sans',
]

const ALLOWED_PAGE_NUMBER_POSITIONS = ['bottom_center', 'outer_top', 'outer_bottom']

export function validateConfig(c: PreviewConfig, opts: ValidateOpts = {}): ValidationResult {
  const errors: { field: string; message: string }[] = []
  const warnings: { field: string; message: string }[] = []

  // ---- Hard errors ----
  if (!(c.typography.fontSize > 0)) {
    errors.push({ field: 'typography.fontSize', message: 'Font size must be greater than 0.' })
  }
  if (!(c.typography.lineHeight > c.typography.fontSize)) {
    errors.push({ field: 'typography.lineHeight', message: 'Line height must be greater than font size.' })
  }
  if (!(c.margins.insideGutter > 0)) {
    errors.push({ field: 'margins.insideGutter', message: 'Inside gutter must be greater than 0.' })
  }
  if (!(c.trimSize.width > 0 && c.trimSize.height > 0)) {
    errors.push({ field: 'trimSize', message: 'Trim size must have valid width and height.' })
  }
  if (!ALLOWED_PAGE_NUMBER_POSITIONS.includes(c.headersAndFooters.pageNumberPosition)) {
    errors.push({
      field: 'headersAndFooters.pageNumberPosition',
      message: 'Page number position must be one of the allowed values.',
    })
  }
  if (!c.typography.bodyFont || !c.typography.bodyFont.trim()) {
    errors.push({ field: 'typography.bodyFont', message: 'Body font must not be empty.' })
  }
  if (c.margins.insideGutter < c.margins.outside) {
    errors.push({
      field: 'margins.insideGutter',
      message: 'Inside gutter must be greater than or equal to the outside margin.',
    })
  }

  // ---- Warnings ----
  if (c.margins.outside < 0.5 || c.margins.top < 0.5 || c.margins.bottom < 0.6) {
    warnings.push({ field: 'margins', message: 'Margins may be too narrow for print.' })
  }

  if (
    opts.estimatedPageCount &&
    opts.estimatedPageCount > 350 &&
    c.margins.insideGutter < 0.85
  ) {
    warnings.push({
      field: 'margins.insideGutter',
      message: 'Gutter may be too narrow for the estimated page count.',
    })
  }

  if (c.typography.fontSize < 10.5) {
    warnings.push({
      field: 'typography.fontSize',
      message: 'Font size may be too small for comfortable regular print.',
    })
  }

  if (c.typography.lineHeight < c.typography.fontSize + 1.5) {
    warnings.push({ field: 'typography.lineHeight', message: 'Line height may be too tight.' })
  }

  if (c.paragraphs.paragraphSpacing > 0) {
    warnings.push({
      field: 'paragraphs.paragraphSpacing',
      message: 'Paragraph spacing is not standard for regular paperback fiction.',
    })
  }

  if (c.sceneBreaks.style === 'blank_line') {
    warnings.push({
      field: 'sceneBreaks.style',
      message: 'Blank scene break may be missed at a page boundary.',
    })
  }

  const lower = c.typography.bodyFont.toLowerCase()
  if (SANS_SERIF_HINTS.some(f => lower.includes(f))) {
    warnings.push({
      field: 'typography.bodyFont',
      message: 'Sans-serif body text is unusual for regular paperback fiction.',
    })
  }

  return { errors, warnings }
}
