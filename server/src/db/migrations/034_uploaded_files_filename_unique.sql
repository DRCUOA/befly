-- Migration 034: Ensure uploaded_files.filename has a UNIQUE index
--
-- Migration 015 declared `filename VARCHAR(255) NOT NULL UNIQUE`, but the
-- migration uses CREATE TABLE IF NOT EXISTS — any production database
-- whose `uploaded_files` table predates that wording silently skipped
-- the create and never picked up the UNIQUE constraint.
--
-- uploadsRepo.save() relies on `ON CONFLICT (filename) DO UPDATE`, which
-- in PostgreSQL requires a matching unique constraint or unique index.
-- Without it the query 500s with
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- as soon as anyone tries to upload a file (covers, library covers,
-- anywhere else uploadsRepo is reused).
--
-- This migration adds a unique index idempotently. The pre-existing
-- non-unique idx_uploaded_files_filename stays in place — harmless,
-- and removing it would risk a brief window with no index between the
-- DROP and CREATE on a busy DB.

CREATE UNIQUE INDEX IF NOT EXISTS uploaded_files_filename_uniq
  ON uploaded_files (filename);

COMMENT ON INDEX uploaded_files_filename_uniq IS
  'Backfills the UNIQUE that migration 015 declared inline but never applied to pre-existing tables. Required for ON CONFLICT (filename) upserts.';
