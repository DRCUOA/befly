-- Migration 009: Username is legacy and no longer required for signup
-- Keep the column for backward compatibility, but remove NOT NULL constraint.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'username'
  ) THEN
    ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
    UPDATE users SET username = email WHERE username IS NULL;
  END IF;
END $$;
