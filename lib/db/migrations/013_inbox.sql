-- Migration: Inbox / Mailbox System
-- Applied: 2026-05-10

-- 1. Add a fast-read counter column to players for the header badge.
ALTER TABLE players ADD COLUMN IF NOT EXISTS unread_inbox_count integer NOT NULL DEFAULT 0;

-- 2. inbox_messages: persistent, bilingual mailbox messages.
CREATE TABLE IF NOT EXISTS inbox_messages (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  subject_en text NOT NULL,
  subject_ar text NOT NULL,
  body_en text NOT NULL,
  body_ar text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_link text,
  action_label_en text,
  action_label_ar text,
  is_read boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  read_at timestamp,
  archived_at timestamp,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_player_created ON inbox_messages (player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_player_unread ON inbox_messages (player_id, is_read, is_deleted);
CREATE INDEX IF NOT EXISTS idx_inbox_player_category ON inbox_messages (player_id, category, is_deleted);

-- 3. inbox_stats: per-player aggregated counters (informational).
CREATE TABLE IF NOT EXISTS inbox_stats (
  player_id integer PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  total_received integer NOT NULL DEFAULT 0,
  last_message_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);
