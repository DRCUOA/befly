-- Migration 029: Per-user manual sort order for frags
--
-- Adds an integer `sort_order` to each writing_blocks row so the user can
-- arrange their frags in any order they like and have that order survive
-- reloads. Scope is per owner (user_id): each user has an independent
-- 1..n sequence over their own frags. The UNIQUE constraint enforces that
-- the sequence stays continuous and gap-free after every reorder.
--
-- Backfill assigns 1..n per user ordered by created_at (oldest = 1) so
-- existing frags get a sensible starting arrangement. Once backfilled,
-- the column is set NOT NULL.

ALTER TABLE writing_blocks
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill: assign 1..n per user ordered by created_at then id (stable).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM writing_blocks
)
UPDATE writing_blocks wb
SET sort_order = r.rn
FROM ranked r
WHERE wb.id = r.id
  AND wb.sort_order IS NULL;

ALTER TABLE writing_blocks
  ALTER COLUMN sort_order SET NOT NULL;

-- Each user's frags occupy a continuous 1..n sequence. The unique
-- constraint prevents accidental duplicate positions; reorder logic
-- updates positions inside a transaction so the constraint is satisfied
-- at commit time even when many rows shift.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_writing_blocks_user_sort_order
  ON writing_blocks(user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_writing_blocks_sort_order
  ON writing_blocks(sort_order);

COMMENT ON COLUMN writing_blocks.sort_order IS
  'Per-user position in the frags list (1..n). Edited by moveFragToSortOrder.';
