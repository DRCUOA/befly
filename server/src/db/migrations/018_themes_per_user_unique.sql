-- Migration 018: Themes uniqueness becomes per-user
--
-- Migration 002 created themes with globally unique name and slug. That made
-- sense when themes were a single global pool. Migration 004 added user_id
-- and the app has treated themes as a per-user concept ever since (the
-- /themes page filters by user, the "Mine" filter is per-user, the import
-- flow needs each user to own their own copy of common names like "Grief").
--
-- The global unique constraints were a leftover from the pre-004 schema and
-- prevent two users from naming a theme the same thing. This migration
-- relaxes them to per-user uniqueness.
--
-- Notes for future me:
--   * Postgres treats NULL as distinct in unique constraints, so the
--     (user_id, name) constraint will not collide on legacy NULL-user rows
--     left over from before migration 004 (if any exist).
--   * IF EXISTS guards the DROPs so re-running the migration on a fresh
--     deploy that never had the global constraints is a no-op.

ALTER TABLE themes DROP CONSTRAINT IF EXISTS themes_name_key;
ALTER TABLE themes DROP CONSTRAINT IF EXISTS themes_slug_key;

ALTER TABLE themes ADD CONSTRAINT themes_user_name_unique UNIQUE (user_id, name);
ALTER TABLE themes ADD CONSTRAINT themes_user_slug_unique UNIQUE (user_id, slug);
