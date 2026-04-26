-- Migration 017: Manuscript artifacts
-- Durable storage for AI assist output (gap analyses, bridge suggestions,
-- voice audits, motif maps, etc.). Per the spec, AI work should not vanish
-- into chat history - it's part of the manuscript process.
--
-- Each artifact belongs to a manuscript_project, has a known type, holds
-- structured content as JSONB (so we can render the same artifact differently
-- as the UI evolves), and tracks a lifecycle status the user controls
-- (draft/accepted/rejected/archived). related_writing_block_ids preserves
-- provenance — the user material the suggestion was grounded in.

CREATE TABLE IF NOT EXISTS manuscript_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,

  -- Free-form structured payload. Each type defines its own shape; the schema
  -- is intentionally permissive so we don't migrate every time we add a mode.
  content JSONB NOT NULL DEFAULT '{}'::jsonb,

  status VARCHAR(50) NOT NULL DEFAULT 'draft',

  -- Provenance: which writing_blocks this artifact was grounded in. Stored as
  -- an array of UUIDs rather than a junction table because (a) it's read-only
  -- after creation and (b) the relationship is loose - if a block disappears
  -- the artifact is still useful as a record.
  related_writing_block_ids UUID[] NOT NULL DEFAULT '{}',

  -- Optional pointers to specific spine elements the artifact concerns.
  -- For gap_analysis: from_item_id and to_item_id name the junction.
  from_item_id UUID REFERENCES manuscript_items(id) ON DELETE SET NULL,
  to_item_id UUID REFERENCES manuscript_items(id) ON DELETE SET NULL,

  -- Bookkeeping for AI-generated artifacts.
  source_model VARCHAR(100),

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_manuscript_artifact_type CHECK (type IN (
    'spine_suggestion',
    'through_line',
    'gap_analysis',
    'bridge',
    'voice_audit',
    'motif_map',
    'reader_journey'
  )),
  CONSTRAINT check_manuscript_artifact_status CHECK (status IN (
    'draft',
    'accepted',
    'rejected',
    'archived'
  ))
);

CREATE INDEX IF NOT EXISTS idx_manuscript_artifacts_manuscript_id ON manuscript_artifacts(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_artifacts_manuscript_type ON manuscript_artifacts(manuscript_id, type);
CREATE INDEX IF NOT EXISTS idx_manuscript_artifacts_status ON manuscript_artifacts(manuscript_id, status);
CREATE INDEX IF NOT EXISTS idx_manuscript_artifacts_junction ON manuscript_artifacts(manuscript_id, from_item_id, to_item_id);
