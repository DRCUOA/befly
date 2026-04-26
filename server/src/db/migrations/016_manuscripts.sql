-- Migration 016: Manuscript Projects (Phase 1 of the manuscript layer)
-- Adds the structural spine on top of themes + writing_blocks:
--   manuscript_projects   - the book/collection itself
--   manuscript_themes     - M2M junction to source themes (mirrors writing_themes)
--   manuscript_sections   - ordered sections within a manuscript
--   manuscript_items      - ordered items (essays/bridges/placeholders/notes/fragments)
--
-- No AI-related tables in this migration. voice_samples and manuscript_artifacts
-- belong to Phases 2-3 and will land in a later numbered migration.

CREATE TABLE IF NOT EXISTS manuscript_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  working_subtitle VARCHAR(500),

  form VARCHAR(50) NOT NULL DEFAULT 'essay_collection',
  status VARCHAR(50) NOT NULL DEFAULT 'gathering',

  intended_reader TEXT,
  central_question TEXT,
  through_line TEXT,
  emotional_arc TEXT,
  narrative_promise TEXT,

  visibility VARCHAR(50) NOT NULL DEFAULT 'private',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_manuscript_form CHECK (form IN (
    'memoir',
    'essay_collection',
    'long_form_essay',
    'creative_nonfiction',
    'hybrid',
    'fictionalised_memoir'
  )),
  CONSTRAINT check_manuscript_status CHECK (status IN (
    'gathering',
    'structuring',
    'drafting',
    'bridging',
    'revising',
    'finalising'
  )),
  CONSTRAINT check_manuscript_visibility CHECK (visibility IN ('private', 'shared', 'public'))
);

CREATE INDEX IF NOT EXISTS idx_manuscript_projects_user_id ON manuscript_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_projects_user_visibility ON manuscript_projects(user_id, visibility);
CREATE INDEX IF NOT EXISTS idx_manuscript_projects_visibility ON manuscript_projects(visibility);

-- Many-to-many junction between manuscripts and the themes they draw from.
-- Mirrors the writing_themes pattern from migration 002.
CREATE TABLE IF NOT EXISTS manuscript_themes (
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (manuscript_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_manuscript_themes_manuscript_id ON manuscript_themes(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_themes_theme_id ON manuscript_themes(theme_id);

-- Sections are the macro-structure of the manuscript spine.
-- order_index is a sparse integer; gaps are fine. Reordering rewrites the column.
CREATE TABLE IF NOT EXISTS manuscript_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,

  purpose VARCHAR(50) NOT NULL DEFAULT 'unassigned',
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_manuscript_section_purpose CHECK (purpose IN (
    'opening',
    'setup',
    'deepening',
    'turning_point',
    'contrast',
    'resolution',
    'ending',
    'appendix',
    'unassigned'
  ))
);

CREATE INDEX IF NOT EXISTS idx_manuscript_sections_manuscript_id ON manuscript_sections(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_sections_order ON manuscript_sections(manuscript_id, order_index);

-- Items are the contents of the spine.
-- Most items will have a writing_block_id (an actual essay), but bridges, placeholders,
-- notes, and fragments may not yet be backed by a real WritingBlock.
-- writing_block_id is ON DELETE SET NULL so a deleted essay leaves the spine slot in
-- place (with the user's title/summary intact) rather than silently disappearing.
-- section_id is ON DELETE SET NULL so dropping a section unassigns its items rather
-- than deleting their content.
CREATE TABLE IF NOT EXISTS manuscript_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  section_id UUID REFERENCES manuscript_sections(id) ON DELETE SET NULL,
  writing_block_id UUID REFERENCES writing_blocks(id) ON DELETE SET NULL,

  item_type VARCHAR(50) NOT NULL DEFAULT 'essay',
  title VARCHAR(500) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,

  structural_role VARCHAR(50),
  summary TEXT,
  ai_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_manuscript_item_type CHECK (item_type IN (
    'essay',
    'bridge',
    'placeholder',
    'note',
    'fragment'
  )),
  CONSTRAINT check_manuscript_item_structural_role CHECK (structural_role IS NULL OR structural_role IN (
    'introduces_theme',
    'complicates_theme',
    'personal_example',
    'turning_point',
    'counterpoint',
    'deepening',
    'release',
    'conclusion'
  ))
);

CREATE INDEX IF NOT EXISTS idx_manuscript_items_manuscript_id ON manuscript_items(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_items_section_id ON manuscript_items(section_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_items_writing_block_id ON manuscript_items(writing_block_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_items_order ON manuscript_items(manuscript_id, order_index);
