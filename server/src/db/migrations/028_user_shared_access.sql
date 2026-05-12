-- Migration 028: Admin-gated access to shared-visibility content
--
-- A frag with visibility='shared' is meant to be readable by other
-- authenticated users of the system — but only ones an admin has
-- explicitly approved. This adds a per-user flag the admin can toggle;
-- unapproved users see only public frags + their own + frags they're
-- a named editor on.
--
-- Asymmetric: shared_access only gates READING others' shared frags.
-- Setting your own frag to visibility='shared' is unrestricted (it's
-- harmless if no unapproved user can see it).
--
-- Grandfather: every existing active user is flagged TRUE at migration
-- time so the change does not silently revoke current access. New
-- signups default to FALSE and need explicit admin approval.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS shared_access BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET shared_access = TRUE WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_users_shared_access
  ON users(shared_access)
  WHERE shared_access = TRUE;
