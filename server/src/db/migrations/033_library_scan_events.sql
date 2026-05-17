-- Migration 033: ISBN-scan funnel telemetry
--
-- Two-phase funnel: a "scan" row is logged by the client when the camera
-- (or manual entry) yields an ISBN candidate; a "lookup" row is logged by
-- the server when /api/library/lookup either resolves a provider hit or
-- fails. Cross-referenced by isbn so the success rate of each phase can
-- be measured independently.
--
-- We keep the table lean: no PII beyond the user_id FK and a user-agent
-- string (truncated). No location, no IP. Cascade on user delete.

CREATE TABLE IF NOT EXISTS library_scan_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  phase         VARCHAR(16) NOT NULL,
  isbn          VARCHAR(20) NOT NULL DEFAULT '',
  succeeded     BOOLEAN     NOT NULL,

  provider      VARCHAR(32) NOT NULL DEFAULT '',
  error_code    VARCHAR(64) NOT NULL DEFAULT '',
  error_message TEXT        NOT NULL DEFAULT '',
  duration_ms   INTEGER,
  scanner       VARCHAR(32) NOT NULL DEFAULT '',
  user_agent    VARCHAR(500) NOT NULL DEFAULT '',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_library_scan_events_phase
    CHECK (phase IN ('scan', 'lookup'))
);

CREATE INDEX IF NOT EXISTS idx_library_scan_events_user_created
  ON library_scan_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_scan_events_phase_succeeded
  ON library_scan_events(phase, succeeded, created_at DESC);

COMMENT ON TABLE library_scan_events IS
  'Two-phase funnel for ISBN scan + lookup. Used to measure where scans drop off.';
