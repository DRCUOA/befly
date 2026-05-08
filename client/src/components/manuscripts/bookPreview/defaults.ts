// Defaults, option lists, and the canonical Modern Trade Paperback Fiction
// profile. The numbers here come straight from the spec's
// `default_paperback_profile`. Anything that should be tweakable by the user
// lives in this module rather than scattered through the UI.

import type {
  BackMatterKey,
  FrontMatterKey,
  MatterContent,
  PreviewConfig,
  TrimSize,
  WizardStepId,
} from './types'

export const TRIM_SIZE_OPTIONS: TrimSize[] = [
  { label: 'Mass-market paperback', width: 4.25, height: 6.87, unit: 'in' },
  { label: 'Trade paperback', width: 5, height: 8, unit: 'in' },
  { label: 'Standard trade paperback', width: 5.25, height: 8, unit: 'in' },
  { label: 'Large trade paperback', width: 5.5, height: 8.5, unit: 'in' },
  { label: 'UK/Commonwealth B-format', width: 129, height: 198, unit: 'mm' },
]

export const BODY_FONT_OPTIONS = [
  'Garamond',
  'Minion Pro',
  'Caslon',
  'Georgia',
  'Baskerville',
  'Palatino',
] as const

export const FONT_SIZE_RANGE = { min: 10, max: 11.5, step: 0.25 }
export const LINE_HEIGHT_RANGE = { min: 12, max: 14, step: 0.25 }

export const FIRST_INDENT_RANGE = { min: 0.2, max: 0.3, step: 0.01 }
export const PARAGRAPH_SPACING_RANGE = { min: 0, max: 6, step: 0.5 }

export const TOP_MARGIN_RANGE = { min: 0.5, max: 0.9, step: 0.01 }
export const BOTTOM_MARGIN_RANGE = { min: 0.6, max: 1.0, step: 0.01 }
export const OUTSIDE_MARGIN_RANGE = { min: 0.5, max: 0.85, step: 0.01 }
export const INSIDE_GUTTER_RANGE = { min: 0.65, max: 1.1, step: 0.01 }

export const FRONT_MATTER_OPTIONS: { key: FrontMatterKey; label: string; description: string }[] = [
  { key: 'half_title', label: 'Half-title page', description: 'A simple page with just the book title.' },
  { key: 'also_by_author', label: 'Also by author', description: 'A list of the author’s other books.' },
  { key: 'title_page', label: 'Title page', description: 'Title, subtitle, author, publisher.' },
  { key: 'copyright_page', label: 'Copyright page', description: 'Imprint, ISBN, copyright notice.' },
  { key: 'dedication', label: 'Dedication', description: 'Short dedication, set in italics.' },
  { key: 'epigraph', label: 'Epigraph', description: 'A short quotation that opens the book.' },
  { key: 'contents', label: 'Contents', description: 'Optional. Common when chapters have titles.' },
]

export const BACK_MATTER_OPTIONS: { key: BackMatterKey; label: string; description: string }[] = [
  { key: 'acknowledgements', label: 'Acknowledgements', description: 'Thanks and credits.' },
  { key: 'author_note', label: 'Author’s note', description: 'Optional remarks on writing the book.' },
  { key: 'discussion_questions', label: 'Discussion questions', description: 'Book-club prompts.' },
  { key: 'also_by_author', label: 'Also by author', description: 'A list of the author’s other books.' },
  { key: 'preview_chapter', label: 'Preview chapter', description: 'A teaser for the next book.' },
  { key: 'author_bio', label: 'About the author', description: 'A short biography.' },
]

export const WIZARD_STEPS: { id: WizardStepId; title: string; description: string }[] = [
  { id: 'manuscript', title: 'Manuscript', description: 'Pick which sections and items become chapters.' },
  { id: 'trim_size', title: 'Trim Size', description: 'Choose the physical paperback size.' },
  { id: 'margins', title: 'Margins & Gutter', description: 'Page margins and binding allowance.' },
  { id: 'typography', title: 'Typography', description: 'Body type for paperback fiction.' },
  { id: 'paragraphs', title: 'Paragraphs', description: 'Indentation and spacing rules.' },
  { id: 'chapters', title: 'Chapter Openings', description: 'How each chapter begins.' },
  { id: 'scene_breaks', title: 'Scene Breaks', description: 'Marks between scenes.' },
  { id: 'headers_footers', title: 'Headers & Page Numbers', description: 'Running headers and folios.' },
  { id: 'front_back_matter', title: 'Front & Back Matter', description: 'Pages around the main story.' },
  { id: 'paper_and_print', title: 'Paper & Print Feel', description: 'Paper colour and binding.' },
  { id: 'cover', title: 'Covers', description: 'Front and back cover artwork (optional).' },
  { id: 'quality_checks', title: 'Quality Checks', description: 'Detect common print problems.' },
  { id: 'summary', title: 'Summary & Export', description: 'Review, save, print, export.' },
]

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'cfg-' + Math.random().toString(36).slice(2, 12)
}

/**
 * The canonical "Modern Trade Paperback Fiction" profile. Use this as the
 * starting point for any new configuration and as the target of the
 * "Reset to Paperback Defaults" action.
 */
export function defaultPaperbackProfile(projectId: string): PreviewConfig {
  const now = new Date().toISOString()
  return {
    id: newId(),
    projectId,
    profileName: 'Modern Trade Paperback Fiction',
    trimSize: { label: 'Standard trade paperback', width: 5.25, height: 8, unit: 'in' },
    margins: { top: 0.65, bottom: 0.75, outside: 0.65, insideGutter: 0.8, unit: 'in' },
    typography: {
      bodyFont: 'Garamond',
      fontSize: 11,
      lineHeight: 13,
      alignment: 'justified',
      hyphenation: true,
    },
    paragraphs: {
      firstLineIndent: 0.25,
      paragraphSpacing: 0,
      removeIndentAfterChapterHeading: true,
      removeIndentAfterSceneBreak: true,
    },
    chapters: {
      chapterStart: 'new_page',
      chapterTitleStyle: 'chapter_word_number',
      chapterOpeningPosition: 'upper_third',
      dropCap: false,
      smallCapsOpening: false,
    },
    sceneBreaks: { style: 'centered_asterisks', symbol: '* * *' },
    headersAndFooters: {
      runningHeaders: true,
      leftPageHeader: 'author_name',
      rightPageHeader: 'book_title',
      pageNumberPosition: 'bottom_center',
      suppressHeaderOnChapterOpenings: true,
    },
    frontMatter: ['half_title', 'title_page', 'copyright_page', 'dedication'],
    backMatter: ['acknowledgements', 'author_bio'],
    matterContent: emptyMatterContent(),
    paper: { color: 'cream', ink: 'black', binding: 'perfect_bound' },
    cover: {
      authorName: '',
      titleY: 38,
      authorY: 82,
      titleSize: 26,
      titleColor: '#f4ecdd',
      authorSize: 16,
      authorColor: '#f4ecdd',
      titleAlign: 'center',
      authorAlign: 'center',
      backText: '',
      backTextColor: '#f4ecdd',
      coverOpacity: 0.85,
      isbn: '',
      showBarcode: true,
    },
    createdAt: now,
    updatedAt: now,
  }
}

/** A fresh blank-string MatterContent used by the default profile and as a
 *  back-fill when loading an older saved configuration that didn't carry it. */
export function emptyMatterContent(): MatterContent {
  return {
    alsoByFront: '',
    dedication: '',
    epigraph: '',
    epigraphAttribution: '',
    acknowledgements: '',
    authorNote: '',
    discussionQuestions: '',
    alsoByBack: '',
    previewChapter: '',
    authorBio: '',
  }
}

/** Translate trim-size dimensions to inches regardless of stored unit. */
export function trimInches(t: TrimSize): { width: number; height: number } {
  if (t.unit === 'in') return { width: t.width, height: t.height }
  // mm -> in
  return { width: t.width / 25.4, height: t.height / 25.4 }
}
