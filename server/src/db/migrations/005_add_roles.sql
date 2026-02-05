-- Migration 005: Add role-based authorization
-- Adds role field to users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Add check constraint for roles
ALTER TABLE users
  ADD CONSTRAINT check_user_role CHECK (role IN ('user', 'admin'));

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing users to have 'user' role (if not set)
UPDATE users SET role = 'user' WHERE role IS NULL;
