import { Pool } from "pg";

// ──────────────────────────────────────────────────────────────────────────────
// BOT NAME POOLS
// ──────────────────────────────────────────────────────────────────────────────
const ARABIC_PREFIXES = [
  "أبو", "ابن", "ذئب", "صقر", "أسد", "ملك", "أمير", "سلطان", "خنجر", "ظل",
  "نسر", "نمر", "فهد", "صدى", "ليث", "عقاب", "حارس", "خفير", "سيف", "رصاصة",
  "إمبراطور", "زعيم", "قائد", "بارون", "مافيا", "كابو", "دون",
];
const ARABIC_SUFFIXES = [
  "الليل", "الظلام", "الموت", "الدم", "النار", "الجريمة", "الشوارع", "بغداد",
  "الحارة", "الصحراء", "العاصفة", "الجبل", "الرعد", "الهلاك", "الانتقام",
  "السيف", "الذئاب", "العقارب", "الغضب", "الصمت", "الدمار",
];
const ENGLISH_FIRST = [
  "Vinny", "Tony", "Jimmy", "Sal", "Frank", "Carlito", "Vito", "Joey",
  "Mickey", "Sonny", "Rocco", "Marco", "Bruno", "Nico", "Dante", "Luca",
  "Enzo", "Paulie", "Angelo", "Gino", "Rico", "Don", "Big", "Slick",
  "Iron", "Bloody", "Shadow", "Reaper", "Phantom", "Wolf", "Viper",
];
const ENGLISH_LAST = [
  "Knuckles", "Blades", "Blackhand", "TheRat", "Cigar", "Shotgun", "Diamond",
  "TheHammer", "Stiletto", "Cement", "Tombstone", "Razor", "Bullet", "Steel",
  "Hawk", "Cobra", "Falcon", "Reaper", "Mancini", "Russo", "Genovese",
  "Marciano", "Castellano", "Lombardi", "Bonanno",
];

function randomName(): string {
  const useArabic = Math.random() < 0.5;
  if (useArabic) {
    const p = ARABIC_PREFIXES[Math.floor(Math.random() * ARABIC_PREFIXES.length)];
    const s = ARABIC_SUFFIXES[Math.floor(Math.random() * ARABIC_SUFFIXES.length)];
    return `${p}_${s}`;
  }
  const f = ENGLISH_FIRST[Math.floor(Math.random() * ENGLISH_FIRST.length)];
  const l = ENGLISH_LAST[Math.floor(Math.random() * ENGLISH_LAST.length)];
  return `${f}${l}${Math.floor(Math.random() * 999)}`;
}

// Pyramid distribution: lots at low ranks, fewer at top
// rank → count
const RANK_DISTRIBUTION: Record<number, number> = {
  1: 60, 2: 55, 3: 45, 4: 35, 5: 28, 6: 22,
  7: 18, 8: 14, 9: 10, 10: 8, 11: 4, 12: 1,
};

// Stat scaling per rank
type RankProfile = {
  level: [number, number];
  money: [number, number];
  bank: [number, number];
  xp: [number, number];
  atk: [number, number];
  def: [number, number];
  hp: [number, number];
  kills: [number, number];
  ammoQty: [number, number];
  propertyCount: [number, number];
};
const RANK_PROFILES: Record<number, RankProfile> = {
  1:  { level: [1, 4],     money: [2000, 6000],         bank: [0, 2000],            xp: [0, 200],         atk: [10, 16],   def: [10, 14],   hp: [100, 110],  kills: [0, 2],     ammoQty: [50, 200],     propertyCount: [0, 0] },
  2:  { level: [5, 9],     money: [10000, 25000],       bank: [3000, 10000],        xp: [400, 1200],      atk: [20, 28],   def: [18, 25],   hp: [110, 125],  kills: [2, 5],     ammoQty: [100, 400],    propertyCount: [0, 1] },
  3:  { level: [10, 17],   money: [60000, 150000],      bank: [20000, 80000],       xp: [2000, 5000],     atk: [35, 50],   def: [32, 45],   hp: [125, 145],  kills: [5, 12],    ammoQty: [200, 700],    propertyCount: [1, 2] },
  4:  { level: [18, 28],   money: [350000, 800000],     bank: [150000, 500000],     xp: [7000, 14000],    atk: [60, 80],   def: [55, 75],   hp: [145, 175],  kills: [12, 25],   ammoQty: [400, 1200],   propertyCount: [1, 3] },
  5:  { level: [30, 45],   money: [1800000, 4000000],   bank: [1000000, 3000000],   xp: [25000, 50000],   atk: [85, 110],  def: [80, 105],  hp: [175, 215],  kills: [25, 50],   ammoQty: [800, 2500],   propertyCount: [2, 4] },
  6:  { level: [45, 65],   money: [8000000, 18000000],  bank: [5000000, 15000000],  xp: [70000, 130000],  atk: [120, 155], def: [115, 145], hp: [220, 270],  kills: [50, 100],  ammoQty: [1500, 4000],  propertyCount: [3, 5] },
  7:  { level: [60, 85],   money: [30000000, 65000000], bank: [20000000, 50000000], xp: [180000, 320000], atk: [165, 210], def: [155, 195], hp: [280, 340],  kills: [100, 180], ammoQty: [2500, 6000],  propertyCount: [4, 6] },
  8:  { level: [80, 110],  money: [80000000, 180000000],bank: [60000000, 130000000],xp: [400000, 800000], atk: [220, 280], def: [205, 260], hp: [340, 420],  kills: [180, 280], ammoQty: [4000, 9000],  propertyCount: [5, 7] },
  9:  { level: [110, 140], money: [250000000, 500000000], bank: [200000000, 400000000], xp: [1000000, 2000000], atk: [290, 360], def: [270, 335], hp: [430, 520], kills: [280, 420], ammoQty: [6000, 12000], propertyCount: [6, 8] },
  10: { level: [140, 180], money: [600000000, 1200000000], bank: [500000000, 1000000000], xp: [2200000, 4500000], atk: [380, 460], def: [350, 425], hp: [540, 660], kills: [420, 620], ammoQty: [8000, 15000], propertyCount: [7, 10] },
  11: { level: [180, 240], money: [1300000000, 1900000000], bank: [1500000000, 4000000000], xp: [5000000, 9000000], atk: [490, 580], def: [450, 535], hp: [680, 850], kills: [620, 950], ammoQty: [12000, 20000], propertyCount: [9, 12] },
  12: { level: [260, 350], money: [1900000000, 2100000000], bank: [10000000000, 20000000000], xp: [12000000, 20000000], atk: [620, 750], def: [580, 700], hp: [900, 1100], kills: [1200, 2000], ammoQty: [20000, 40000], propertyCount: [12, 18] },
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randRange(r: [number, number]): number { return rand(r[0], r[1]); }

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const wipe = process.argv.includes("--wipe");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Cities
  const { rows: cities } = await pool.query<{ id: number; name: string }>(
    "SELECT id, name FROM cities ORDER BY id ASC",
  );
  if (cities.length === 0) {
    console.error("No cities found. Run the main seed first.");
    process.exit(1);
  }
  console.log(`Found ${cities.length} cities`);

  // Weapons (ordered by power — we'll assign based on bot rank)
  const { rows: weapons } = await pool.query<{ id: number; name: string; attack_power: number; ammo_type: string }>(
    "SELECT id, name, attack_power, ammo_type FROM weapons ORDER BY attack_power ASC",
  );
  if (weapons.length === 0) {
    console.error("No weapons found. Run the main seed first.");
    process.exit(1);
  }

  // Ammo lookup by type
  const { rows: ammoRows } = await pool.query<{ id: number; type: string }>(
    "SELECT id, type FROM ammo",
  );
  const ammoByType = new Map(ammoRows.map(a => [a.type, a.id]));

  // Property types eligible to be auto-built (skip reactor and supreme fortress)
  const { rows: propTypes } = await pool.query<{ id: number; name_en: string; price: number; required_level: number; min_rank: number | null; max_per_city: number; is_reactor: boolean; is_supreme_fortress: boolean }>(
    `SELECT id, name_en, price, required_level, min_rank, max_per_city, is_reactor, is_supreme_fortress
     FROM property_types
     WHERE is_active = TRUE AND is_reactor = FALSE AND is_supreme_fortress = FALSE
     ORDER BY required_level ASC, price ASC`,
  );

  if (wipe) {
    console.log("Wiping existing bots (clerk_id LIKE 'bot_%')...");
    await pool.query("DELETE FROM players WHERE clerk_id LIKE 'bot_%'");
  }

  // Find next bot index so we don't collide on re-runs
  const { rows: existingBots } = await pool.query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(clerk_id FROM 'bot_(\\d+)') AS INTEGER))::text AS max
     FROM players WHERE clerk_id ~ '^bot_\\d+$'`,
  );
  let nextIndex = (Number(existingBots[0]?.max) || 0) + 1;

  let totalInserted = 0;
  let totalSkipped = 0;
  const usernameSet = new Set<string>();

  for (const [rankStr, count] of Object.entries(RANK_DISTRIBUTION)) {
    const rank = Number(rankStr);
    const profile = RANK_PROFILES[rank];
    console.log(`\n── Rank ${rank}: creating ${count} bots ──`);

    for (let i = 0; i < count; i++) {
      // Generate unique username
      let username = randomName();
      let attempts = 0;
      while (usernameSet.has(username) && attempts < 20) {
        username = randomName() + rand(1, 999);
        attempts++;
      }
      usernameSet.add(username);

      const clerkId = `bot_${String(nextIndex++).padStart(4, "0")}`;
      const cityId = cities[rand(0, cities.length - 1)].id;

      // Pick weapon based on rank tier
      const weaponIndex = Math.min(
        weapons.length - 1,
        Math.floor((rank - 1) * (weapons.length / 12)) + rand(0, 1),
      );
      const weapon = weapons[weaponIndex];

      try {
        const insertResult = await pool.query<{ id: number }>(
          `INSERT INTO players (
            clerk_id, username, level, xp, money, bank_balance,
            attack_power, defense_power, kill_count,
            city_id, health, max_health, equipped_weapon_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT DO NOTHING
          RETURNING id`,
          [
            clerkId, username,
            randRange(profile.level), randRange(profile.xp),
            randRange(profile.money), randRange(profile.bank),
            randRange(profile.atk), randRange(profile.def),
            randRange(profile.kills),
            cityId,
            randRange(profile.hp), randRange(profile.hp),
            weapon.id,
          ],
        );

        if (insertResult.rows.length === 0) {
          totalSkipped++;
          continue;
        }
        const playerId = insertResult.rows[0].id;
        totalInserted++;

        // Rank progress
        await pool.query(
          `INSERT INTO player_rank_progress (player_id, current_rank)
           VALUES ($1, $2)
           ON CONFLICT (player_id) DO UPDATE SET current_rank = EXCLUDED.current_rank`,
          [playerId, rank],
        );

        // Equip weapon (also store in inventory)
        await pool.query(
          `INSERT INTO player_weapons (player_id, weapon_id, quantity)
           VALUES ($1, $2, 1)
           ON CONFLICT DO NOTHING`,
          [playerId, weapon.id],
        );

        // Give ammo for that weapon
        const ammoId = ammoByType.get(weapon.ammo_type);
        if (ammoId) {
          await pool.query(
            `INSERT INTO player_ammo (player_id, ammo_id, quantity) VALUES ($1, $2, $3)`,
            [playerId, ammoId, randRange(profile.ammoQty)],
          );
        }

        // Build properties (skip if no eligible types)
        const propCount = randRange(profile.propertyCount);
        if (propCount > 0 && propTypes.length > 0) {
          const eligible = propTypes.filter(p =>
            (p.min_rank == null || p.min_rank <= rank) &&
            p.required_level <= randRange(profile.level)
          );
          if (eligible.length > 0) {
            const owned = new Set<number>();
            for (let pi = 0; pi < propCount; pi++) {
              const pt = eligible[rand(0, eligible.length - 1)];
              if (owned.has(pt.id)) continue;
              owned.add(pt.id);
              const level = rand(1, Math.min(4, Math.max(1, Math.floor(rank / 2))));
              await pool.query(
                `INSERT INTO player_properties (player_id, property_type_id, level)
                 VALUES ($1, $2, $3)`,
                [playerId, pt.id, level],
              );
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("duplicate key")) {
          console.warn(`  ⚠️  ${username}: ${msg}`);
        }
        totalSkipped++;
      }
    }
    process.stdout.write(`   ✓ rank ${rank} done\n`);
  }

  // Final stats
  const { rows: stats } = await pool.query<{ rank: number; cnt: string }>(
    `SELECT prp.current_rank AS rank, COUNT(*)::text AS cnt
     FROM players p
     JOIN player_rank_progress prp ON prp.player_id = p.id
     WHERE p.clerk_id LIKE 'bot_%'
     GROUP BY prp.current_rank ORDER BY prp.current_rank`,
  );
  console.log("\n── Bot population by rank ──");
  for (const s of stats) console.log(`   rank ${String(s.rank).padStart(2)}: ${s.cnt} bots`);
  console.log(`\n✅ Inserted ${totalInserted} new bots, skipped ${totalSkipped}.`);
  await pool.end();
}

main().catch((e) => {
  console.error("Bot seed failed:", e);
  process.exit(1);
});
