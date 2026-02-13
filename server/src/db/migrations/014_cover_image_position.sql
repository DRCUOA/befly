-- Migration 014: Cover image position for cropping
-- object-position value (e.g. "50% 50%") to allow repositioning when image is larger than frame

ALTER TABLE writing_blocks
  ADD COLUMN IF NOT EXISTS cover_image_position TEXT DEFAULT '50% 50%';

COMMENT ON COLUMN writing_blocks.cover_image_position IS 'object-position for cover image (e.g. 50% 50%)';
