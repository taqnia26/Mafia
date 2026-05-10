-- Migration: Chat system (global / gang / city / private)
-- Applied: 2026-05-10

-- 1. Player-level chat flags
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_chat_muted boolean NOT NULL DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_message_at timestamp;

-- 2. Messages table — single store for all four channels.
--    `channel` is one of 'global','gang','city','private'.
--    For 'private': both sender_id and recipient_id are set.
--    For 'gang':    gang_id is set (snapshot of sender's gang at write time).
--    For 'city':    city_id is set.
CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  channel text NOT NULL,
  sender_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  recipient_id integer REFERENCES players(id) ON DELETE CASCADE,
  gang_id integer,
  city_id integer,
  body text NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created ON chat_messages (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_gang ON chat_messages (gang_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_city ON chat_messages (city_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_private ON chat_messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON chat_messages (recipient_id, created_at DESC);

-- 3. Rate-limit log (per-player rolling window). Worker prunes rows older than 1h.
CREATE TABLE IF NOT EXISTS chat_rate_limits (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sent_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_rate_limits_player_sent ON chat_rate_limits (player_id, sent_at DESC);

-- 4. Restrictions: super-admin can mute a player from one channel or all channels with optional expiry.
--    `channel` value 'all' bans them from every channel.
CREATE TABLE IF NOT EXISTS chat_restrictions (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  channel text NOT NULL,
  reason text,
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_restrictions_player ON chat_restrictions (player_id);
CREATE INDEX IF NOT EXISTS idx_chat_restrictions_expires ON chat_restrictions (expires_at);
