-- Migration 004: Authentication and visibility support
-- Adds password hash, display name, status to users
-- Adds visibility field to writing_blocks and themes

-- Update users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Remove username if it exists (we'll use email + display_name instead)
-- ALTER TABLE users DROP COLUMN IF EXISTS username;

-- Add visibility to writing_blocks
ALTER TABLE writing_blocks
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'private';

-- Add visibility and user_id to themes
ALTER TABLE themes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'private';

-- Create indexes for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_writing_blocks_visibility ON writing_blocks(visibility);
CREATE INDEX IF NOT EXISTS idx_writing_blocks_user_visibility ON writing_blocks(user_id, visibility);
CREATE INDEX IF NOT EXISTS idx_themes_user_id ON themes(user_id);
CREATE INDEX IF NOT EXISTS idx_themes_visibility ON themes(visibility);
CREATE INDEX IF NOT EXISTS idx_themes_user_visibility ON themes(user_id, visibility);

-- Add check constraints
ALTER TABLE writing_blocks
  ADD CONSTRAINT check_visibility CHECK (visibility IN ('private', 'shared', 'public'));

ALTER TABLE themes
  ADD CONSTRAINT check_theme_visibility CHECK (visibility IN ('private', 'shared', 'public'));

ALTER TABLE users
  ADD CONSTRAINT check_user_status CHECK (status IN ('active', 'inactive', 'suspended'));
