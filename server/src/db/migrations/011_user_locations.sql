-- Migration 011: User locations (optional lat/lng for admin map)
-- Adds latitude and longitude to users for displaying pins on admin map

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN users.latitude IS 'Optional latitude for admin map pin';
COMMENT ON COLUMN users.longitude IS 'Optional longitude for admin map pin';
