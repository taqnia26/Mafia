-- Permadeath columns on players: when HP hits 0, the player is permanently
-- dead until they restart (or an admin revives them).
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_permanently_dead BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS died_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS killed_by_player_id INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS death_cause TEXT;

CREATE INDEX IF NOT EXISTS idx_players_is_permanently_dead ON players(is_permanently_dead);
