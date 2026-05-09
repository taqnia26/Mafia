-- Migration: Notifications Table
-- Applied: 2026-05-09

-- 1. Create notifications table for real-time in-app notification bell
CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id),
  type text NOT NULL,
  message text NOT NULL,
  link text NOT NULL DEFAULT '/dashboard',
  read boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

-- 2. Index for fast per-player unread polling (the most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_player_id ON notifications (player_id);
CREATE INDEX IF NOT EXISTS idx_notifications_player_unread ON notifications (player_id, read, created_at DESC);
