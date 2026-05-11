/**
 * Book printing — shared TYPES between server and client.
 *
 * A book_printings row is one saved book-preview wizard configuration,
 * scoped to (manuscript, user) and identified by a user-defined
 * version_number plus an optional draft_label. The wire shape is the
 * full nested settings object so the wizard can hydrate its UI without
 * a second translation layer; the repository maps each nested field to
 * its own column at the storage boundary.
 *
 * Types-only file (mirror of ManuscriptChat.ts) — `@shared/*` is a
 * compile-time path alias only.
 */

export type TrimUnit = 'in' | 'mm'

export interface BookPrintingTrimSize {
  label: string
  width: number
  height: number
  unit: TrimUnit
}

export interface BookPrintingMargins {
  top: number
  bottom: number
  outside: number
  insideGutter: number
}

export type BookPrintingAlignment = 'justified' | 'left'

export interface BookPrintingTypography {
  bodyFont: string
  fontSize: number
  lineHeight: number
  alignment: BookPrintingAlignment
  hyphenation: boolean
}

export interface BookPrintingParagraphs {
  firstLineIndent: number
  paragraphSpacing: number
  removeIndentAfterChapterHeading: boolean
  removeIndentAfterSceneBreak: boolean
}

export type BookPrintingChapterStart = 'new_page' | 'right_hand_page'
export type BookPrintingChapterTitleStyle =
  | 'chapter_number'
  | 'chapter_word_number'
  | 'title_only'
  | 'number_and_title'
export type BookPrintingChapterOpeningPosition = 'top' | 'upper_third' | 'centered_high'

export interface BookPrintingChapters {
  chapterStart: BookPrintingChapterStart
  chapterTitleStyle: BookPrintingChapterTitleStyle
  chapterOpeningPosition: BookPrintingChapterOpeningPosition
  dropCap: boolean
  smallCapsOpening: boolean
  chaptersFromItems: boolean
}

export type BookPrintingSceneBreakStyle =
  | 'blank_line'
  | 'centered_asterisks'
  | 'centered_symbol'

export interface BookPrintingSceneBreaks {
  style: BookPrintingSceneBreakStyle
  symbol: string
}

export type BookPrintingLeftPageHeader = 'author_name' | 'book_title' | 'none'
export type BookPrintingRightPageHeader =
  | 'book_title'
  | 'author_name'
  | 'chapter_title'
  | 'none'
export type BookPrintingPageNumberPosition =
  | 'bottom_center'
  | 'outer_top'
  | 'outer_bottom'

export interface BookPrintingHeadersFooters {
  runningHeaders: boolean
  leftPageHeader: BookPrintingLeftPageHeader
  rightPageHeader: BookPrintingRightPageHeader
  pageNumberPosition: BookPrintingPageNumberPosition
  suppressHeaderOnChapterOpenings: boolean
}

export type BookPrintingFrontMatterKey =
  | 'half_title'
  | 'also_by_author'
  | 'title_page'
  | 'copyright_page'
  | 'dedication'
  | 'epigraph'
  | 'contents'

export type BookPrintingBackMatterKey =
  | 'acknowledgements'
  | 'author_note'
  | 'discussion_questions'
  | 'also_by_author'
  | 'preview_chapter'
  | 'author_bio'

export interface BookPrintingMatterContent {
  alsoByFront: string
  dedication: string
  epigraph: string
  epigraphAttribution: string
  acknowledgements: string
  authorNote: string
  discussionQuestions: string
  alsoByBack: string
  previewChapter: string
  authorBio: string
}

export interface BookPrintingPaper {
  color: 'cream' | 'white'
  ink: 'black'
  binding: 'perfect_bound'
}

export interface BookPrintingCover {
  authorName: string
  titleY: number
  authorY: number
  titleSize: number
  titleColor: string
  authorSize: number
  authorColor: string
  titleAlign: 'left' | 'center' | 'right'
  authorAlign: 'left' | 'center' | 'right'
  backText: string
  backTextColor: string
  coverOpacity: number
  isbn: string
  showBarcode: boolean
}

/**
 * The full saved printing. Metadata (id, manuscriptId, userId,
 * versionNumber, draftLabel, timestamps) lives at the top level;
 * nested groups mirror the wizard's UI sections so the client doesn't
 * need a separate translation pass.
 */
export interface BookPrinting {
  id: string
  manuscriptId: string
  userId: string
  versionNumber: number
  draftLabel: string

  profileName: string
  trimSize: BookPrintingTrimSize
  margins: BookPrintingMargins
  typography: BookPrintingTypography
  paragraphs: BookPrintingParagraphs
  chapters: BookPrintingChapters
  sceneBreaks: BookPrintingSceneBreaks
  headersAndFooters: BookPrintingHeadersFooters
  frontMatter: BookPrintingFrontMatterKey[]
  backMatter: BookPrintingBackMatterKey[]
  matterContent: BookPrintingMatterContent
  paper: BookPrintingPaper
  cover: BookPrintingCover

  createdAt: string
  updatedAt: string
}

/**
 * Listing summary for the drafts picker — drops the large body/matter
 * content fields, keeping just what the dropdown needs.
 */
export interface BookPrintingSummary {
  id: string
  manuscriptId: string
  userId: string
  versionNumber: number
  draftLabel: string
  profileName: string
  createdAt: string
  updatedAt: string
}

/**
 * Input shape for create/update. Same as the persisted BookPrinting
 * minus the server-assigned fields (id, manuscriptId, userId,
 * createdAt, updatedAt). draftLabel and versionNumber are both optional:
 *   - draftLabel — user-chosen name; defaults to '' (no label).
 *   - versionNumber — user-chosen integer; on create, defaults to
 *     maxVersion + 1 server-side. On update, omitting it keeps the
 *     current row's version_number unchanged.
 * The server enforces uniqueness of (manuscriptId, userId,
 * versionNumber) and returns 400 if a chosen number collides.
 */
export interface BookPrintingInput {
  draftLabel?: string
  versionNumber?: number
  profileName: string
  trimSize: BookPrintingTrimSize
  margins: BookPrintingMargins
  typography: BookPrintingTypography
  paragraphs: BookPrintingParagraphs
  chapters: BookPrintingChapters
  sceneBreaks: BookPrintingSceneBreaks
  headersAndFooters: BookPrintingHeadersFooters
  frontMatter: BookPrintingFrontMatterKey[]
  backMatter: BookPrintingBackMatterKey[]
  matterContent: BookPrintingMatterContent
  paper: BookPrintingPaper
  cover: BookPrintingCover
}
