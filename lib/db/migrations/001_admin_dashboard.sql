-- Migration: Admin Dashboard Schema Changes
-- Applied: 2026-05-09

-- 1. Add admin_role column to players (text with enum constraint)
ALTER TABLE players ADD COLUMN IF NOT EXISTS admin_role text;
ALTER TABLE players ADD CONSTRAINT chk_admin_role
  CHECK (admin_role IS NULL OR admin_role IN ('reviewer', 'moderator', 'admin', 'superadmin'));

-- 2. Add color column to gangs
ALTER TABLE gangs ADD COLUMN IF NOT EXISTS color text;

-- 3. Add health/max_health columns to players (required by worker)
ALTER TABLE players ADD COLUMN IF NOT EXISTS health integer NOT NULL DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS max_health integer NOT NULL DEFAULT 100;

-- 4. Create admin_actions_log table
CREATE TABLE IF NOT EXISTS admin_actions_log (
  id serial PRIMARY KEY,
  admin_id integer NOT NULL,
  admin_username text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id integer,
  description text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);

-- 5. Indexes for 60-day retention cleanup and performance
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at);
CREATE INDEX IF NOT EXISTS idx_admin_actions_log_created_at ON admin_actions_log (created_at);
