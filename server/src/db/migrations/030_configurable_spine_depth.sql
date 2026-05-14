-- Migration 030: Configurable spine depth (Phase 2 of the Configurable
-- Spine Depth Refactor — schema only, no UI exposure yet)
--
-- Today the manuscript spine is fixed at two container levels:
--   SPINE → SECTION → ITEM
-- Users with longer-form books (memoir parts, essay-collection chapters
-- of essays) need configurable depth, e.g.:
--   SPINE → PART → CHAPTER → SECTION → ITEM   (depth 3)
--
-- This migration introduces:
--
--   1. manuscript_sections.parent_section_id  — self-reference so sections
--      can nest inside other sections. NULL means "top of the spine".
--      ON DELETE CASCADE so removing a container cleans up its descendants
--      atomically (the service layer offers a softer flatten-to-grandparent
--      flow for the user; the FK is a backstop, not the policy).
--
--   2. manuscript_sections.level  — 1..4. The number of container layers
--      from the root. Denormalised from parent_section_id so the Book
--      Room and renderer can paginate without recursive joins, and so
--      "items only attach to deepest level" can be checked with a single
--      column lookup.
--
--   3. manuscript_projects.spine_depth  — 1..4. The configured depth of
--      THIS manuscript's spine. All existing rows backfill to 1 (today's
--      behaviour).
--
--   4. manuscript_projects.spine_layer_labels  — JSONB array of human
--      labels for each layer, e.g. ["Part", "Chapter", "Section"] for a
--      depth-3 manuscript. Default `["Section"]` mirrors today's UI
--      language exactly.
--
--   5. book_printings.chapter_layer  — which spine level becomes a chapter
--      in the book preview wizard. Defaults to 1 (today's "top-level
--      sections become chapters"); Phase 5 will let users pick.
--
--   6. book_printings.toc_style  — 'flat' (today) or 'hierarchical'
--      (Phase 5). Defaults to 'flat' so existing printings render
--      identically.
--
-- All additions are NULL-safe / defaulted at the column level so the
-- migration is idempotent and existing rows backfill in place; no UPDATE
-- is required.

-- ---------- 1. Section tree: parent_section_id + level ----------

ALTER TABLE manuscript_sections
  ADD COLUMN IF NOT EXISTS parent_section_id UUID
    REFERENCES manuscript_sections(id) ON DELETE CASCADE;

ALTER TABLE manuscript_sections
  ADD COLUMN IF NOT EXISTS level SMALLINT NOT NULL DEFAULT 1;

-- A section's level is bounded by the max permitted depth (4). Items live
-- below the deepest section, so the deepest container is level 4, not
-- level 5 (items aren't sections).
ALTER TABLE manuscript_sections
  DROP CONSTRAINT IF EXISTS check_manuscript_section_level;
ALTER TABLE manuscript_sections
  ADD CONSTRAINT check_manuscript_section_level
    CHECK (level >= 1 AND level <= 4);

-- A section cannot be its own parent; that would short-circuit any tree
-- walk into an infinite loop. The deeper invariant (level == parent.level + 1
-- when parent_section_id is set) is enforced at the service layer because
-- it requires reading the parent row.
ALTER TABLE manuscript_sections
  DROP CONSTRAINT IF EXISTS check_manuscript_section_no_self_parent;
ALTER TABLE manuscript_sections
  ADD CONSTRAINT check_manuscript_section_no_self_parent
    CHECK (parent_section_id IS NULL OR parent_section_id <> id);

CREATE INDEX IF NOT EXISTS idx_manuscript_sections_parent
  ON manuscript_sections(parent_section_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_sections_manuscript_level
  ON manuscript_sections(manuscript_id, level);

-- ---------- 2. Project-level depth + labels ----------

ALTER TABLE manuscript_projects
  ADD COLUMN IF NOT EXISTS spine_depth SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE manuscript_projects
  DROP CONSTRAINT IF EXISTS check_manuscript_spine_depth;
ALTER TABLE manuscript_projects
  ADD CONSTRAINT check_manuscript_spine_depth
    CHECK (spine_depth >= 1 AND spine_depth <= 4);

-- JSONB rather than TEXT[] so the UI can carry richer metadata in the
-- future (e.g. per-layer abbreviations, plural forms) without another
-- migration. The default mirrors today's single-layer label.
ALTER TABLE manuscript_projects
  ADD COLUMN IF NOT EXISTS spine_layer_labels JSONB NOT NULL
    DEFAULT '["Section"]'::jsonb;

-- ---------- 3. Book printings: chapter layer + TOC style ----------
--
-- Schema-only here. The repo and wizard wiring lands in Phase 5; this
-- migration just ensures saved printings carry safe defaults so the wizard
-- continues to behave as today even after the columns exist.

ALTER TABLE book_printings
  ADD COLUMN IF NOT EXISTS chapter_layer SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE book_printings
  DROP CONSTRAINT IF EXISTS check_book_printings_chapter_layer;
ALTER TABLE book_printings
  ADD CONSTRAINT check_book_printings_chapter_layer
    CHECK (chapter_layer >= 1 AND chapter_layer <= 4);

ALTER TABLE book_printings
  ADD COLUMN IF NOT EXISTS toc_style VARCHAR(16) NOT NULL DEFAULT 'flat';

ALTER TABLE book_printings
  DROP CONSTRAINT IF EXISTS check_book_printings_toc_style;
ALTER TABLE book_printings
  ADD CONSTRAINT check_book_printings_toc_style
    CHECK (toc_style IN ('flat', 'hierarchical'));
