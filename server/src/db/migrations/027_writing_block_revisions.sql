-- Migration 027: Append-only revision log + optimistic-lock counter
--
-- Adds an authoritative, server-side audit/version history for each frag.
-- The live HEAD (current content) stays in `writing_blocks`. This table is
-- a pure checkpoint log: rows are NEVER updated or deleted in normal flow.
--
-- A rollback creates a NEW row with revision_kind='restore' carrying the
-- body of the chosen target version, so the prior state is never lost and
-- the audit trail tells the full story.
--
-- A new revision row is created on these triggers (enforced in the
-- service layer, not the DB):
--   1. Explicit "Save version" button (with optional note)
--   2. Editor handoff — first save by a different author than the previous
--      revision's edited_by causes a checkpoint of the prior state
--   3. Time-based: previous revision is older than 30 minutes
--   4. Pre-restore: HEAD is snapshotted before applying a rollback
--   5. Skip no-op: if HEAD content hash matches latest revision, no row
--
-- Cascade rules:
--   writing_blocks.delete → revisions cascade away
--   users.delete          → edited_by is set NULL (we keep the row so the
--                            history is consistent; UI shows "deleted user")

CREATE TABLE IF NOT EXISTS writing_block_revisions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writing_block_id      UUID NOT NULL REFERENCES writing_blocks(id) ON DELETE CASCADE,

  -- Monotonic per-frag, assigned by the service layer inside a transaction
  -- holding SELECT ... FOR UPDATE on the parent row. Starts at 1.
  version_number        INTEGER NOT NULL,

  -- Who saved this revision. NULL only after that user is deleted.
  edited_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  edited_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Snapshot of versioned fields. Theme associations are deliberately
  -- excluded for now (they live in a join table and rarely change; we can
  -- snapshot them as a separate column later if requested).
  title                 TEXT NOT NULL,
  body                  TEXT NOT NULL,
  visibility            VARCHAR(50) NOT NULL,
  cover_image_url       TEXT,
  cover_image_position  VARCHAR(20),

  -- Provenance + audit metadata.
  revision_kind         VARCHAR(20) NOT NULL DEFAULT 'edit',
  restored_from_version INTEGER,
  note                  VARCHAR(500),

  CONSTRAINT writing_block_revisions_kind_chk
    CHECK (revision_kind IN ('create', 'edit', 'restore')),

  -- 'restored_from_version' only meaningful when kind='restore'.
  CONSTRAINT writing_block_revisions_restore_chk
    CHECK (
      (revision_kind = 'restore' AND restored_from_version IS NOT NULL)
      OR (revision_kind <> 'restore' AND restored_from_version IS NULL)
    ),

  CONSTRAINT writing_block_revisions_visibility_chk
    CHECK (visibility IN ('private', 'shared', 'public')),

  CONSTRAINT writing_block_revisions_version_unique
    UNIQUE (writing_block_id, version_number)
);

-- History queries: newest revisions first per frag.
CREATE INDEX IF NOT EXISTS idx_writing_block_revisions_block_version
  ON writing_block_revisions(writing_block_id, version_number DESC);

-- "Revisions I authored" queries.
CREATE INDEX IF NOT EXISTS idx_writing_block_revisions_user
  ON writing_block_revisions(edited_by);

-- Optimistic-lock counter on the live row. Increments on every update.
-- Defaults to 1 for existing rows. The PUT payload carries the client's
-- known version as expected_version; mismatch → 409 (handled in repo).
ALTER TABLE writing_blocks
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1;

-- Backfill: every existing frag becomes its own first revision so the
-- history is never empty and rollbacks can target the original state.
INSERT INTO writing_block_revisions (
  writing_block_id, version_number, edited_by, edited_at,
  title, body, visibility, cover_image_url, cover_image_position,
  revision_kind, note
)
SELECT
  wb.id,
  1,
  wb.user_id,
  COALESCE(wb.updated_at, wb.created_at, NOW()),
  wb.title,
  wb.body,
  COALESCE(wb.visibility, 'private'),
  wb.cover_image_url,
  COALESCE(wb.cover_image_position, '50% 50%'),
  'create',
  'Backfilled from migration 027'
FROM writing_blocks wb
WHERE NOT EXISTS (
  SELECT 1 FROM writing_block_revisions r WHERE r.writing_block_id = wb.id
);
