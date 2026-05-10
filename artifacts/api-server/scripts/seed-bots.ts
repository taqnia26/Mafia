import { Pool } from "pg";

type BotSpec = {
  username: string;
  rank: number;
  level: number;
  money: number;
  bank: number;
  xp: number;
  atk: number;
  def: number;
  hp: number;
  kills: number;
};

const BOTS: BotSpec[] = [
  { username: "أبو_عقاب", rank: 1, level: 2, money: 3000, bank: 0, xp: 50, atk: 12, def: 11, hp: 100, kills: 0 },
  { username: "StreetMike", rank: 1, level: 3, money: 4500, bank: 1000, xp: 120, atk: 14, def: 12, hp: 100, kills: 1 },
  { username: "ذئب_الحارة", rank: 2, level: 6, money: 12000, bank: 5000, xp: 600, atk: 22, def: 20, hp: 110, kills: 3 },
  { username: "VinnyTheRat", rank: 2, level: 7, money: 18000, bank: 8000, xp: 850, atk: 25, def: 22, hp: 110, kills: 4 },
  { username: "صقر_الليل", rank: 3, level: 12, money: 75000, bank: 30000, xp: 2400, atk: 38, def: 35, hp: 130, kills: 8 },
  { username: "TonyBlades", rank: 3, level: 14, money: 95000, bank: 45000, xp: 3200, atk: 42, def: 38, hp: 130, kills: 10 },
  { username: "ابن_الشوارع", rank: 4, level: 22, money: 450000, bank: 200000, xp: 9000, atk: 65, def: 60, hp: 160, kills: 18 },
  { username: "JimmyKnuckles", rank: 4, level: 24, money: 600000, bank: 350000, xp: 11000, atk: 70, def: 65, hp: 160, kills: 22 },
  { username: "أسد_بغداد", rank: 5, level: 35, money: 2500000, bank: 1500000, xp: 32000, atk: 95, def: 88, hp: 200, kills: 40 },
  { username: "RedFingerSal", rank: 5, level: 38, money: 3200000, bank: 2000000, xp: 38000, atk: 100, def: 92, hp: 200, kills: 48 },
  { username: "ملك_الظلام", rank: 6, level: 50, money: 12000000, bank: 8000000, xp: 95000, atk: 135, def: 125, hp: 250, kills: 75 },
  { username: "BloodyFranco", rank: 6, level: 55, money: 15000000, bank: 12000000, xp: 110000, atk: 145, def: 135, hp: 250, kills: 90 },
  { username: "خنجر_الموت", rank: 7, level: 70, money: 45000000, bank: 30000000, xp: 250000, atk: 185, def: 170, hp: 320, kills: 140 },
  { username: "IronJack", rank: 8, level: 90, money: 120000000, bank: 90000000, xp: 580000, atk: 240, def: 220, hp: 400, kills: 220 },
  { username: "سلطان_الجريمة", rank: 8, level: 95, money: 150000000, bank: 110000000, xp: 650000, atk: 255, def: 235, hp: 400, kills: 245 },
  { username: "DonCarlito", rank: 9, level: 120, money: 380000000, bank: 280000000, xp: 1400000, atk: 320, def: 295, hp: 500, kills: 360 },
  { username: "أمير_الدم", rank: 10, level: 150, money: 850000000, bank: 600000000, xp: 2800000, atk: 400, def: 370, hp: 620, kills: 520 },
  { username: "ShadowVito", rank: 10, level: 160, money: 950000000, bank: 700000000, xp: 3100000, atk: 420, def: 390, hp: 620, kills: 560 },
  { username: "إمبراطور_الليل", rank: 11, level: 200, money: 1800000000, bank: 5000000000, xp: 6500000, atk: 520, def: 480, hp: 800, kills: 850 },
  { username: "TheGodfather", rank: 12, level: 280, money: 2000000000, bank: 15000000000, xp: 14000000, atk: 680, def: 620, hp: 1000, kills: 1500 },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const wipe = process.argv.includes("--wipe");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Pick first city for bots
  const { rows: cityRows } = await pool.query<{ id: number; name: string }>(
    "SELECT id, name FROM cities ORDER BY id ASC LIMIT 1",
  );
  if (cityRows.length === 0) {
    console.error("No cities found. Run the main seed first.");
    process.exit(1);
  }
  const cityId = cityRows[0].id;
  console.log(`Using city: ${cityRows[0].name} (id=${cityId})`);

  if (wipe) {
    console.log("Wiping existing bots (clerk_id LIKE 'bot_%')...");
    await pool.query("DELETE FROM players WHERE clerk_id LIKE 'bot_%'");
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < BOTS.length; i++) {
    const b = BOTS[i];
    const clerkId = `bot_${String(i + 1).padStart(3, "0")}`;

    const insertResult = await pool.query<{ id: number }>(
      `INSERT INTO players (
        clerk_id, username, level, xp, money, bank_balance,
        attack_power, defense_power, kill_count,
        city_id, health, max_health
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (clerk_id) DO NOTHING
      RETURNING id`,
      [clerkId, b.username, b.level, b.xp, b.money, b.bank,
       b.atk, b.def, b.kills, cityId, b.hp, b.hp],
    );

    let playerId: number;
    if (insertResult.rows.length > 0) {
      playerId = insertResult.rows[0].id;
      inserted++;
    } else {
      const { rows } = await pool.query<{ id: number }>(
        "SELECT id FROM players WHERE clerk_id = $1",
        [clerkId],
      );
      playerId = rows[0].id;
      skipped++;
    }

    // Set rank progress
    await pool.query(
      `INSERT INTO player_rank_progress (player_id, current_rank)
       VALUES ($1, $2)
       ON CONFLICT (player_id) DO UPDATE SET current_rank = EXCLUDED.current_rank`,
      [playerId, b.rank],
    );

    console.log(`  ${insertResult.rows.length > 0 ? "+" : "="} ${b.username.padEnd(20)} rank=${b.rank} lvl=${b.level} $${b.money.toLocaleString()}`);
  }

  console.log(`\n✅ Done. Inserted ${inserted} new bots, ${skipped} already existed.`);
  console.log(`   Total bots in system: ${BOTS.length}`);
  await pool.end();
}

main().catch((e) => {
  console.error("Bot seed failed:", e);
  process.exit(1);
});
