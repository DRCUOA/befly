-- Migration 010: User Activity Logs
-- Creates user_activity_logs table for tracking user actions

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON user_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource_type ON user_activity_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON user_activity_logs(user_id, created_at DESC);

-- Composite index for resource lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON user_activity_logs(resource_type, resource_id);

COMMENT ON TABLE user_activity_logs IS 'Logs all user activities for audit and analytics purposes';
COMMENT ON COLUMN user_activity_logs.user_id IS 'User who performed the action (NULL for anonymous actions)';
COMMENT ON COLUMN user_activity_logs.activity_type IS 'Category of activity: auth, writing, theme, appreciation, comment, view';
COMMENT ON COLUMN user_activity_logs.resource_type IS 'Type of resource affected: writing_block, theme, appreciation, comment';
COMMENT ON COLUMN user_activity_logs.resource_id IS 'ID of the resource affected';
COMMENT ON COLUMN user_activity_logs.action IS 'Specific action: create, update, delete, view, login, logout, etc.';
COMMENT ON COLUMN user_activity_logs.details IS 'Additional context as JSON: title, visibility, etc.';
COMMENT ON COLUMN user_activity_logs.ip_address IS 'IP address of the user (for security auditing)';
COMMENT ON COLUMN user_activity_logs.user_agent IS 'User agent string (for debugging)';
