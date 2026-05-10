-- Migration: Advanced Bank — deposits, loans, interest
-- Applied: 2026-05-10

-- 1. Add bank balance + interest tracking to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS bank_balance bigint NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_bank_interest_at timestamp;

-- 2. Bank loans
CREATE TABLE IF NOT EXISTS bank_loans (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  principal bigint NOT NULL,
  remaining bigint NOT NULL,
  interest_rate integer NOT NULL,
  taken_at timestamp NOT NULL DEFAULT now(),
  due_at timestamp NOT NULL,
  status text NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_bank_loans_player ON bank_loans(player_id);
CREATE INDEX IF NOT EXISTS idx_bank_loans_status_due ON bank_loans(status, due_at);

-- 3. Bank transactions ledger
CREATE TABLE IF NOT EXISTS bank_transactions (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount bigint NOT NULL,
  balance_after bigint NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_tx_player_created ON bank_transactions(player_id, created_at DESC);
