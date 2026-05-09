-- Migration: Ranks Tables
-- Applied: 2026-05-09

-- 1. player_ranks: the 12-tier rank definition table
CREATE TABLE IF NOT EXISTS player_ranks (
  id serial PRIMARY KEY,
  rank_number integer NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  subtitle_en text NOT NULL DEFAULT '',
  subtitle_ar text NOT NULL DEFAULT '',
  required_level integer NOT NULL,
  required_money bigint NOT NULL DEFAULT 0,
  required_xp bigint NOT NULL DEFAULT 0,
  required_kills integer NOT NULL DEFAULT 0,
  atk_bonus integer NOT NULL DEFAULT 0,
  def_bonus integer NOT NULL DEFAULT 0,
  max_npc_guards integer NOT NULL DEFAULT 0,
  max_player_guards integer NOT NULL DEFAULT 0,
  max_properties integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6b7280',
  icon text NOT NULL DEFAULT 'shield',
  perks_en text NOT NULL DEFAULT '',
  perks_ar text NOT NULL DEFAULT ''
);

-- 2. player_rank_progress: one row per player tracking their current rank
CREATE TABLE IF NOT EXISTS player_rank_progress (
  id serial PRIMARY KEY,
  player_id integer NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  current_rank integer NOT NULL DEFAULT 1,
  upgraded_at timestamp NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_player_rank_progress_player ON player_rank_progress (player_id);
