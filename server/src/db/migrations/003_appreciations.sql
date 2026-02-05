-- Migration 003: Appreciations
-- Creates appreciations table

CREATE TABLE IF NOT EXISTS appreciations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writing_id UUID NOT NULL REFERENCES writing_blocks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(writing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_appreciations_writing_id ON appreciations(writing_id);
CREATE INDEX IF NOT EXISTS idx_appreciations_user_id ON appreciations(user_id);
