-- Migration: Nuclear Reactor property type
-- Applied: 2026-05-10

-- 1. Add reactor flag to property catalog
ALTER TABLE property_types ADD COLUMN IF NOT EXISTS is_reactor boolean NOT NULL DEFAULT false;

-- 2. Per-property reactor state
CREATE TABLE IF NOT EXISTS nuclear_reactor_state (
  id serial PRIMARY KEY,
  player_property_id integer NOT NULL UNIQUE REFERENCES player_properties(id) ON DELETE CASCADE,
  city_id integer NOT NULL REFERENCES cities(id),
  energy_units integer NOT NULL DEFAULT 0,
  integrity integer NOT NULL DEFAULT 100,
  last_payout_at timestamp NOT NULL DEFAULT now(),
  is_under_construction boolean NOT NULL DEFAULT true,
  construction_complete_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reactor_state_pp ON nuclear_reactor_state (player_property_id);
CREATE INDEX IF NOT EXISTS idx_reactor_state_construction
  ON nuclear_reactor_state (is_under_construction, construction_complete_at);

-- 3. Seed the reactor property type (idempotent — skip if already present)
INSERT INTO property_types (
  name_en, name_ar, description_en, description_ar,
  price, base_income_per_hour, required_level, max_level,
  icon, perks_en, perks_ar, is_reactor
)
SELECT
  'Nuclear Reactor',
  'مفاعل نووي',
  'A massive nuclear reactor selling energy units to NPCs. Extremely expensive, generates massive passive income, but vulnerable to sabotage.',
  'مفاعل نووي ضخم يبيع وحدات الطاقة لشخصيات غير اللاعبين. باهظ الثمن، يدر دخلاً سلبياً ضخماً، لكنه عرضة للتخريب.',
  50000000, 500000, 30, 1,
  'atom',
  'Massive passive income — vulnerable to attacks',
  'دخل سلبي ضخم — عرضة للهجمات',
  true
WHERE NOT EXISTS (SELECT 1 FROM property_types WHERE is_reactor = true);
