-- Migration 023: Manuscript-scoped chat
--
-- Two tables backing the manuscript chat drawer (one conversation per
-- thread, many messages per conversation). Every conversation is pinned
-- to one manuscript so the RAG retrieval is naturally scoped.
--
--   manuscript_chats          conversation header (title, model, owner)
--   manuscript_chat_messages  individual user / assistant turns
--
-- The assistant turn carries:
--   - the rendered text (markdown the user sees)
--   - retrieved_chunk_ids: the context chunks the model was shown for
--     this turn, so the UI can surface provenance and an admin can
--     audit which chunks influenced which answer
--   - ai_exchange_id: FK into ai_exchanges so the full prompt + raw
--     response is recoverable from the diagnostic log
--
-- Cascade rules:
--   - users.delete       → cascade to manuscript_chats (owner removed)
--   - manuscript.delete  → cascade to manuscript_chats (project gone)
--   - chat.delete        → cascade to manuscript_chat_messages
--   - ai_exchange.delete → set ai_exchange_id to NULL on the message
--                          (the message itself is the durable record)

CREATE TABLE IF NOT EXISTS manuscript_chats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id   UUID NOT NULL REFERENCES manuscript_projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title           VARCHAR(255) NOT NULL DEFAULT 'New chat',
  model           VARCHAR(128) NOT NULL,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manuscript_chats_manuscript
  ON manuscript_chats(manuscript_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_manuscript_chats_user
  ON manuscript_chats(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_manuscript_chats_archived
  ON manuscript_chats(manuscript_id, archived);

CREATE TABLE IF NOT EXISTS manuscript_chat_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id              UUID NOT NULL REFERENCES manuscript_chats(id) ON DELETE CASCADE,

  -- 'user' = the writer, 'assistant' = the LLM. We don't store 'system'
  -- rows because the system prompt is regenerated per turn; persisting
  -- it would just couple the schema to a specific prompt version.
  role                 VARCHAR(16) NOT NULL,
  content              TEXT NOT NULL,

  -- Provenance for assistant turns. NULL for user turns.
  retrieved_chunk_ids  UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ai_exchange_id       UUID REFERENCES ai_exchanges(id) ON DELETE SET NULL,
  model                VARCHAR(128),
  prompt_tokens        INTEGER,
  completion_tokens    INTEGER,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_chat_message_role CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat
  ON manuscript_chat_messages(chat_id, created_at);

COMMENT ON TABLE manuscript_chats IS
  'One row per chat conversation pinned to a manuscript. Manuscript-scoped retrieval is naturally inherited.';
COMMENT ON COLUMN manuscript_chat_messages.retrieved_chunk_ids IS
  'context_chunks ids surfaced to the model on this turn. Lets the UI render provenance per answer.';
