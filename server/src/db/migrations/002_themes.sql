-- Migration 002: Themes
-- Creates themes table and writing_themes junction table

CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS writing_themes (
  writing_id UUID NOT NULL REFERENCES writing_blocks(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (writing_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_writing_themes_writing_id ON writing_themes(writing_id);
CREATE INDEX IF NOT EXISTS idx_writing_themes_theme_id ON writing_themes(theme_id);
CREATE INDEX IF NOT EXISTS idx_themes_slug ON themes(slug);
