-- Migration 025: Book printings (saved book-preview wizard configurations)
--
-- One row per saved "printing" of a manuscript's book-preview wizard
-- configuration. Each printing is owned by a user (the writer driving the
-- wizard), scoped to one manuscript, and identified within that scope by
-- a user-defined version_number (1, 2, 3, ...) and an optional draft_label.
--
-- Previously the wizard kept its entire PreviewConfig as a JSON blob in
-- localStorage. This table replaces that with a flat relational schema:
-- one column per setting, so the rows are queryable, the enums are
-- enforced at the DB layer, and we can support multiple drafts/versions
-- per (manuscript, user) without an opaque JSON column.
--
-- Cascade rules:
--   - users.delete      → cascade to book_printings
--   - manuscript.delete → cascade to book_printings

CREATE TABLE IF NOT EXISTS book_printings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id   UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- User-facing version of the printing. Server assigns the next integer
  -- per (manuscript_id, user_id) on create; the user may also rename a
  -- printing via draft_label without changing this number.
  version_number  INTEGER NOT NULL,
  draft_label     VARCHAR(120) NOT NULL DEFAULT '',

  profile_name    VARCHAR(120) NOT NULL DEFAULT 'Modern Trade Paperback Fiction',

  -- Trim size
  trim_label      VARCHAR(120) NOT NULL,
  trim_width      NUMERIC(7,3) NOT NULL,
  trim_height     NUMERIC(7,3) NOT NULL,
  trim_unit       VARCHAR(4)   NOT NULL,

  -- Margins (always inches in the wizard model)
  margin_top            NUMERIC(5,3) NOT NULL,
  margin_bottom         NUMERIC(5,3) NOT NULL,
  margin_outside        NUMERIC(5,3) NOT NULL,
  margin_inside_gutter  NUMERIC(5,3) NOT NULL,

  -- Typography
  body_font       VARCHAR(120) NOT NULL,
  font_size       NUMERIC(5,2) NOT NULL,
  line_height     NUMERIC(5,2) NOT NULL,
  text_alignment  VARCHAR(16)  NOT NULL,
  hyphenation     BOOLEAN      NOT NULL,

  -- Paragraphs
  first_line_indent                  NUMERIC(5,3) NOT NULL,
  paragraph_spacing                  NUMERIC(5,2) NOT NULL,
  remove_indent_after_chapter_heading BOOLEAN NOT NULL,
  remove_indent_after_scene_break     BOOLEAN NOT NULL,

  -- Chapters
  chapter_start              VARCHAR(32) NOT NULL,
  chapter_title_style        VARCHAR(32) NOT NULL,
  chapter_opening_position   VARCHAR(32) NOT NULL,
  chapter_drop_cap           BOOLEAN     NOT NULL,
  chapter_small_caps_opening BOOLEAN     NOT NULL,
  chapters_from_items        BOOLEAN     NOT NULL,

  -- Scene breaks
  scene_break_style   VARCHAR(32) NOT NULL,
  scene_break_symbol  VARCHAR(64) NOT NULL,

  -- Headers & footers
  running_headers                      BOOLEAN     NOT NULL,
  left_page_header                     VARCHAR(32) NOT NULL,
  right_page_header                    VARCHAR(32) NOT NULL,
  page_number_position                 VARCHAR(32) NOT NULL,
  suppress_header_on_chapter_openings  BOOLEAN     NOT NULL,

  -- Matter selections (arrays of enum-like keys)
  front_matter  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  back_matter   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Matter content (editable bodies for the front/back-matter pages)
  mc_also_by_front          TEXT NOT NULL DEFAULT '',
  mc_dedication             TEXT NOT NULL DEFAULT '',
  mc_epigraph               TEXT NOT NULL DEFAULT '',
  mc_epigraph_attribution   TEXT NOT NULL DEFAULT '',
  mc_acknowledgements       TEXT NOT NULL DEFAULT '',
  mc_author_note            TEXT NOT NULL DEFAULT '',
  mc_discussion_questions   TEXT NOT NULL DEFAULT '',
  mc_also_by_back           TEXT NOT NULL DEFAULT '',
  mc_preview_chapter        TEXT NOT NULL DEFAULT '',
  mc_author_bio             TEXT NOT NULL DEFAULT '',

  -- Paper & print
  paper_color    VARCHAR(16) NOT NULL,
  paper_ink      VARCHAR(16) NOT NULL DEFAULT 'black',
  paper_binding  VARCHAR(32) NOT NULL DEFAULT 'perfect_bound',

  -- Cover
  cover_author_name      VARCHAR(255) NOT NULL DEFAULT '',
  cover_title_y          NUMERIC(5,2) NOT NULL,
  cover_author_y         NUMERIC(5,2) NOT NULL,
  cover_title_size       NUMERIC(5,2) NOT NULL,
  cover_title_color      VARCHAR(16)  NOT NULL,
  cover_author_size      NUMERIC(5,2) NOT NULL,
  cover_author_color     VARCHAR(16)  NOT NULL,
  cover_title_align      VARCHAR(8)   NOT NULL,
  cover_author_align     VARCHAR(8)   NOT NULL,
  cover_back_text        TEXT         NOT NULL DEFAULT '',
  cover_back_text_color  VARCHAR(16)  NOT NULL,
  cover_opacity          NUMERIC(4,3) NOT NULL,
  cover_isbn             VARCHAR(32)  NOT NULL DEFAULT '',
  cover_show_barcode     BOOLEAN      NOT NULL DEFAULT TRUE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each (manuscript, user) numbers its drafts independently. Allows two
  -- writers on a shared manuscript to each have their own v1, v2, etc.
  CONSTRAINT uq_book_printings_version
    UNIQUE (manuscript_id, user_id, version_number),

  CONSTRAINT check_book_printings_version_positive
    CHECK (version_number >= 1),
  CONSTRAINT check_book_printings_trim_unit
    CHECK (trim_unit IN ('in', 'mm')),
  CONSTRAINT check_book_printings_text_alignment
    CHECK (text_alignment IN ('justified', 'left')),
  CONSTRAINT check_book_printings_chapter_start
    CHECK (chapter_start IN ('new_page', 'right_hand_page')),
  CONSTRAINT check_book_printings_chapter_title_style
    CHECK (chapter_title_style IN ('chapter_number', 'chapter_word_number', 'title_only', 'number_and_title')),
  CONSTRAINT check_book_printings_chapter_opening_position
    CHECK (chapter_opening_position IN ('top', 'upper_third', 'centered_high')),
  CONSTRAINT check_book_printings_scene_break_style
    CHECK (scene_break_style IN ('blank_line', 'centered_asterisks', 'centered_symbol')),
  CONSTRAINT check_book_printings_left_page_header
    CHECK (left_page_header IN ('author_name', 'book_title', 'none')),
  CONSTRAINT check_book_printings_right_page_header
    CHECK (right_page_header IN ('book_title', 'author_name', 'chapter_title', 'none')),
  CONSTRAINT check_book_printings_page_number_position
    CHECK (page_number_position IN ('bottom_center', 'outer_top', 'outer_bottom')),
  CONSTRAINT check_book_printings_paper_color
    CHECK (paper_color IN ('cream', 'white')),
  CONSTRAINT check_book_printings_cover_title_align
    CHECK (cover_title_align IN ('left', 'center', 'right')),
  CONSTRAINT check_book_printings_cover_author_align
    CHECK (cover_author_align IN ('left', 'center', 'right'))
);

CREATE INDEX IF NOT EXISTS idx_book_printings_manuscript_user
  ON book_printings(manuscript_id, user_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_book_printings_updated
  ON book_printings(manuscript_id, user_id, updated_at DESC);

COMMENT ON TABLE book_printings IS
  'Saved book-preview wizard configurations. One row per (manuscript, user, version).';
COMMENT ON COLUMN book_printings.version_number IS
  'User-facing draft number, unique per (manuscript, user). Server auto-increments on create.';
COMMENT ON COLUMN book_printings.draft_label IS
  'Optional human label for the printing (e.g. "First galley", "Final"). Empty string when unset.';
