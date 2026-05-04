-- Migration 020: Story-craft tables for Character Studio, Polyphonic Map,
-- and Plot Causality views. All scoped to manuscript_projects so the new views
-- reuse the existing manuscript ownership/visibility model.
--
-- Tables:
--   characters              one row per character in a manuscript
--   character_misreadings   what each character mis-reads / mis-interprets
--   motifs                  recurring symbols, objects, gestures
--   motif_voice_variants    how each motif lands inside each character's voice
--   beats                   planned scenes (finer-grained than manuscript_items)
--   beat_knowledge          what each character (and the reader) knows at a beat
--   beat_motifs             which motifs surface in a beat
--   causal_links            because/therefore/but-because/until edges between beats
--   silences                what a character does NOT say at a given beat
--
-- Beats are intentionally separate from manuscript_items: a beat is the *planning*
-- unit (one scene), while an item is the *prose container* (one essay/section/etc).
-- A beat may be linked to an item (1:1) but doesn't have to be.

-- ---------- characters ----------

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role TEXT,
  social_position TEXT,

  contradiction TEXT,
  public_want TEXT,
  private_want TEXT,
  hidden_need TEXT,
  greatest_fear TEXT,
  false_belief TEXT,
  wound TEXT,

  -- Voice bible (preferred_words, forbidden_words, metaphor_sources, attention_pattern,
  -- avoidance_pattern, leakage, sample_neutral, sample_under_pressure, etc.)
  voice JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Ordered arc phases (e.g. ["Belonging","Disturbance","Denial",...])
  arc_phases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- What this character does for the plot (free-form bullets).
  plot_functions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Display ordering inside the studio (sparse integer; gaps OK).
  order_index INTEGER NOT NULL DEFAULT 0,
  -- Optional UI hint for the avatar / row colour on the polyphonic grid.
  color VARCHAR(32),

  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_manuscript_id ON characters(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_characters_order ON characters(manuscript_id, order_index);

-- ---------- character_misreadings ----------

CREATE TABLE IF NOT EXISTS character_misreadings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  why TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_misreadings_character_id ON character_misreadings(character_id);

-- ---------- motifs ----------

CREATE TABLE IF NOT EXISTS motifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  function TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motifs_manuscript_id ON motifs(manuscript_id);

-- One row per (motif, character) so we can store how the motif lands in each voice.
CREATE TABLE IF NOT EXISTS motif_voice_variants (
  motif_id UUID NOT NULL REFERENCES motifs(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  meaning TEXT,
  PRIMARY KEY (motif_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_motif_voice_variants_character ON motif_voice_variants(character_id);

-- ---------- beats ----------
-- A beat is the finer-grained planning unit. Most beats will have a POV
-- character (pov_character_id), an outer event, an inner turn, and may
-- be linked to a manuscript_item once the prose exists.

CREATE TABLE IF NOT EXISTS beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  pov_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  item_id UUID REFERENCES manuscript_items(id) ON DELETE SET NULL,

  -- Ordering inside the manuscript's beat sequence.
  order_index INTEGER NOT NULL DEFAULT 0,

  label VARCHAR(64),                     -- e.g. "S07" (matches scene-seed-table ids)
  title VARCHAR(500),                    -- short scene title
  timeline_point VARCHAR(255),           -- e.g. "1986 February"
  movement VARCHAR(64),                  -- e.g. "I", "II", "III"

  outer_event TEXT,
  inner_turn TEXT,
  voice_constraint TEXT,
  final_image TEXT,

  scene_function_type VARCHAR(64),       -- establishing_voice, counterpoint, correction, echo,
                                         -- withholding, fragment, reframing, stretto, other
  withholding_level VARCHAR(16),         -- low | medium | high

  -- Free-form fields so the polyphonic_scene_template is fully captured.
  unique_perception TEXT,
  blind_spot TEXT,
  misreading TEXT,
  reader_inference TEXT,
  reason_for_next_pov_switch TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_beat_withholding CHECK (
    withholding_level IS NULL OR withholding_level IN ('low','medium','high')
  )
);

CREATE INDEX IF NOT EXISTS idx_beats_manuscript_id ON beats(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_beats_order ON beats(manuscript_id, order_index);
CREATE INDEX IF NOT EXISTS idx_beats_pov_character_id ON beats(pov_character_id);
CREATE INDEX IF NOT EXISTS idx_beats_item_id ON beats(item_id);

-- ---------- beat_knowledge ----------
-- Tracks what each character (or the reader) knows / suspects / mis-reads / withholds
-- at each beat. character_id is NULL for the special "reader" row, which carries the
-- dramatic-irony spine.

CREATE TABLE IF NOT EXISTS beat_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,  -- NULL = reader

  knowledge_kind VARCHAR(16) NOT NULL,
  text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_beat_knowledge_kind CHECK (
    knowledge_kind IN ('known','suspected','misread','hidden','silent')
  )
);

CREATE INDEX IF NOT EXISTS idx_beat_knowledge_beat_id ON beat_knowledge(beat_id);
CREATE INDEX IF NOT EXISTS idx_beat_knowledge_character_id ON beat_knowledge(character_id);

-- ---------- beat_motifs ----------

CREATE TABLE IF NOT EXISTS beat_motifs (
  beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  motif_id UUID NOT NULL REFERENCES motifs(id) ON DELETE CASCADE,
  variant_note TEXT,
  PRIMARY KEY (beat_id, motif_id)
);

CREATE INDEX IF NOT EXISTS idx_beat_motifs_beat_id ON beat_motifs(beat_id);
CREATE INDEX IF NOT EXISTS idx_beat_motifs_motif_id ON beat_motifs(motif_id);

-- ---------- causal_links ----------
-- Directed edges between beats. The label captures the type of causal force.

CREATE TABLE IF NOT EXISTS causal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  from_beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  to_beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,

  link_type VARCHAR(32) NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_causal_link_type CHECK (
    link_type IN ('because','therefore','but_because','until','reversal','recognition','crisis_choice','climax','plant','payoff','and_then')
  ),
  CONSTRAINT check_causal_link_distinct CHECK (from_beat_id <> to_beat_id),
  CONSTRAINT uniq_causal_link UNIQUE (from_beat_id, to_beat_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_causal_links_manuscript_id ON causal_links(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_causal_links_from ON causal_links(from_beat_id);
CREATE INDEX IF NOT EXISTS idx_causal_links_to ON causal_links(to_beat_id);

-- ---------- silences ----------
-- "What is NOT said." Either tied to a beat (local) or floating at the character
-- level (a structural silence across the book). beat_id NULL = global to the
-- character.

CREATE TABLE IF NOT EXISTS silences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  beat_id UUID REFERENCES beats(id) ON DELETE CASCADE,

  what_unsaid TEXT NOT NULL,
  why TEXT,
  consequence TEXT,
  silence_type VARCHAR(32),    -- psychological | social | institutional | formal | ethical

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_silence_type CHECK (
    silence_type IS NULL OR silence_type IN ('psychological','social','institutional','formal','ethical')
  )
);

CREATE INDEX IF NOT EXISTS idx_silences_manuscript_id ON silences(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_silences_character_id ON silences(character_id);
CREATE INDEX IF NOT EXISTS idx_silences_beat_id ON silences(beat_id);
