-- Seed data for development
-- Run after migrations
-- Note: Password is 'demo123' hashed with bcrypt (12 rounds)
-- In production, use proper password hashing

-- Insert sample user with password hash
-- Password: demo123
INSERT INTO users (id, email, password_hash, display_name, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYq5q5q5q5q', 'Demo User', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert sample themes (owned by demo user, shared visibility)
INSERT INTO themes (id, user_id, name, slug, visibility) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Reflection', 'reflection', 'shared'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Technology', 'technology', 'shared'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Philosophy', 'philosophy', 'shared')
ON CONFLICT (id) DO NOTHING;

-- Insert sample writing block (shared visibility)
INSERT INTO writing_blocks (id, user_id, title, body, visibility) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Welcome', 'This is a sample writing block. Start writing!', 'shared')
ON CONFLICT (id) DO NOTHING;

-- Link writing to theme
INSERT INTO writing_themes (writing_id, theme_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
