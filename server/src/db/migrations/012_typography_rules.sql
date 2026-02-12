-- Migration 012: Typography rules
-- Creates typography_rules table for admin-managed typography suggestions
-- Used by Write page for typography suggestions (cni-07)

CREATE TABLE IF NOT EXISTS typography_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  rule_id VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL,
  pattern TEXT NOT NULL,
  replacement TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_typography_rules_enabled ON typography_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_typography_rules_sort_order ON typography_rules(sort_order);

COMMENT ON TABLE typography_rules IS 'Site-wide typography suggestion rules for Write page (em dash, smart quotes, etc.)';
