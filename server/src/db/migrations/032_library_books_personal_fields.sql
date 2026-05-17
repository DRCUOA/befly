-- Migration 032: Per-book personal fields + raw provider metadata
--
-- Adds the writer's own appraisal of each library book — whether they've
-- read it, how much they want to (re-)read it, the physical condition of
-- their copy, and who currently owns it. Plus a JSONB column that stores
-- the raw provider response so the UI can show the full record on demand
-- (and so we can mine richer fields later without re-fetching).
--
-- All additive; existing rows get the documented defaults.

ALTER TABLE library_books
  ADD COLUMN IF NOT EXISTS read               BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_motivation    INTEGER  NOT NULL DEFAULT 50
    CHECK (read_motivation BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS physical_condition INTEGER  NOT NULL DEFAULT 100
    CHECK (physical_condition BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS owner              VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider           VARCHAR(32)  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS raw_metadata       JSONB;

COMMENT ON COLUMN library_books.read IS
  'Whether the user has read this book.';
COMMENT ON COLUMN library_books.read_motivation IS
  '0 = no interest, 100 = strong want-to-read. Applies to re-reads too.';
COMMENT ON COLUMN library_books.physical_condition IS
  '0 = wrecked, 100 = mint condition of the user''s physical copy.';
COMMENT ON COLUMN library_books.owner IS
  'Free-text owner — could be a person or a shelf/box identifier.';
COMMENT ON COLUMN library_books.provider IS
  'Which @library-pals/isbn provider returned this metadata (google, openlibrary, …).';
COMMENT ON COLUMN library_books.raw_metadata IS
  'Full provider response, preserved for the JSON-inspector UI.';
