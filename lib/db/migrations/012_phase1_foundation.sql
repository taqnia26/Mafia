-- Phase 1 v2.0 Foundation: ranks update, property limits, safe house, admin wallet, casino, ammo

-- ============ 1. RANKS UPDATE ============
ALTER TABLE player_ranks ADD COLUMN IF NOT EXISTS max_hp INTEGER NOT NULL DEFAULT 100;
ALTER TABLE player_ranks ADD COLUMN IF NOT EXISTS max_holders INTEGER;
ALTER TABLE player_ranks ADD COLUMN IF NOT EXISTS special_requirements JSONB;

UPDATE player_ranks SET name_en='Prospect', name_ar='بروسبكت', required_level=1, max_hp=100, atk_bonus=0, def_bonus=0, max_properties=2, color='#CD7F32', icon='shield' WHERE rank_number=1;
UPDATE player_ranks SET name_en='Sicario', name_ar='سيكاريو', required_level=5, max_hp=125, atk_bonus=10, def_bonus=10, max_properties=3, color='#CD7F32', icon='target' WHERE rank_number=2;
UPDATE player_ranks SET name_en='Bratok', name_ar='براتوك', required_level=10, max_hp=150, atk_bonus=20, def_bonus=20, max_properties=4, color='#CD7F32', icon='swords' WHERE rank_number=3;
UPDATE player_ranks SET name_en='Enforcer', name_ar='إنفورسر', required_level=20, max_hp=200, atk_bonus=40, def_bonus=40, max_properties=5, color='#C0C0C0', icon='axe' WHERE rank_number=4;
UPDATE player_ranks SET name_en='Caporegime', name_ar='كابوريجيمي', required_level=30, max_hp=250, atk_bonus=60, def_bonus=60, max_properties=6, color='#C0C0C0', icon='star' WHERE rank_number=5;
UPDATE player_ranks SET name_en='Capodecina', name_ar='كابوديتشينا', required_level=45, max_hp=325, atk_bonus=80, def_bonus=80, max_properties=7, color='#C0C0C0', icon='crown' WHERE rank_number=6;
UPDATE player_ranks SET name_en='Consigliere', name_ar='كونسيليري', required_level=60, max_hp=400, atk_bonus=100, def_bonus=100, max_properties=8, color='#FFD700', icon='scroll' WHERE rank_number=7;
UPDATE player_ranks SET name_en='Underboss', name_ar='أندربوس', required_level=80, max_hp=500, atk_bonus=120, def_bonus=120, max_properties=10, color='#FFD700', icon='gem' WHERE rank_number=8;
UPDATE player_ranks SET name_en='Boss', name_ar='بوس', required_level=100, max_hp=625, atk_bonus=140, def_bonus=140, max_properties=12, color='#FFD700', icon='crown' WHERE rank_number=9;
UPDATE player_ranks SET name_en='Don', name_ar='دون', required_level=125, max_hp=750, atk_bonus=160, def_bonus=160, max_properties=15, color='#E5E4E2', icon='trophy' WHERE rank_number=10;
UPDATE player_ranks SET name_en='Padrino', name_ar='بادرينو', required_level=150, max_hp=875, atk_bonus=220, def_bonus=220, max_properties=18, color='#E5E4E2', icon='king',
  special_requirements='{"kills":150,"properties":15,"neighborhood_control":true}'::jsonb,
  required_kills=150
WHERE rank_number=11;

INSERT INTO player_ranks (rank_number, name_en, name_ar, required_level, required_kills, max_hp, atk_bonus, def_bonus, max_properties, max_holders, special_requirements, color, icon)
VALUES (12, 'Capo di Tutti Capi', 'كابو دي توتي كابي', 200, 200, 1000, 280, 280, 25, 3, '{"kills":200,"properties":20,"must_kill_rank_12":true}'::jsonb, '#E5E4E2', 'emperor')
ON CONFLICT (rank_number) DO UPDATE SET
  name_en=EXCLUDED.name_en, name_ar=EXCLUDED.name_ar, required_level=EXCLUDED.required_level,
  required_kills=EXCLUDED.required_kills, max_hp=EXCLUDED.max_hp, atk_bonus=EXCLUDED.atk_bonus,
  def_bonus=EXCLUDED.def_bonus, max_properties=EXCLUDED.max_properties, max_holders=EXCLUDED.max_holders,
  special_requirements=EXCLUDED.special_requirements, color=EXCLUDED.color, icon=EXCLUDED.icon;

-- ============ 2. PROPERTY LIMITS (merged into property_types) ============
ALTER TABLE property_types ADD COLUMN IF NOT EXISTS max_per_city INTEGER NOT NULL DEFAULT -1;
ALTER TABLE property_types ADD COLUMN IF NOT EXISTS min_rank INTEGER;
ALTER TABLE property_types ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE property_types ADD COLUMN IF NOT EXISTS is_supreme_fortress BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE property_types SET slug='safe_house',          max_per_city=-1, min_rank=NULL WHERE id=1;
UPDATE property_types SET slug='workshop',            max_per_city=-1, min_rank=NULL WHERE id=2;
UPDATE property_types SET slug='nightclub',           max_per_city=5,  min_rank=NULL WHERE id=3;
UPDATE property_types SET slug='drug_lab',            max_per_city=10, min_rank=NULL WHERE id=4;
UPDATE property_types SET slug='ammo_factory',        max_per_city=3,  min_rank=6 WHERE id=5;
UPDATE property_types SET slug='weapons_warehouse',   max_per_city=2,  min_rank=7 WHERE id=6;
UPDATE property_types SET slug='casino',              max_per_city=2,  min_rank=8 WHERE id=7;
UPDATE property_types SET slug='hospital',            max_per_city=1,  min_rank=6 WHERE id=8;
UPDATE property_types SET slug='bank',                max_per_city=1,  min_rank=6 WHERE id=9;
UPDATE property_types SET slug='nuclear_reactor',     max_per_city=1,  min_rank=11 WHERE id=10;

INSERT INTO property_types (name_en, name_ar, description_en, description_ar, price, base_income_per_hour, required_level, max_level, icon, perks_en, perks_ar, is_active, max_per_city, min_rank, slug, is_supreme_fortress)
VALUES ('Supreme Fortress', 'القلعة العليا', 'Endgame fortress for Capo di Tutti Capi', 'قلعة نهاية اللعبة لكابو دي توتي كابي', 1000000000, 100000, 200, 1, 'fortress', 'Endgame defense + massive income', 'دفاع نهائي ودخل ضخم', true, 1, 12, 'supreme_fortress', true)
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_types_slug ON property_types(slug);

CREATE TABLE IF NOT EXISTS city_property_counts (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id),
  property_type_id INTEGER NOT NULL REFERENCES property_types(id),
  current_count INTEGER NOT NULL DEFAULT 0,
  max_count INTEGER NOT NULL,
  UNIQUE(city_id, property_type_id)
);

INSERT INTO city_property_counts (city_id, property_type_id, current_count, max_count)
SELECT c.id, pt.id, 0, pt.max_per_city
FROM cities c CROSS JOIN property_types pt
WHERE pt.max_per_city != -1
ON CONFLICT DO NOTHING;

-- Backfill current counts based on existing player_properties
UPDATE city_property_counts cpc SET current_count = sub.cnt
FROM (
  SELECT pp.property_type_id, p.city_id, COUNT(*)::int AS cnt
  FROM player_properties pp
  JOIN players p ON p.id = pp.player_id
  GROUP BY pp.property_type_id, p.city_id
) sub
WHERE cpc.property_type_id = sub.property_type_id AND cpc.city_id = sub.city_id;

-- ============ 3. SAFE HOUSE RENTAL ============
ALTER TABLE players ADD COLUMN IF NOT EXISTS in_safe_house BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS safe_house_expires_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_weapon_id INTEGER REFERENCES weapons(id);

CREATE TABLE IF NOT EXISTS safe_house_rentals (
  id SERIAL PRIMARY KEY,
  player_property_id INTEGER NOT NULL REFERENCES player_properties(id),
  renter_id INTEGER NOT NULL REFERENCES players(id),
  owner_id INTEGER NOT NULL REFERENCES players(id),
  rent_amount BIGINT NOT NULL,
  owner_revenue BIGINT NOT NULL,
  admin_revenue BIGINT NOT NULL,
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  renter_ip TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rentals_renter ON safe_house_rentals(renter_id);
CREATE INDEX IF NOT EXISTS idx_rentals_property ON safe_house_rentals(player_property_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON safe_house_rentals(status);

-- ============ 4. ADMIN WALLET ============
CREATE TABLE IF NOT EXISTS admin_wallet (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  amount BIGINT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_source ON admin_wallet(source);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_created ON admin_wallet(created_at);

-- ============ 5. CASINO ============
CREATE TABLE IF NOT EXISTS casino_games (
  id SERIAL PRIMARY KEY,
  casino_property_id INTEGER REFERENCES player_properties(id),
  player_id INTEGER NOT NULL REFERENCES players(id),
  game_type TEXT NOT NULL,
  bet_amount BIGINT NOT NULL,
  commission BIGINT NOT NULL,
  effective_bet BIGINT NOT NULL,
  result TEXT NOT NULL,
  payout BIGINT NOT NULL DEFAULT 0,
  net_profit BIGINT NOT NULL,
  game_data JSONB,
  played_at TIMESTAMP DEFAULT NOW(),
  player_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_casino_games_player ON casino_games(player_id);

CREATE TABLE IF NOT EXISTS casino_daily_limits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  game_type TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  total_bet BIGINT NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(player_id, game_type, date)
);
CREATE INDEX IF NOT EXISTS idx_casino_daily_player_date ON casino_daily_limits(player_id, date);

-- Active blackjack sessions (server-authoritative state)
CREATE TABLE IF NOT EXISTS blackjack_sessions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL UNIQUE REFERENCES players(id),
  casino_property_id INTEGER REFERENCES player_properties(id),
  bet_amount BIGINT NOT NULL,
  commission BIGINT NOT NULL,
  effective_bet BIGINT NOT NULL,
  player_hand JSONB NOT NULL,
  dealer_hand JSONB NOT NULL,
  deck_seed TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============ 6. AMMO TYPES (extend existing ammo table) ============
ALTER TABLE ammo ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE ammo ADD COLUMN IF NOT EXISTS name_ar TEXT NOT NULL DEFAULT '';
UPDATE ammo SET slug = LOWER(REPLACE(type, ' ', '_')) WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ammo_slug ON ammo(slug);
