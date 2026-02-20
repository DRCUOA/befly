-- Migration 015: Persistent uploaded files
-- Heroku uses an ephemeral filesystem; files saved to disk are lost on dyno restart.
-- Store uploaded images in PostgreSQL so they survive dyno cycling.

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL UNIQUE,
  content_type VARCHAR(100) NOT NULL,
  data BYTEA NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_filename ON uploaded_files(filename);
