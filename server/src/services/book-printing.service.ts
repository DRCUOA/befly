/**
 * Book printing service.
 *
 * Sits between the controller and bookPrintingRepo. Responsibilities:
 *   - Auth-check the parent manuscript via manuscriptService.get.
 *   - Validate the incoming nested settings against the schema enums.
 *   - Assign the next version_number per (manuscript, user) on create.
 *   - Surface NotFound/Forbidden cleanly to the controller layer.
 */
import { manuscriptService } from './manuscript.service.js'
import { bookPrintingRepo } from '../repositories/book-printing.repo.js'
import type {
  BookPrinting,
  BookPrintingInput,
  BookPrintingSummary,
} from '../models/BookPrinting.js'
import { ValidationError } from '../utils/errors.js'

const TRIM_UNITS = ['in', 'mm'] as const
const ALIGNMENT = ['justified', 'left'] as const
const CHAPTER_START = ['new_page', 'right_hand_page'] as const
const CHAPTER_TITLE_STYLE = [
  'chapter_number',
  'chapter_word_number',
  'title_only',
  'number_and_title',
] as const
const CHAPTER_OPENING_POSITION = ['top', 'upper_third', 'centered_high'] as const
const SCENE_BREAK_STYLE = [
  'blank_line',
  'centered_asterisks',
  'centered_symbol',
] as const
const LEFT_PAGE_HEADER = ['author_name', 'book_title', 'none'] as const
const RIGHT_PAGE_HEADER = [
  'book_title',
  'author_name',
  'chapter_title',
  'none',
] as const
const PAGE_NUMBER_POSITION = [
  'bottom_center',
  'outer_top',
  'outer_bottom',
] as const
const FRONT_MATTER_KEYS = [
  'half_title',
  'also_by_author',
  'title_page',
  'copyright_page',
  'dedication',
  'epigraph',
  'contents',
] as const
const BACK_MATTER_KEYS = [
  'acknowledgements',
  'author_note',
  'discussion_questions',
  'also_by_author',
  'preview_chapter',
  'author_bio',
] as const
const PAPER_COLOR = ['cream', 'white'] as const
const COVER_ALIGN = ['left', 'center', 'right'] as const

const MAX_DRAFT_LABEL = 120
const MAX_TEXT_FIELD = 20_000

function ensureEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${label} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

function ensureFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${label} must be a finite number`)
  }
  return value
}

function ensureString(value: unknown, label: string, maxLen = MAX_TEXT_FIELD): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${label} must be a string`)
  }
  if (value.length > maxLen) {
    throw new ValidationError(`${label} must be ${maxLen} characters or less`)
  }
  return value
}

function ensureBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${label} must be a boolean`)
  }
  return value
}

function ensureOptionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new ValidationError(`${label} must be an integer`)
  }
  if (value < 1) {
    throw new ValidationError(`${label} must be 1 or greater`)
  }
  return value
}

function validateInput(raw: unknown): BookPrintingInput {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Body must be an object')
  }
  const r = raw as Record<string, unknown>

  const trim = (r.trimSize ?? {}) as Record<string, unknown>
  const margins = (r.margins ?? {}) as Record<string, unknown>
  const typo = (r.typography ?? {}) as Record<string, unknown>
  const para = (r.paragraphs ?? {}) as Record<string, unknown>
  const chap = (r.chapters ?? {}) as Record<string, unknown>
  const scene = (r.sceneBreaks ?? {}) as Record<string, unknown>
  const head = (r.headersAndFooters ?? {}) as Record<string, unknown>
  const mc = (r.matterContent ?? {}) as Record<string, unknown>
  const paper = (r.paper ?? {}) as Record<string, unknown>
  const cover = (r.cover ?? {}) as Record<string, unknown>

  const frontMatter = Array.isArray(r.frontMatter) ? r.frontMatter : []
  const backMatter = Array.isArray(r.backMatter) ? r.backMatter : []

  return {
    draftLabel: ensureString(r.draftLabel ?? '', 'draftLabel', MAX_DRAFT_LABEL),
    versionNumber: ensureOptionalPositiveInteger(r.versionNumber, 'versionNumber'),
    profileName: ensureString(r.profileName, 'profileName', 200),
    trimSize: {
      label: ensureString(trim.label, 'trimSize.label', 200),
      width: ensureFiniteNumber(trim.width, 'trimSize.width'),
      height: ensureFiniteNumber(trim.height, 'trimSize.height'),
      unit: ensureEnum(trim.unit, TRIM_UNITS, 'trimSize.unit'),
    },
    margins: {
      top: ensureFiniteNumber(margins.top, 'margins.top'),
      bottom: ensureFiniteNumber(margins.bottom, 'margins.bottom'),
      outside: ensureFiniteNumber(margins.outside, 'margins.outside'),
      insideGutter: ensureFiniteNumber(margins.insideGutter, 'margins.insideGutter'),
    },
    typography: {
      bodyFont: ensureString(typo.bodyFont, 'typography.bodyFont', 120),
      fontSize: ensureFiniteNumber(typo.fontSize, 'typography.fontSize'),
      lineHeight: ensureFiniteNumber(typo.lineHeight, 'typography.lineHeight'),
      alignment: ensureEnum(typo.alignment, ALIGNMENT, 'typography.alignment'),
      hyphenation: ensureBoolean(typo.hyphenation, 'typography.hyphenation'),
    },
    paragraphs: {
      firstLineIndent: ensureFiniteNumber(para.firstLineIndent, 'paragraphs.firstLineIndent'),
      paragraphSpacing: ensureFiniteNumber(para.paragraphSpacing, 'paragraphs.paragraphSpacing'),
      removeIndentAfterChapterHeading: ensureBoolean(
        para.removeIndentAfterChapterHeading,
        'paragraphs.removeIndentAfterChapterHeading'
      ),
      removeIndentAfterSceneBreak: ensureBoolean(
        para.removeIndentAfterSceneBreak,
        'paragraphs.removeIndentAfterSceneBreak'
      ),
    },
    chapters: {
      chapterStart: ensureEnum(chap.chapterStart, CHAPTER_START, 'chapters.chapterStart'),
      chapterTitleStyle: ensureEnum(
        chap.chapterTitleStyle,
        CHAPTER_TITLE_STYLE,
        'chapters.chapterTitleStyle'
      ),
      chapterOpeningPosition: ensureEnum(
        chap.chapterOpeningPosition,
        CHAPTER_OPENING_POSITION,
        'chapters.chapterOpeningPosition'
      ),
      dropCap: ensureBoolean(chap.dropCap, 'chapters.dropCap'),
      smallCapsOpening: ensureBoolean(chap.smallCapsOpening, 'chapters.smallCapsOpening'),
      chaptersFromItems: ensureBoolean(chap.chaptersFromItems, 'chapters.chaptersFromItems'),
    },
    sceneBreaks: {
      style: ensureEnum(scene.style, SCENE_BREAK_STYLE, 'sceneBreaks.style'),
      symbol: ensureString(scene.symbol ?? '', 'sceneBreaks.symbol', 64),
    },
    headersAndFooters: {
      runningHeaders: ensureBoolean(head.runningHeaders, 'headersAndFooters.runningHeaders'),
      leftPageHeader: ensureEnum(
        head.leftPageHeader,
        LEFT_PAGE_HEADER,
        'headersAndFooters.leftPageHeader'
      ),
      rightPageHeader: ensureEnum(
        head.rightPageHeader,
        RIGHT_PAGE_HEADER,
        'headersAndFooters.rightPageHeader'
      ),
      pageNumberPosition: ensureEnum(
        head.pageNumberPosition,
        PAGE_NUMBER_POSITION,
        'headersAndFooters.pageNumberPosition'
      ),
      suppressHeaderOnChapterOpenings: ensureBoolean(
        head.suppressHeaderOnChapterOpenings,
        'headersAndFooters.suppressHeaderOnChapterOpenings'
      ),
    },
    frontMatter: frontMatter.map((v, i) =>
      ensureEnum(v, FRONT_MATTER_KEYS, `frontMatter[${i}]`)
    ),
    backMatter: backMatter.map((v, i) =>
      ensureEnum(v, BACK_MATTER_KEYS, `backMatter[${i}]`)
    ),
    matterContent: {
      alsoByFront: ensureString(mc.alsoByFront ?? '', 'matterContent.alsoByFront'),
      dedication: ensureString(mc.dedication ?? '', 'matterContent.dedication'),
      epigraph: ensureString(mc.epigraph ?? '', 'matterContent.epigraph'),
      epigraphAttribution: ensureString(
        mc.epigraphAttribution ?? '',
        'matterContent.epigraphAttribution'
      ),
      acknowledgements: ensureString(mc.acknowledgements ?? '', 'matterContent.acknowledgements'),
      authorNote: ensureString(mc.authorNote ?? '', 'matterContent.authorNote'),
      discussionQuestions: ensureString(
        mc.discussionQuestions ?? '',
        'matterContent.discussionQuestions'
      ),
      alsoByBack: ensureString(mc.alsoByBack ?? '', 'matterContent.alsoByBack'),
      previewChapter: ensureString(mc.previewChapter ?? '', 'matterContent.previewChapter'),
      authorBio: ensureString(mc.authorBio ?? '', 'matterContent.authorBio'),
    },
    paper: {
      color: ensureEnum(paper.color, PAPER_COLOR, 'paper.color'),
      ink: 'black',
      binding: 'perfect_bound',
    },
    cover: {
      authorName: ensureString(cover.authorName ?? '', 'cover.authorName', 255),
      titleY: ensureFiniteNumber(cover.titleY, 'cover.titleY'),
      authorY: ensureFiniteNumber(cover.authorY, 'cover.authorY'),
      titleSize: ensureFiniteNumber(cover.titleSize, 'cover.titleSize'),
      titleColor: ensureString(cover.titleColor, 'cover.titleColor', 16),
      authorSize: ensureFiniteNumber(cover.authorSize, 'cover.authorSize'),
      authorColor: ensureString(cover.authorColor, 'cover.authorColor', 16),
      titleAlign: ensureEnum(cover.titleAlign, COVER_ALIGN, 'cover.titleAlign'),
      authorAlign: ensureEnum(cover.authorAlign, COVER_ALIGN, 'cover.authorAlign'),
      backText: ensureString(cover.backText ?? '', 'cover.backText'),
      backTextColor: ensureString(cover.backTextColor, 'cover.backTextColor', 16),
      coverOpacity: ensureFiniteNumber(cover.coverOpacity, 'cover.coverOpacity'),
      isbn: ensureString(cover.isbn ?? '', 'cover.isbn', 32),
      showBarcode: ensureBoolean(cover.showBarcode, 'cover.showBarcode'),
    },
  }
}

export const bookPrintingService = {
  async list(
    manuscriptId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<BookPrintingSummary[]> {
    // Read access to the manuscript is a prerequisite even though the
    // printings themselves are per-user.
    await manuscriptService.get(manuscriptId, userId, isAdmin)
    return bookPrintingRepo.listForManuscript(manuscriptId, userId)
  },

  async get(
    manuscriptId: string,
    printingId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<BookPrinting> {
    await manuscriptService.get(manuscriptId, userId, isAdmin)
    return bookPrintingRepo.findById(printingId, userId)
  },

  async create(input: {
    manuscriptId: string
    userId: string
    body: unknown
    isAdmin?: boolean
  }): Promise<BookPrinting> {
    await manuscriptService.get(input.manuscriptId, input.userId, input.isAdmin ?? false)
    const data = validateInput(input.body)
    let versionNumber: number
    if (data.versionNumber !== undefined) {
      const inUse = await bookPrintingRepo.versionInUse(
        input.manuscriptId,
        input.userId,
        data.versionNumber
      )
      if (inUse) {
        throw new ValidationError(
          `Version ${data.versionNumber} already exists for this manuscript. Pick a different number.`
        )
      }
      versionNumber = data.versionNumber
    } else {
      const current = await bookPrintingRepo.maxVersion(input.manuscriptId, input.userId)
      versionNumber = current + 1
    }
    return bookPrintingRepo.create({
      manuscriptId: input.manuscriptId,
      userId: input.userId,
      versionNumber,
      data,
    })
  },

  async update(input: {
    manuscriptId: string
    printingId: string
    userId: string
    body: unknown
    isAdmin?: boolean
  }): Promise<BookPrinting> {
    await manuscriptService.get(input.manuscriptId, input.userId, input.isAdmin ?? false)
    const data = validateInput(input.body)
    let versionNumberOverride: number | undefined
    if (data.versionNumber !== undefined) {
      // findById doubles as ownership check; the repo throws NotFound if
      // the caller doesn't own the row.
      const existing = await bookPrintingRepo.findById(input.printingId, input.userId)
      if (data.versionNumber !== existing.versionNumber) {
        const inUse = await bookPrintingRepo.versionInUse(
          input.manuscriptId,
          input.userId,
          data.versionNumber,
          input.printingId
        )
        if (inUse) {
          throw new ValidationError(
            `Version ${data.versionNumber} already exists for this manuscript. Pick a different number.`
          )
        }
        versionNumberOverride = data.versionNumber
      }
    }
    return bookPrintingRepo.update(
      input.printingId,
      input.userId,
      data,
      versionNumberOverride
    )
  },

  async delete(input: {
    manuscriptId: string
    printingId: string
    userId: string
    isAdmin?: boolean
  }): Promise<void> {
    await manuscriptService.get(input.manuscriptId, input.userId, input.isAdmin ?? false)
    await bookPrintingRepo.delete(input.printingId, input.userId)
  },
}
