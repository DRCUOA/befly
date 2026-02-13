-- Migration 013: Cover image URL for essay cards
-- Adds cover_image_url to writing_blocks for admin-uploaded featured images (cni-01)
-- URL-only MVP: admins paste https URLs; file upload as enhancement

ALTER TABLE writing_blocks
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN writing_blocks.cover_image_url IS 'Optional featured image URL for essay cards (https only)';
