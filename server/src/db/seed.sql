-- Seed data for development
-- Run after migrations

-- Insert sample user
INSERT INTO users (id, username, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo', 'demo@example.com')
ON CONFLICT (id) DO NOTHING;

-- Insert sample themes
INSERT INTO themes (id, name, slug) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Reflection', 'reflection'),
  ('10000000-0000-0000-0000-000000000002', 'Technology', 'technology'),
  ('10000000-0000-0000-0000-000000000003', 'Philosophy', 'philosophy')
ON CONFLICT (id) DO NOTHING;

-- Insert sample writing block
INSERT INTO writing_blocks (id, user_id, title, body) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Welcome', 'This is a sample writing block. Start writing!')
ON CONFLICT (id) DO NOTHING;

-- Link writing to theme
INSERT INTO writing_themes (writing_id, theme_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
