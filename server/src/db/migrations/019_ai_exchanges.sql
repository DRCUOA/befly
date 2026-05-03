-- Migration 019: AI exchanges (temp diagnostic log)
--
-- Captures every chatJson call between the app and the LLM provider so an
-- admin can inspect the actual prompts and responses without trawling
-- info/error log files. This is a stop-gap diagnostic — the AI layer is
-- behaving badly and we need a concrete record of what was sent and what
-- came back, per request, with provenance (which user, which feature,
-- which writing/manuscript) attached.
--
-- Design notes:
--   * Stored as plain TEXT for the prompts (system + user) and the raw
--     response body. JSONB is used for the parsed response object and
--     usage block so we can render or query them later.
--   * `feature` is a free-form string ('writing-assist' / 'manuscript-
--     assist' / etc.) instead of a fixed enum so we don't need a new
--     migration every time we wire another assist surface up to the LLM.
--   * No FK on user_id beyond ON DELETE SET NULL because deleting a user
--     should never cascade-wipe diagnostic logs.
--   * No FK on resource_id at all — a single column references several
--     possible tables (writing_blocks, manuscript_projects, …) by id.
--     resource_type tells you which.
--   * status is 'ok' | 'error' so we can quickly filter to failures
--     when triaging the AI layer.

CREATE TABLE IF NOT EXISTS ai_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provenance
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  feature VARCHAR(64) NOT NULL,                 -- e.g. 'writing-assist'
  mode VARCHAR(64),                              -- e.g. 'coherence', 'gaps'
  resource_type VARCHAR(64),                    -- e.g. 'writing_block'
  resource_id UUID,                              -- id of the writing/manuscript

  -- Provider request
  provider VARCHAR(32) NOT NULL DEFAULT 'openai',
  model VARCHAR(128) NOT NULL,
  temperature NUMERIC(4, 3),
  max_output_tokens INTEGER,
  system_prompt TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  request_chars INTEGER NOT NULL DEFAULT 0,

  -- Provider response
  status VARCHAR(16) NOT NULL DEFAULT 'ok',     -- 'ok' | 'error'
  http_status INTEGER,
  response_raw TEXT,                             -- exact body returned (truncated if huge)
  response_json JSONB,                           -- parsed JSON when ok
  response_chars INTEGER NOT NULL DEFAULT 0,

  -- Token + cost telemetry (provider-supplied; nullable)
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,

  -- Timing + error details
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_ai_exchange_status CHECK (status IN ('ok', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_ai_exchanges_created_at ON ai_exchanges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_exchanges_user_id    ON ai_exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_exchanges_feature    ON ai_exchanges(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_exchanges_status     ON ai_exchanges(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_exchanges_resource   ON ai_exchanges(resource_type, resource_id);

COMMENT ON TABLE  ai_exchanges IS 'Diagnostic log of every LLM chatJson call (request + response) — temporary measure while AI layer is being stabilised.';
COMMENT ON COLUMN ai_exchanges.feature IS 'Which app surface invoked the LLM (writing-assist, manuscript-assist, …).';
COMMENT ON COLUMN ai_exchanges.mode IS 'Per-feature mode (e.g. coherence/proofread/expand for writing-assist; gaps for manuscript-assist).';
COMMENT ON COLUMN ai_exchanges.response_raw IS 'Raw response body string from the provider (the full text the model returned).';
COMMENT ON COLUMN ai_exchanges.response_json IS 'Parsed JSON object on success; null on parse failure / non-2xx.';
COMMENT ON COLUMN ai_exchanges.status IS 'ok = response parsed; error = network / non-2xx / non-JSON.';
