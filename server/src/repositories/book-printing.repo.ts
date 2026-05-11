/**
 * Book printing repository — DAO for book_printings.
 *
 * Each row is one saved book-preview wizard configuration for a
 * (manuscript, user) pair, identified within that scope by an integer
 * version_number. The repo flattens the nested wire shape into the
 * column-per-setting schema; callers always work with the nested
 * BookPrinting type.
 */
import { pool } from '../config/db.js'
import type {
  BookPrinting,
  BookPrintingInput,
  BookPrintingSummary,
} from '../models/BookPrinting.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'

interface BookPrintingRow {
  id: string
  manuscript_id: string
  user_id: string
  version_number: number
  draft_label: string
  profile_name: string
  trim_label: string
  trim_width: string | number
  trim_height: string | number
  trim_unit: 'in' | 'mm'
  margin_top: string | number
  margin_bottom: string | number
  margin_outside: string | number
  margin_inside_gutter: string | number
  body_font: string
  font_size: string | number
  line_height: string | number
  text_alignment: 'justified' | 'left'
  hyphenation: boolean
  first_line_indent: string | number
  paragraph_spacing: string | number
  remove_indent_after_chapter_heading: boolean
  remove_indent_after_scene_break: boolean
  chapter_start: string
  chapter_title_style: string
  chapter_opening_position: string
  chapter_drop_cap: boolean
  chapter_small_caps_opening: boolean
  chapters_from_items: boolean
  scene_break_style: string
  scene_break_symbol: string
  running_headers: boolean
  left_page_header: string
  right_page_header: string
  page_number_position: string
  suppress_header_on_chapter_openings: boolean
  front_matter: string[]
  back_matter: string[]
  mc_also_by_front: string
  mc_dedication: string
  mc_epigraph: string
  mc_epigraph_attribution: string
  mc_acknowledgements: string
  mc_author_note: string
  mc_discussion_questions: string
  mc_also_by_back: string
  mc_preview_chapter: string
  mc_author_bio: string
  paper_color: 'cream' | 'white'
  paper_ink: string
  paper_binding: string
  cover_author_name: string
  cover_title_y: string | number
  cover_author_y: string | number
  cover_title_size: string | number
  cover_title_color: string
  cover_author_size: string | number
  cover_author_color: string
  cover_title_align: string
  cover_author_align: string
  cover_back_text: string
  cover_back_text_color: string
  cover_opacity: string | number
  cover_isbn: string
  cover_show_barcode: boolean
  created_at: Date
  updated_at: Date
}

interface BookPrintingSummaryRow {
  id: string
  manuscript_id: string
  user_id: string
  version_number: number
  draft_label: string
  profile_name: string
  created_at: Date
  updated_at: Date
}

const SUMMARY_COLUMNS = `
  id,
  manuscript_id,
  user_id,
  version_number,
  draft_label,
  profile_name,
  created_at,
  updated_at
`

const ALL_COLUMNS = `
  id,
  manuscript_id,
  user_id,
  version_number,
  draft_label,
  profile_name,
  trim_label,
  trim_width,
  trim_height,
  trim_unit,
  margin_top,
  margin_bottom,
  margin_outside,
  margin_inside_gutter,
  body_font,
  font_size,
  line_height,
  text_alignment,
  hyphenation,
  first_line_indent,
  paragraph_spacing,
  remove_indent_after_chapter_heading,
  remove_indent_after_scene_break,
  chapter_start,
  chapter_title_style,
  chapter_opening_position,
  chapter_drop_cap,
  chapter_small_caps_opening,
  chapters_from_items,
  scene_break_style,
  scene_break_symbol,
  running_headers,
  left_page_header,
  right_page_header,
  page_number_position,
  suppress_header_on_chapter_openings,
  front_matter,
  back_matter,
  mc_also_by_front,
  mc_dedication,
  mc_epigraph,
  mc_epigraph_attribution,
  mc_acknowledgements,
  mc_author_note,
  mc_discussion_questions,
  mc_also_by_back,
  mc_preview_chapter,
  mc_author_bio,
  paper_color,
  paper_ink,
  paper_binding,
  cover_author_name,
  cover_title_y,
  cover_author_y,
  cover_title_size,
  cover_title_color,
  cover_author_size,
  cover_author_color,
  cover_title_align,
  cover_author_align,
  cover_back_text,
  cover_back_text_color,
  cover_opacity,
  cover_isbn,
  cover_show_barcode,
  created_at,
  updated_at
`

/** pg returns NUMERIC as string to preserve precision; the wire type is number. */
function num(v: string | number): number {
  return typeof v === 'number' ? v : Number(v)
}

function rowToPrinting(row: BookPrintingRow): BookPrinting {
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    userId: row.user_id,
    versionNumber: row.version_number,
    draftLabel: row.draft_label,
    profileName: row.profile_name,
    trimSize: {
      label: row.trim_label,
      width: num(row.trim_width),
      height: num(row.trim_height),
      unit: row.trim_unit,
    },
    margins: {
      top: num(row.margin_top),
      bottom: num(row.margin_bottom),
      outside: num(row.margin_outside),
      insideGutter: num(row.margin_inside_gutter),
    },
    typography: {
      bodyFont: row.body_font,
      fontSize: num(row.font_size),
      lineHeight: num(row.line_height),
      alignment: row.text_alignment,
      hyphenation: row.hyphenation,
    },
    paragraphs: {
      firstLineIndent: num(row.first_line_indent),
      paragraphSpacing: num(row.paragraph_spacing),
      removeIndentAfterChapterHeading: row.remove_indent_after_chapter_heading,
      removeIndentAfterSceneBreak: row.remove_indent_after_scene_break,
    },
    chapters: {
      chapterStart: row.chapter_start as BookPrinting['chapters']['chapterStart'],
      chapterTitleStyle: row.chapter_title_style as BookPrinting['chapters']['chapterTitleStyle'],
      chapterOpeningPosition: row.chapter_opening_position as BookPrinting['chapters']['chapterOpeningPosition'],
      dropCap: row.chapter_drop_cap,
      smallCapsOpening: row.chapter_small_caps_opening,
      chaptersFromItems: row.chapters_from_items,
    },
    sceneBreaks: {
      style: row.scene_break_style as BookPrinting['sceneBreaks']['style'],
      symbol: row.scene_break_symbol,
    },
    headersAndFooters: {
      runningHeaders: row.running_headers,
      leftPageHeader: row.left_page_header as BookPrinting['headersAndFooters']['leftPageHeader'],
      rightPageHeader: row.right_page_header as BookPrinting['headersAndFooters']['rightPageHeader'],
      pageNumberPosition: row.page_number_position as BookPrinting['headersAndFooters']['pageNumberPosition'],
      suppressHeaderOnChapterOpenings: row.suppress_header_on_chapter_openings,
    },
    frontMatter: row.front_matter as BookPrinting['frontMatter'],
    backMatter: row.back_matter as BookPrinting['backMatter'],
    matterContent: {
      alsoByFront: row.mc_also_by_front,
      dedication: row.mc_dedication,
      epigraph: row.mc_epigraph,
      epigraphAttribution: row.mc_epigraph_attribution,
      acknowledgements: row.mc_acknowledgements,
      authorNote: row.mc_author_note,
      discussionQuestions: row.mc_discussion_questions,
      alsoByBack: row.mc_also_by_back,
      previewChapter: row.mc_preview_chapter,
      authorBio: row.mc_author_bio,
    },
    paper: {
      color: row.paper_color,
      ink: 'black',
      binding: 'perfect_bound',
    },
    cover: {
      authorName: row.cover_author_name,
      titleY: num(row.cover_title_y),
      authorY: num(row.cover_author_y),
      titleSize: num(row.cover_title_size),
      titleColor: row.cover_title_color,
      authorSize: num(row.cover_author_size),
      authorColor: row.cover_author_color,
      titleAlign: row.cover_title_align as BookPrinting['cover']['titleAlign'],
      authorAlign: row.cover_author_align as BookPrinting['cover']['authorAlign'],
      backText: row.cover_back_text,
      backTextColor: row.cover_back_text_color,
      coverOpacity: num(row.cover_opacity),
      isbn: row.cover_isbn,
      showBarcode: row.cover_show_barcode,
    },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function summaryRowTo(row: BookPrintingSummaryRow): BookPrintingSummary {
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    userId: row.user_id,
    versionNumber: row.version_number,
    draftLabel: row.draft_label,
    profileName: row.profile_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export const bookPrintingRepo = {
  async listForManuscript(
    manuscriptId: string,
    userId: string
  ): Promise<BookPrintingSummary[]> {
    const r = await pool.query<BookPrintingSummaryRow>(
      `SELECT ${SUMMARY_COLUMNS}
         FROM book_printings
        WHERE manuscript_id = $1 AND user_id = $2
        ORDER BY version_number DESC`,
      [manuscriptId, userId]
    )
    return r.rows.map(summaryRowTo)
  },

  async findById(printingId: string, userId: string): Promise<BookPrinting> {
    const r = await pool.query<BookPrintingRow>(
      `SELECT ${ALL_COLUMNS} FROM book_printings WHERE id = $1`,
      [printingId]
    )
    if (r.rows.length === 0) throw new NotFoundError('Printing not found')
    const row = r.rows[0]
    // Printings are private to their creator. Even if the manuscript is
    // shared, another user's saved drafts are theirs alone.
    if (row.user_id !== userId) throw new NotFoundError('Printing not found')
    return rowToPrinting(row)
  },

  /** Highest current version_number for (manuscript, user), or 0 if none. */
  async maxVersion(manuscriptId: string, userId: string): Promise<number> {
    const r = await pool.query<{ max: number | null }>(
      `SELECT COALESCE(MAX(version_number), 0)::int AS max
         FROM book_printings
        WHERE manuscript_id = $1 AND user_id = $2`,
      [manuscriptId, userId]
    )
    return r.rows[0]?.max ?? 0
  },

  /**
   * True if some other row already claims this version number for the
   * (manuscript, user). `excludePrintingId` lets an update keep its
   * own number without colliding with itself.
   */
  async versionInUse(
    manuscriptId: string,
    userId: string,
    versionNumber: number,
    excludePrintingId?: string
  ): Promise<boolean> {
    const params: unknown[] = [manuscriptId, userId, versionNumber]
    let sql = `SELECT 1 FROM book_printings
                WHERE manuscript_id = $1 AND user_id = $2 AND version_number = $3`
    if (excludePrintingId) {
      params.push(excludePrintingId)
      sql += ` AND id <> $4`
    }
    sql += ` LIMIT 1`
    const r = await pool.query(sql, params)
    return r.rows.length > 0
  },

  async create(input: {
    manuscriptId: string
    userId: string
    versionNumber: number
    data: BookPrintingInput
  }): Promise<BookPrinting> {
    const d = input.data
    const r = await pool.query<BookPrintingRow>(
      `INSERT INTO book_printings (
        manuscript_id, user_id, version_number, draft_label, profile_name,
        trim_label, trim_width, trim_height, trim_unit,
        margin_top, margin_bottom, margin_outside, margin_inside_gutter,
        body_font, font_size, line_height, text_alignment, hyphenation,
        first_line_indent, paragraph_spacing,
        remove_indent_after_chapter_heading, remove_indent_after_scene_break,
        chapter_start, chapter_title_style, chapter_opening_position,
        chapter_drop_cap, chapter_small_caps_opening, chapters_from_items,
        scene_break_style, scene_break_symbol,
        running_headers, left_page_header, right_page_header,
        page_number_position, suppress_header_on_chapter_openings,
        front_matter, back_matter,
        mc_also_by_front, mc_dedication, mc_epigraph, mc_epigraph_attribution,
        mc_acknowledgements, mc_author_note, mc_discussion_questions,
        mc_also_by_back, mc_preview_chapter, mc_author_bio,
        paper_color, paper_ink, paper_binding,
        cover_author_name, cover_title_y, cover_author_y,
        cover_title_size, cover_title_color,
        cover_author_size, cover_author_color,
        cover_title_align, cover_author_align,
        cover_back_text, cover_back_text_color,
        cover_opacity, cover_isbn, cover_show_barcode
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20,
        $21, $22,
        $23, $24, $25,
        $26, $27, $28,
        $29, $30,
        $31, $32, $33,
        $34, $35,
        $36::text[], $37::text[],
        $38, $39, $40, $41,
        $42, $43, $44,
        $45, $46, $47,
        $48, $49, $50,
        $51, $52, $53,
        $54, $55,
        $56, $57,
        $58, $59,
        $60, $61,
        $62, $63, $64
      ) RETURNING ${ALL_COLUMNS}`,
      [
        input.manuscriptId, input.userId, input.versionNumber,
        d.draftLabel ?? '', d.profileName,
        d.trimSize.label, d.trimSize.width, d.trimSize.height, d.trimSize.unit,
        d.margins.top, d.margins.bottom, d.margins.outside, d.margins.insideGutter,
        d.typography.bodyFont, d.typography.fontSize, d.typography.lineHeight,
        d.typography.alignment, d.typography.hyphenation,
        d.paragraphs.firstLineIndent, d.paragraphs.paragraphSpacing,
        d.paragraphs.removeIndentAfterChapterHeading,
        d.paragraphs.removeIndentAfterSceneBreak,
        d.chapters.chapterStart, d.chapters.chapterTitleStyle,
        d.chapters.chapterOpeningPosition,
        d.chapters.dropCap, d.chapters.smallCapsOpening,
        d.chapters.chaptersFromItems,
        d.sceneBreaks.style, d.sceneBreaks.symbol,
        d.headersAndFooters.runningHeaders,
        d.headersAndFooters.leftPageHeader,
        d.headersAndFooters.rightPageHeader,
        d.headersAndFooters.pageNumberPosition,
        d.headersAndFooters.suppressHeaderOnChapterOpenings,
        d.frontMatter, d.backMatter,
        d.matterContent.alsoByFront, d.matterContent.dedication,
        d.matterContent.epigraph, d.matterContent.epigraphAttribution,
        d.matterContent.acknowledgements, d.matterContent.authorNote,
        d.matterContent.discussionQuestions,
        d.matterContent.alsoByBack, d.matterContent.previewChapter,
        d.matterContent.authorBio,
        d.paper.color, d.paper.ink, d.paper.binding,
        d.cover.authorName, d.cover.titleY, d.cover.authorY,
        d.cover.titleSize, d.cover.titleColor,
        d.cover.authorSize, d.cover.authorColor,
        d.cover.titleAlign, d.cover.authorAlign,
        d.cover.backText, d.cover.backTextColor,
        d.cover.coverOpacity, d.cover.isbn, d.cover.showBarcode,
      ]
    )
    return rowToPrinting(r.rows[0])
  },

  async update(
    printingId: string,
    userId: string,
    data: BookPrintingInput,
    versionNumberOverride?: number
  ): Promise<BookPrinting> {
    // Verify ownership before overwriting.
    await this.findById(printingId, userId)
    const d = data
    const r = await pool.query<BookPrintingRow>(
      `UPDATE book_printings SET
         ${versionNumberOverride !== undefined ? 'version_number = $63,' : ''}
         draft_label = $2,
         profile_name = $3,
         trim_label = $4, trim_width = $5, trim_height = $6, trim_unit = $7,
         margin_top = $8, margin_bottom = $9, margin_outside = $10, margin_inside_gutter = $11,
         body_font = $12, font_size = $13, line_height = $14,
         text_alignment = $15, hyphenation = $16,
         first_line_indent = $17, paragraph_spacing = $18,
         remove_indent_after_chapter_heading = $19,
         remove_indent_after_scene_break = $20,
         chapter_start = $21, chapter_title_style = $22, chapter_opening_position = $23,
         chapter_drop_cap = $24, chapter_small_caps_opening = $25, chapters_from_items = $26,
         scene_break_style = $27, scene_break_symbol = $28,
         running_headers = $29, left_page_header = $30, right_page_header = $31,
         page_number_position = $32, suppress_header_on_chapter_openings = $33,
         front_matter = $34::text[], back_matter = $35::text[],
         mc_also_by_front = $36, mc_dedication = $37,
         mc_epigraph = $38, mc_epigraph_attribution = $39,
         mc_acknowledgements = $40, mc_author_note = $41,
         mc_discussion_questions = $42, mc_also_by_back = $43,
         mc_preview_chapter = $44, mc_author_bio = $45,
         paper_color = $46, paper_ink = $47, paper_binding = $48,
         cover_author_name = $49, cover_title_y = $50, cover_author_y = $51,
         cover_title_size = $52, cover_title_color = $53,
         cover_author_size = $54, cover_author_color = $55,
         cover_title_align = $56, cover_author_align = $57,
         cover_back_text = $58, cover_back_text_color = $59,
         cover_opacity = $60, cover_isbn = $61, cover_show_barcode = $62,
         updated_at = NOW()
       WHERE id = $1
       RETURNING ${ALL_COLUMNS}`,
      [
        printingId,
        d.draftLabel ?? '', d.profileName,
        d.trimSize.label, d.trimSize.width, d.trimSize.height, d.trimSize.unit,
        d.margins.top, d.margins.bottom, d.margins.outside, d.margins.insideGutter,
        d.typography.bodyFont, d.typography.fontSize, d.typography.lineHeight,
        d.typography.alignment, d.typography.hyphenation,
        d.paragraphs.firstLineIndent, d.paragraphs.paragraphSpacing,
        d.paragraphs.removeIndentAfterChapterHeading,
        d.paragraphs.removeIndentAfterSceneBreak,
        d.chapters.chapterStart, d.chapters.chapterTitleStyle,
        d.chapters.chapterOpeningPosition,
        d.chapters.dropCap, d.chapters.smallCapsOpening,
        d.chapters.chaptersFromItems,
        d.sceneBreaks.style, d.sceneBreaks.symbol,
        d.headersAndFooters.runningHeaders,
        d.headersAndFooters.leftPageHeader,
        d.headersAndFooters.rightPageHeader,
        d.headersAndFooters.pageNumberPosition,
        d.headersAndFooters.suppressHeaderOnChapterOpenings,
        d.frontMatter, d.backMatter,
        d.matterContent.alsoByFront, d.matterContent.dedication,
        d.matterContent.epigraph, d.matterContent.epigraphAttribution,
        d.matterContent.acknowledgements, d.matterContent.authorNote,
        d.matterContent.discussionQuestions,
        d.matterContent.alsoByBack, d.matterContent.previewChapter,
        d.matterContent.authorBio,
        d.paper.color, d.paper.ink, d.paper.binding,
        d.cover.authorName, d.cover.titleY, d.cover.authorY,
        d.cover.titleSize, d.cover.titleColor,
        d.cover.authorSize, d.cover.authorColor,
        d.cover.titleAlign, d.cover.authorAlign,
        d.cover.backText, d.cover.backTextColor,
        d.cover.coverOpacity, d.cover.isbn, d.cover.showBarcode,
        ...(versionNumberOverride !== undefined ? [versionNumberOverride] : []),
      ]
    )
    return rowToPrinting(r.rows[0])
  },

  async delete(printingId: string, userId: string): Promise<void> {
    const owner = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM book_printings WHERE id = $1`,
      [printingId]
    )
    if (owner.rows.length === 0) throw new NotFoundError('Printing not found')
    if (owner.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized')
    }
    await pool.query(`DELETE FROM book_printings WHERE id = $1`, [printingId])
  },
}
