-- Migration 024: Async chat — pending assistant messages
--
-- Heroku's web dyno has a hard 30s router timeout (H12). The chat service
-- was awaiting the LLM call inside the POST /messages handler, which
-- routinely exceeded 30s — especially on reasoning models (gpt-5,
-- gpt-5-mini). Production logs showed the work completing at ~42s while
-- the user got a 503 because Heroku had already closed the connection.
--
-- Fix: the POST handler now persists a placeholder assistant message
-- with status='pending' and returns immediately. A background promise
-- runs retrieval + LLM and UPDATEs the placeholder when the work
-- finishes. The client polls /chats/:id until status flips to
-- 'complete' or 'error'.
--
-- Existing rows default to 'complete' so the read path is unchanged for
-- chats that already exist.

ALTER TABLE manuscript_chat_messages
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'complete';

-- Drop the old single-value check (if present) and recreate so the column
-- is constrained to the three known states.
ALTER TABLE manuscript_chat_messages
  DROP CONSTRAINT IF EXISTS check_chat_message_status;
ALTER TABLE manuscript_chat_messages
  ADD CONSTRAINT check_chat_message_status
  CHECK (status IN ('pending', 'complete', 'error'));

-- Partial index for the polling path. Most messages are 'complete'; we
-- only ever query 'pending' rows briefly while a turn is in flight.
CREATE INDEX IF NOT EXISTS idx_chat_messages_pending
  ON manuscript_chat_messages(chat_id, status)
  WHERE status = 'pending';

COMMENT ON COLUMN manuscript_chat_messages.status IS
  'Lifecycle of an assistant turn. user rows are always complete; assistant rows transition pending -> complete (or pending -> error).';
