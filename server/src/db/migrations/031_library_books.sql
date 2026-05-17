-- Migration 031: Personal book library
--
-- A per-user library of physical/reference books. Rows are typically created
-- by scanning an ISBN barcode in the client and POSTing the resulting ISBN
-- to /api/library/lookup, which fetches metadata via @library-pals/isbn.
--
-- An ISBN may only appear once per user (uq_library_books_user_isbn), so
-- scanning the same book twice will surface a duplicate-key error the UI
-- can translate to "already in your library".
--
-- Cascade: users.delete → cascade to library_books.

CREATE TABLE IF NOT EXISTS library_books (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  isbn            VARCHAR(20)  NOT NULL,
  title           VARCHAR(500) NOT NULL DEFAULT '',
  authors         TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  publisher       VARCHAR(255) NOT NULL DEFAULT '',
  published_date  VARCHAR(40)  NOT NULL DEFAULT '',
  description     TEXT         NOT NULL DEFAULT '',
  page_count      INTEGER,
  thumbnail       TEXT         NOT NULL DEFAULT '',
  categories      TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  language        VARCHAR(10)  NOT NULL DEFAULT '',
  notes           TEXT         NOT NULL DEFAULT '',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_library_books_user_isbn UNIQUE (user_id, isbn)
);

CREATE INDEX IF NOT EXISTS idx_library_books_user_created
  ON library_books(user_id, created_at DESC);

COMMENT ON TABLE library_books IS
  'Per-user personal reference library. One row per (user, ISBN).';
COMMENT ON COLUMN library_books.isbn IS
  'Canonical ISBN-10 or ISBN-13 (digits only). Unique per user.';
