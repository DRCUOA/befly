-- Migration 026: Named-user edit grants on writing blocks (frags)
--
-- An author may grant other named users permission on a frag they own.
-- Admins always behave as if they hold the highest permission on every
-- frag; the frag's own user_id remains the authoritative "original author"
-- and is never overwritten by collaborator activity.
--
-- Permissions (low → high, inclusive):
--   'edit'   - may update title, body, themes, visibility, cover
--   'manage' - may also add/remove/change editors on this frag
--
-- 'comment' and 'suggest' are intentionally NOT in the enum yet — they
-- imply enforcement subsystems that do not exist (comments are currently
-- open to any authenticated user; suggestions / tracked-changes is not
-- implemented). Adding them later is a non-destructive ALTER on the
-- check constraint.
--
-- Deletion of a frag, or of either user, cascades grants away.

CREATE TABLE IF NOT EXISTS writing_block_editors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writing_block_id  UUID NOT NULL REFERENCES writing_blocks(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission        VARCHAR(20) NOT NULL,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT writing_block_editors_permission_chk
    CHECK (permission IN ('edit', 'manage')),

  -- At most one grant row per (frag, user). Changing a permission is an
  -- UPDATE, not a second row, so the audit story stays clean.
  CONSTRAINT writing_block_editors_unique_user
    UNIQUE (writing_block_id, user_id)
);

-- "Frags I have edit rights on" lookup — used by the Shared-with-me view
-- and by the per-request permission check.
CREATE INDEX IF NOT EXISTS idx_writing_block_editors_user
  ON writing_block_editors(user_id);

-- "Editors on this frag" lookup — used by the Editors panel and by the
-- writing-blocks update path.
CREATE INDEX IF NOT EXISTS idx_writing_block_editors_block
  ON writing_block_editors(writing_block_id);
