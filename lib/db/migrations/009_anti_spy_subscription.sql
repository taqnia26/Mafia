-- Anti-Spy paid subscription: replace boolean toggle with a time-limited expiry.
-- The legacy boolean column is kept for backward compatibility but no longer read.
ALTER TABLE players ADD COLUMN IF NOT EXISTS anti_spy_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_players_anti_spy_expires_at ON players(anti_spy_expires_at);
