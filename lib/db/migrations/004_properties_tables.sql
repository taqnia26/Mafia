-- Migration: Properties System
-- Applied: 2026-05-09

-- 1. Property type catalog
CREATE TABLE IF NOT EXISTS property_types (
  id serial PRIMARY KEY,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  price bigint NOT NULL,
  base_income_per_hour bigint NOT NULL,
  required_level integer NOT NULL DEFAULT 1,
  max_level integer NOT NULL DEFAULT 4,
  icon text NOT NULL DEFAULT 'building',
  image_url text NOT NULL DEFAULT '',
  perks_en text NOT NULL DEFAULT '',
  perks_ar text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true
);

-- 2. Player-owned properties
CREATE TABLE IF NOT EXISTS player_properties (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  property_type_id integer NOT NULL REFERENCES property_types(id),
  level integer NOT NULL DEFAULT 1,
  purchased_at timestamp NOT NULL DEFAULT now(),
  last_income_collected_at timestamp NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_player_properties_player ON player_properties (player_id);
CREATE INDEX IF NOT EXISTS idx_player_properties_type ON player_properties (property_type_id);

-- 4. Update max_properties on existing ranks
UPDATE player_ranks SET max_properties = 0 WHERE rank_number = 1;
UPDATE player_ranks SET max_properties = 1 WHERE rank_number = 2;
UPDATE player_ranks SET max_properties = 2 WHERE rank_number = 3;
UPDATE player_ranks SET max_properties = 3 WHERE rank_number = 4;
UPDATE player_ranks SET max_properties = 4 WHERE rank_number = 5;
UPDATE player_ranks SET max_properties = 5 WHERE rank_number = 6;
UPDATE player_ranks SET max_properties = 6 WHERE rank_number = 7;
UPDATE player_ranks SET max_properties = 7 WHERE rank_number = 8;
UPDATE player_ranks SET max_properties = 8 WHERE rank_number = 9;
UPDATE player_ranks SET max_properties = 9 WHERE rank_number = 10;
UPDATE player_ranks SET max_properties = 12 WHERE rank_number = 11;
UPDATE player_ranks SET max_properties = 15 WHERE rank_number = 12;
