// Book Preview Wizard — data model.
//
// These types implement the configuration_object and supporting shapes from
// the project's "Printed Book Preview Wizard" specification. The default
// profile, option lists, and validation logic live in sibling modules.

export type LengthInUnit = 'in' | 'mm'

export interface TrimSize {
  /** Human-readable label, e.g. "Standard trade paperback". */
  label: string
  /** Width in `unit`. */
  width: number
  /** Height in `unit`. */
  height: number
  unit: LengthInUnit
}

export interface MarginsConfig {
  /** Top margin in inches. */
  top: number
  /** Bottom margin in inches. */
  bottom: number
  /** Outer (away-from-spine) margin in inches. */
  outside: number
  /** Inner (toward-spine) gutter in inches. */
  insideGutter: number
  /** Stored unit. Always 'in' for the default paperback profile. */
  unit: 'in'
}

export interface TypographyConfig {
  /** Body font family name (e.g. "Garamond"). */
  bodyFont: string
  /** Body font size in points (10–11.5pt for paperback fiction). */
  fontSize: number
  /** Leading in points. Should exceed fontSize. */
  lineHeight: number
  alignment: 'justified' | 'left'
  hyphenation: boolean
}

export interface ParagraphsConfig {
  /** First-line indent in inches (0.2–0.3 typical). */
  firstLineIndent: number
  /** Vertical space between paragraphs in points. 0 for fiction. */
  paragraphSpacing: number
  removeIndentAfterChapterHeading: boolean
  removeIndentAfterSceneBreak: boolean
}

export type ChapterStart = 'new_page' | 'right_hand_page'
export type ChapterTitleStyle =
  | 'chapter_number'
  | 'chapter_word_number'
  | 'title_only'
  | 'number_and_title'
export type ChapterOpeningPosition = 'top' | 'upper_third' | 'centered_high'

export interface ChaptersConfig {
  chapterStart: ChapterStart
  chapterTitleStyle: ChapterTitleStyle
  chapterOpeningPosition: ChapterOpeningPosition
  dropCap: boolean
  smallCapsOpening: boolean
  /**
   * When true, every manuscript item (essay) becomes its own chapter with a
   * fresh page break and chapter heading. When false (legacy behaviour),
   * sections are chapters and items inside a section flow with scene
   * breaks between them. True is the default for essay collections, where
   * each piece stands alone.
   *
   * Phase 5 of the Configurable Spine Depth Refactor caveat: this
   * setting only applies when `chapterLayer === manuscript.spineDepth`
   * (the deepest layer). For shallower chapter layers the wizard
   * always treats each container at that layer as a chapter and
   * gathers descendant items as the chapter body — there is no
   * "essay-per-chapter" choice once you've stepped above the deepest
   * layer (because there's no 1:1 layer-to-essay mapping above it).
   */
  chaptersFromItems: boolean
  /**
   * Which spine layer becomes a chapter. 1-based; defaults to the
   * manuscript's spineDepth, so legacy depth-1 manuscripts use the
   * existing "section-as-chapter / item-as-chapter" code paths
   * verbatim and the wizard is byte-identical to before. Lower values
   * (e.g. 1 on a depth-2 manuscript) collapse the deeper levels into
   * each chapter's body.
   */
  chapterLayer: number
}

export type SceneBreakStyle =
  | 'blank_line'
  | 'centered_asterisks'
  | 'centered_symbol'

export interface SceneBreaksConfig {
  style: SceneBreakStyle
  /** Symbol used when style is centered_asterisks or centered_symbol. */
  symbol: string
}

export type LeftPageHeader = 'author_name' | 'book_title' | 'none'
export type RightPageHeader =
  | 'book_title'
  | 'author_name'
  | 'chapter_title'
  | 'none'
export type PageNumberPosition =
  | 'bottom_center'
  | 'outer_top'
  | 'outer_bottom'

export interface HeadersFootersConfig {
  runningHeaders: boolean
  leftPageHeader: LeftPageHeader
  rightPageHeader: RightPageHeader
  pageNumberPosition: PageNumberPosition
  suppressHeaderOnChapterOpenings: boolean
}

export type FrontMatterKey =
  | 'half_title'
  | 'also_by_author'
  | 'title_page'
  | 'copyright_page'
  | 'dedication'
  | 'epigraph'
  | 'contents'

export type BackMatterKey =
  | 'acknowledgements'
  | 'author_note'
  | 'discussion_questions'
  | 'also_by_author'
  | 'preview_chapter'
  | 'author_bio'

export interface PaperConfig {
  color: 'cream' | 'white'
  ink: 'black'
  binding: 'perfect_bound'
}

/**
 * Editable text bodies for the front- and back-matter sections. Each
 * key corresponds to a checkbox in the Front & Back Matter wizard step;
 * leaving a value empty produces a placeholder dash on the rendered page,
 * matching the convention used by trade-paperback templates.
 */
export interface MatterContent {
  /** Front matter — list of "Also by" titles, one per line. */
  alsoByFront: string
  /** Front matter — short dedication, set in italics. */
  dedication: string
  /** Front matter — quotation that opens the book. */
  epigraph: string
  /** Front matter — attribution for the epigraph. */
  epigraphAttribution: string
  /** Back matter — acknowledgements text. */
  acknowledgements: string
  /** Back matter — author note. */
  authorNote: string
  /** Back matter — discussion questions, one per line. */
  discussionQuestions: string
  /** Back matter — list of "Also by" titles, one per line. */
  alsoByBack: string
  /** Back matter — preview chapter teaser. */
  previewChapter: string
  /** Back matter — about-the-author bio. */
  authorBio: string
}

/**
 * Cover-design state. Not part of the spec's print-interior conventions, but
 * the application has historically supported a cover designer with title /
 * author position, colour and alignment, plus a back-cover blurb. We carry
 * those settings on the same configuration so the whole preview round-trips
 * as a single JSON object. The barcode/ISBN fields are new — the spoofed
 * ISBN is generated deterministically from the manuscript title.
 */
export interface CoverConfig {
  /** Author name shown on covers. Empty string disables. */
  authorName: string
  /** Title-block top, in % of cover height (vertical centre of the block). */
  titleY: number
  /** Author-block top, in % of cover height. */
  authorY: number
  titleSize: number
  titleColor: string
  authorSize: number
  authorColor: string
  titleAlign: 'left' | 'center' | 'right'
  authorAlign: 'left' | 'center' | 'right'
  /** Free-form blurb / quote / dedication for the back cover. */
  backText: string
  backTextColor: string
  /** 0–1 transparency of cover artwork over the base colour. */
  coverOpacity: number
  /** Spoofed 13-digit ISBN with hyphens. */
  isbn: string
  /** When true, render the EAN-13 barcode panel on the back cover. */
  showBarcode: boolean
}

/**
 * How the Contents page is rendered when the user enables the
 * `contents` front-matter key. 'flat' (the default and the
 * pre-Phase-5 behaviour) emits one numbered <ol> with each chapter as
 * a top-level <li>. 'hierarchical' walks the section tree from level
 * 1 down to `chapterLayer`, emitting nested <ol>s so a depth-2
 * manuscript's TOC reads e.g. "Part One → Chapter 1 / Chapter 2".
 *
 * Only meaningful when `chapterLayer > 1`; at chapterLayer=1 there's
 * only one level and the nested rendering collapses to identical
 * output anyway.
 */
export type TocStyle = 'flat' | 'hierarchical'

export interface PreviewConfig {
  id: string
  projectId: string
  profileName: string
  trimSize: TrimSize
  margins: MarginsConfig
  typography: TypographyConfig
  paragraphs: ParagraphsConfig
  chapters: ChaptersConfig
  sceneBreaks: SceneBreaksConfig
  headersAndFooters: HeadersFootersConfig
  frontMatter: FrontMatterKey[]
  backMatter: BackMatterKey[]
  matterContent: MatterContent
  paper: PaperConfig
  cover: CoverConfig
  /**
   * Contents-page rendering style. Defaults to 'flat' so legacy
   * configurations and the Phase 1 snapshot suite see no change.
   */
  tocStyle: TocStyle
  /** ISO-8601 timestamps. */
  createdAt: string
  updatedAt: string
}

export interface ValidationIssue {
  /** Dotted path of the field this issue applies to. */
  field: string
  message: string
}

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface QualityCheckResult {
  id: string
  label: string
  description: string
  /** Number of occurrences in the current pagination. */
  count: number
  /** 1-based page numbers where the issue was detected. */
  pages: number[]
}

/** Identifiers for each step in the wizard. Step 0 is "manuscript" — the
 *  app-specific "which sections / items become chapters" picker — and steps
 *  1..11 follow the spec exactly. The cover designer is step 12. */
export type WizardStepId =
  | 'manuscript'
  | 'trim_size'
  | 'margins'
  | 'typography'
  | 'paragraphs'
  | 'chapters'
  | 'scene_breaks'
  | 'headers_footers'
  | 'front_back_matter'
  | 'paper_and_print'
  | 'cover'
  | 'quality_checks'
  | 'summary'
