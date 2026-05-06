-- Migration 022: Manuscript-scoped RAG layer (Phases 3, 5, 6 of the spec).
--
-- Three tables, one extension, all keyed on manuscript_id so the retrieval
-- service can segregate by manuscript with a single WHERE clause:
--
--   manuscript_context_sources  one row per AI-readable document derived
--                               from manuscript data. The compiler is the
--                               only writer; the embedder reads the body.
--   context_chunks              the source body split into retrievable
--                               pieces. Carries manuscript_id directly so
--                               retrieval doesn't need to JOIN to scope.
--   context_embeddings          one vector per (chunk, embedding_model).
--                               Same manuscript_id carry-forward so the
--                               vector search filters cheaply.
--
-- Why pgvector over an external store: the rest of the app is already
-- 100% Postgres. Adding a parallel store (Pinecone / Qdrant / etc.) for
-- ~hundreds of chunks per manuscript would be a parallel architecture
-- without a corresponding scale problem. If we later outgrow pgvector
-- the chunk table is unchanged and only context_embeddings.embedding
-- needs to move.
--
-- Embedding dimension: 1536 (OpenAI text-embedding-3-small / ada-002).
-- A different-dim model needs a separate migration that creates a new
-- column or a new table — we DO NOT try to vary `vector(N)` at runtime.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- 1. manuscript_context_sources ----------
--
-- Compiled, AI-readable representations of manuscript data. The compiler
-- writes one row per logical "document" (one character, one beat, one
-- writing block, one uploaded file, etc.). The body is the text the
-- chunker will split.
--
-- source_type + source_id let us trace a row back to the originating
-- record so the retrieval layer can render a clickable provenance.
-- (source_id has no FK because it points into N different tables.)

CREATE TABLE IF NOT EXISTS manuscript_context_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id   UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  source_type     VARCHAR(64) NOT NULL,
  source_id       UUID,

  title           TEXT NOT NULL,
  body            TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  context_role    VARCHAR(64) NOT NULL DEFAULT 'supporting',
  priority        INT NOT NULL DEFAULT 0,
  status          VARCHAR(32) NOT NULL DEFAULT 'active',
  canonical       BOOLEAN NOT NULL DEFAULT FALSE,
  include_in_ai   BOOLEAN NOT NULL DEFAULT TRUE,

  -- SHA-256 (or any stable hash) of the compiled body. The compiler uses
  -- this to skip re-chunking and re-embedding when the source is unchanged.
  content_hash    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_mcs_status CHECK (status IN (
    'active', 'draft', 'accepted', 'rejected', 'archived', 'superseded'
  ))
);

CREATE INDEX IF NOT EXISTS manuscript_context_sources_manuscript_idx
  ON manuscript_context_sources(manuscript_id);
CREATE INDEX IF NOT EXISTS manuscript_context_sources_user_idx
  ON manuscript_context_sources(user_id);
CREATE INDEX IF NOT EXISTS manuscript_context_sources_type_idx
  ON manuscript_context_sources(source_type);
CREATE INDEX IF NOT EXISTS manuscript_context_sources_role_idx
  ON manuscript_context_sources(context_role);
CREATE INDEX IF NOT EXISTS manuscript_context_sources_status_idx
  ON manuscript_context_sources(status);
CREATE INDEX IF NOT EXISTS manuscript_context_sources_include_idx
  ON manuscript_context_sources(include_in_ai);
CREATE INDEX IF NOT EXISTS manuscript_context_sources_canonical_idx
  ON manuscript_context_sources(canonical);

-- The compiler reuses an existing source row when (manuscript_id, source_type,
-- source_id) matches. NULL source_id is allowed (e.g. for free-form notes the
-- user typed straight into the context layer), and PG treats two NULL
-- source_ids as distinct, which is exactly what we want.
CREATE UNIQUE INDEX IF NOT EXISTS manuscript_context_sources_origin_unique
  ON manuscript_context_sources(manuscript_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

COMMENT ON TABLE manuscript_context_sources IS
  'Compiled AI-readable representations of manuscript data. The only table the chunker reads from.';

-- ---------- 2. context_chunks ----------
--
-- Chunked, retrieval-ready pieces of a context source. The compiler+chunker
-- pair guarantees that all chunks for a given source share its manuscript_id
-- and content_hash, so re-chunking is cheap to detect and skip.

CREATE TABLE IF NOT EXISTS context_chunks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id       UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  context_source_id   UUID NOT NULL REFERENCES manuscript_context_sources(id) ON DELETE CASCADE,

  chunk_index         INT NOT NULL,
  text                TEXT NOT NULL,
  token_count         INT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- SHA-256 of `text` so a no-op re-chunk pass can skip rebuilding when
  -- the content is identical (and embeddings can stay).
  content_hash        TEXT NOT NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS context_chunks_manuscript_idx
  ON context_chunks(manuscript_id);
CREATE INDEX IF NOT EXISTS context_chunks_source_idx
  ON context_chunks(context_source_id);
CREATE UNIQUE INDEX IF NOT EXISTS context_chunks_source_index_unique
  ON context_chunks(context_source_id, chunk_index);

COMMENT ON TABLE context_chunks IS
  'Chunked text from manuscript_context_sources. Always carries manuscript_id for cheap scoped retrieval.';

-- ---------- 3. context_embeddings ----------
--
-- One vector per (chunk, model). UNIQUE(chunk_id, embedding_model) lets the
-- embedder upsert idempotently and lets us coexist with multiple embedding
-- models if/when we move (e.g. swap in text-embedding-3-large for premium
-- users without losing the small-model embeddings).
--
-- The IVFFlat index is created with a moderate `lists` value; the planner
-- needs ANALYZE to use it well, and we set it up best-effort below. The
-- index is a perf knob, not a correctness knob, so failure to create it
-- on small dev installs is non-fatal — but the migration runner has
-- ON_ERROR_STOP=1, so we keep it CREATE INDEX IF NOT EXISTS and any
-- failure here will surface during `npm run migrate`.

CREATE TABLE IF NOT EXISTS context_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id   UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  chunk_id        UUID NOT NULL REFERENCES context_chunks(id) ON DELETE CASCADE,

  -- 1536 = text-embedding-3-small / ada-002. Different-dim models need
  -- a new migration; this is intentional rather than a missing knob.
  embedding       vector(1536) NOT NULL,
  embedding_model VARCHAR(128) NOT NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT context_embeddings_chunk_model_unique UNIQUE (chunk_id, embedding_model)
);

CREATE INDEX IF NOT EXISTS context_embeddings_manuscript_idx
  ON context_embeddings(manuscript_id);

-- IVFFlat with 100 lists is a sensible default for the small-to-medium
-- corpus sizes a single user's manuscript will produce. Using cosine
-- distance because the OpenAI text-embedding-3 series is normalized for
-- cosine similarity (dot product on unit vectors == cosine).
CREATE INDEX IF NOT EXISTS context_embeddings_ivfflat
  ON context_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON TABLE context_embeddings IS
  'pgvector embeddings for context chunks. Always filtered by manuscript_id at retrieval time.';
