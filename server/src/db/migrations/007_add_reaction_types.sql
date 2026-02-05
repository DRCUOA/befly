-- Migration 007: Add reaction types to appreciations
-- Adds reaction_type column to support different emotional responses

ALTER TABLE appreciations 
ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(20) DEFAULT 'like' CHECK (reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry'));

-- Update existing appreciations to have 'like' as default
UPDATE appreciations SET reaction_type = 'like' WHERE reaction_type IS NULL;

-- Make reaction_type NOT NULL after setting defaults
ALTER TABLE appreciations 
ALTER COLUMN reaction_type SET NOT NULL;

-- Update unique constraint to include reaction_type (users can have multiple reactions)
-- First drop the old constraint
ALTER TABLE appreciations DROP CONSTRAINT IF EXISTS appreciations_writing_id_user_id_key;

-- Add new unique constraint that allows one reaction type per user per writing
CREATE UNIQUE INDEX IF NOT EXISTS idx_appreciations_writing_user_reaction 
ON appreciations(writing_id, user_id, reaction_type);
