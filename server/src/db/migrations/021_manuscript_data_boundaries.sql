-- Migration 021: Manuscript data boundaries (Phase 2 of the RAG layer).
--
-- The RAG layer requires that every AI request can be traced back to a
-- specific manuscript and that uploaded files (which today are global per
-- user) carry an explicit manuscript membership before they can be used as
-- AI context. This migration hardens those edges:
--
--   1. ai_exchanges.manuscript_id          — direct FK so the diagnostic
--                                            log is queryable per-manuscript.
--   2. uploaded_files.filename UNIQUE drop — filenames are not really
--                                            global identifiers; the UUID is.
--                                            Dropping the constraint allows
--                                            two users (or two manuscripts)
--                                            to keep the same source filename.
--   3. manuscript_uploaded_files           — explicit join table for files
--                                            attached to a manuscript with
--                                            an AI-relevant role.
--
-- All steps are guarded so re-running the migration on an already-migrated
-- database is a no-op.

-- ---------- 1. ai_exchanges.manuscript_id ----------

ALTER TABLE ai_exchanges
  ADD COLUMN IF NOT EXISTS manuscript_id UUID
  REFERENCES manuscript_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_exchanges_manuscript_id_created_idx
  ON ai_exchanges(manuscript_id, created_at DESC);

COMMENT ON COLUMN ai_exchanges.manuscript_id IS
  'Manuscript whose context was used by this AI exchange. NULL for global/admin calls or feature surfaces that do not belong to a manuscript.';

-- Backfill from the existing resource_type/resource_id pair so historical
-- manuscript-assist rows stop looking like global calls in queries that join
-- on manuscript_id. Writing-assist rows stay NULL — those rows were keyed on
-- writing_block, and we don't want to guess which manuscript they touched
-- (resolving via manuscript_items would be ambiguous when a block is in two
-- manuscripts; the new code path will set manuscript_id explicitly).
UPDATE ai_exchanges
   SET manuscript_id = resource_id::uuid
 WHERE manuscript_id IS NULL
   AND resource_type = 'manuscript'
   AND resource_id IS NOT NULL;

-- ---------- 2. uploaded_files.filename ----------
--
-- Drop the global UNIQUE on filename. Two users can legitimately upload a
-- file called "draft.docx"; the row's UUID is the real identifier. We drop
-- the constraint by name (the IF EXISTS lets idempotent re-runs pass) and
-- keep the existing non-unique index so lookup-by-filename still works.
--
-- We also recreate a non-unique index in the same statement so the planner
-- doesn't lose the lookup path when the unique-backed index disappears.

ALTER TABLE uploaded_files
  DROP CONSTRAINT IF EXISTS uploaded_files_filename_key;

-- Old code relied on idx_uploaded_files_filename (non-unique). It already
-- exists in migration 015 — but recreate with IF NOT EXISTS in case some
-- environments diverged.
CREATE INDEX IF NOT EXISTS idx_uploaded_files_filename
  ON uploaded_files(filename);

-- ---------- 3. manuscript_uploaded_files ----------
--
-- Explicit join table. An uploaded file becomes AI-eligible only after the
-- user explicitly attaches it here with include_in_ai = true. Without this
-- table the RAG compiler has no way to know which of a user's many global
-- uploads belong to which manuscript.
--
-- context_role lets the user describe what the file IS to the manuscript:
-- a research note, a style guide, a draft, etc. Values mirror the
-- manuscript_context_sources.context_role vocabulary so the compiler can
-- pass the value straight through.

CREATE TABLE IF NOT EXISTS manuscript_uploaded_files (
  manuscript_id     UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  uploaded_file_id  UUID NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,

  context_role      VARCHAR(64) NOT NULL DEFAULT 'supporting',
  include_in_ai     BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (manuscript_id, uploaded_file_id)
);

CREATE INDEX IF NOT EXISTS idx_manuscript_uploaded_files_manuscript
  ON manuscript_uploaded_files(manuscript_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_uploaded_files_file
  ON manuscript_uploaded_files(uploaded_file_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_uploaded_files_include
  ON manuscript_uploaded_files(manuscript_id, include_in_ai);

COMMENT ON TABLE manuscript_uploaded_files IS
  'Explicit membership: which uploaded files belong to which manuscript. Files become AI-eligible only via include_in_ai = true.';
