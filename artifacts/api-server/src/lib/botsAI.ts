/**
 * Bot AI loop — runs every worker tick to make bot players act autonomously.
 * Bots can: attack other bots/players, buy properties, gamble at casino.
 * Combat resolution uses the existing attacksTable + processAttackArrivals worker.
 */
import { db } from "./db";
import {
  playersTable, attacksTable, weaponsTable, playerWeaponsTable, playerAmmoTable, ammoTable,
  citiesTable, playerRankProgressTable, propertyTypesTable, playerPropertiesTable,
  casinoGamesTable,
} from "@workspace/db/schema";
import { and, eq, ne, sql, lte, gte, isNull, or, desc, asc } from "drizzle-orm";
import { logger } from "./logger";

// Tunables — keep low so a few bots act per tick (every 30s)
const BOTS_TO_PICK_PER_TICK = 8;
const ATTACK_PROBABILITY = 0.35;
const PROPERTY_PROBABILITY = 0.25;
const GAMBLE_PROBABILITY = 0.20;
// Rest of probability = idle
const ATTACK_RANK_WINDOW = 2; // bots only attack within ±2 ranks
const ALLOW_BOT_ATTACK_PLAYERS = true; // when false, bots only attack bots
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min between actions per bot

// In-memory cooldown (resets on server restart — acceptable)
const lastActionAt = new Map<number, number>();

function pickRandom<T>(arr: T[]): T | null {
  return arr.length === 0 ? null : arr[Math.floor(Math.random() * arr.length)];
}

async function getBotRank(playerId: number): Promise<number> {
  const [row] = await db.select({ r: playerRankProgressTable.currentRank })
    .from(playerRankProgressTable)
    .where(eq(playerRankProgressTable.playerId, playerId))
    .limit(1);
  return row?.r ?? 1;
}

async function pickActiveBots(limit: number): Promise<typeof playersTable.$inferSelect[]> {
  // Alive, not-traveling, not-in-prison bots
  return db.select().from(playersTable)
    .where(and(
      sql`${playersTable.clerkId} LIKE 'bot_%'`,
      eq(playersTable.isPermanentlyDead, false),
      eq(playersTable.isTraveling, false),
      eq(playersTable.isInPrison, false),
    ))
    .orderBy(sql`RANDOM()`)
    .limit(limit);
}

// ──────────────────────────────────────────────────────────────────────────────
// ACTION: ATTACK
// ──────────────────────────────────────────────────────────────────────────────
async function botAttack(bot: typeof playersTable.$inferSelect): Promise<boolean> {
  const botRank = await getBotRank(bot.id);

  // Find a target within rank window — prefer bots, optionally players
  const minRank = Math.max(1, botRank - ATTACK_RANK_WINDOW);
  const maxRank = Math.min(12, botRank + ATTACK_RANK_WINDOW);

  const targetClause = ALLOW_BOT_ATTACK_PLAYERS
    ? sql`TRUE`
    : sql`${playersTable.clerkId} LIKE 'bot_%'`;

  const candidates = await db.select({
    id: playersTable.id, username: playersTable.username, cityId: playersTable.cityId,
    rank: playerRankProgressTable.currentRank,
  })
    .from(playersTable)
    .innerJoin(playerRankProgressTable, eq(playerRankProgressTable.playerId, playersTable.id))
    .where(and(
      ne(playersTable.id, bot.id),
      eq(playersTable.isPermanentlyDead, false),
      eq(playersTable.inSafeHouse, false),
      gte(playerRankProgressTable.currentRank, minRank),
      lte(playerRankProgressTable.currentRank, maxRank),
      targetClause,
    ))
    .orderBy(sql`RANDOM()`)
    .limit(10);

  const target = pickRandom(candidates);
  if (!target) return false;

  // Get bot's weapon + ammo
  const [weapon] = await db.select().from(weaponsTable)
    .where(bot.equippedWeaponId
      ? eq(weaponsTable.id, bot.equippedWeaponId)
      : sql`FALSE`)
    .limit(1);
  if (!weapon) return false;

  const ammoRows = await db.select({ qty: playerAmmoTable.quantity, id: playerAmmoTable.id })
    .from(playerAmmoTable)
    .innerJoin(ammoTable, eq(ammoTable.id, playerAmmoTable.ammoId))
    .where(and(
      eq(playerAmmoTable.playerId, bot.id),
      eq(ammoTable.type, weapon.ammoType),
    ));
  const totalAmmo = ammoRows.reduce((s, r) => s + r.qty, 0);

  // Reasonable ammo per attack: 50-300 depending on rank
  const desiredAmmo = Math.min(totalAmmo, Math.max(50, Math.min(300, botRank * 30)));
  if (desiredAmmo < 20) {
    // Restock ammo (bots have infinite money for ammo so they keep playing)
    const ammoCatalog = await db.select().from(ammoTable)
      .where(eq(ammoTable.type, weapon.ammoType)).limit(1);
    if (ammoCatalog[0]) {
      await db.insert(playerAmmoTable).values({
        playerId: bot.id, ammoId: ammoCatalog[0].id, quantity: 500,
      });
    }
    return false;
  }

  // Travel time: 1-3 minutes (much shorter than real players for excitement)
  const travelMs = (1 + Math.random() * 2) * 60 * 1000;
  const arrivalAt = new Date(Date.now() + travelMs);

  // Deduct ammo + insert attack
  await db.transaction(async (tx) => {
    let remaining = desiredAmmo;
    for (const row of ammoRows) {
      if (remaining <= 0) break;
      const deduct = Math.min(row.qty, remaining);
      const newQty = row.qty - deduct;
      if (newQty === 0) {
        await tx.delete(playerAmmoTable).where(eq(playerAmmoTable.id, row.id));
      } else {
        await tx.update(playerAmmoTable).set({ quantity: newQty })
          .where(eq(playerAmmoTable.id, row.id));
      }
      remaining -= deduct;
    }

    await tx.insert(attacksTable).values({
      attackerId: bot.id,
      targetId: target.id,
      weaponId: weapon.id,
      ammoUsed: desiredAmmo,
      fromCityId: bot.cityId,
      toCityId: target.cityId,
      status: "traveling",
      travelArrivalAt: arrivalAt,
    });
  });

  logger.info(
    { bot: bot.username, target: target.username, ammo: desiredAmmo, eta: arrivalAt.toISOString() },
    "bot-ai: attack launched",
  );
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// ACTION: BUY PROPERTY
// ──────────────────────────────────────────────────────────────────────────────
async function botBuyProperty(bot: typeof playersTable.$inferSelect): Promise<boolean> {
  const botRank = await getBotRank(bot.id);

  // Pick affordable property they don't already own
  const owned = await db.select({ id: playerPropertiesTable.propertyTypeId })
    .from(playerPropertiesTable)
    .where(eq(playerPropertiesTable.playerId, bot.id));
  const ownedIds = new Set(owned.map(o => o.id));

  const types = await db.select().from(propertyTypesTable)
    .where(and(
      eq(propertyTypesTable.isActive, true),
      eq(propertyTypesTable.isReactor, false),
      eq(propertyTypesTable.isSupremeFortress, false),
      lte(propertyTypesTable.requiredLevel, bot.level),
      or(isNull(propertyTypesTable.minRank), lte(propertyTypesTable.minRank, botRank))!,
    ));

  const affordable = types.filter(t =>
    !ownedIds.has(t.id) && bot.money >= t.price,
  );
  const target = pickRandom(affordable);
  if (!target) return false;

  await db.transaction(async (tx) => {
    await tx.insert(playerPropertiesTable).values({
      playerId: bot.id,
      propertyTypeId: target.id,
      level: 1,
    });
    await tx.update(playersTable)
      .set({ money: sql`${playersTable.money} - ${target.price}`, updatedAt: new Date() })
      .where(eq(playersTable.id, bot.id));
  });

  logger.info(
    { bot: bot.username, property: target.nameEn, price: target.price },
    "bot-ai: property purchased",
  );
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// ACTION: GAMBLE
// ──────────────────────────────────────────────────────────────────────────────
async function botGamble(bot: typeof playersTable.$inferSelect): Promise<boolean> {
  // Bet 1-5% of liquid money, capped
  const maxBet = Math.min(bot.money, 50_000_000);
  const bet = Math.floor(maxBet * (0.01 + Math.random() * 0.04));
  if (bet < 1000) return false;

  // 48% win, 52% loss (house edge)
  const won = Math.random() < 0.48;
  const commission = Math.floor(bet * 0.05);
  const effectiveBet = bet - commission;
  const payout = won ? effectiveBet * 2 : 0;
  const netProfit = payout - bet;

  await db.transaction(async (tx) => {
    await tx.insert(casinoGamesTable).values({
      playerId: bot.id,
      gameType: "blackjack",
      betAmount: bet,
      commission,
      effectiveBet,
      result: won ? "win" : "lose",
      payout,
      netProfit,
      gameData: { bot: true },
    });
    await tx.update(playersTable)
      .set({
        money: sql`GREATEST(0, ${playersTable.money} + ${netProfit})`,
        updatedAt: new Date(),
      })
      .where(eq(playersTable.id, bot.id));
  });

  logger.info(
    { bot: bot.username, bet, won, netProfit },
    "bot-ai: gambled",
  );
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN TICK
// ──────────────────────────────────────────────────────────────────────────────
export async function processBotActions(): Promise<void> {
  try {
    const bots = await pickActiveBots(BOTS_TO_PICK_PER_TICK);
    if (bots.length === 0) return;

    let actionsTaken = 0;
    const now = Date.now();

    for (const bot of bots) {
      const last = lastActionAt.get(bot.id) ?? 0;
      if (now - last < COOLDOWN_MS) continue;

      const roll = Math.random();
      let acted = false;
      try {
        if (roll < ATTACK_PROBABILITY) {
          acted = await botAttack(bot);
        } else if (roll < ATTACK_PROBABILITY + PROPERTY_PROBABILITY) {
          acted = await botBuyProperty(bot);
        } else if (roll < ATTACK_PROBABILITY + PROPERTY_PROBABILITY + GAMBLE_PROBABILITY) {
          acted = await botGamble(bot);
        }
      } catch (err) {
        logger.error({ err, botId: bot.id, botUsername: bot.username }, "bot-ai: action error");
      }

      if (acted) {
        lastActionAt.set(bot.id, now);
        actionsTaken++;
      }
    }

    if (actionsTaken > 0) {
      logger.info({ count: actionsTaken, scanned: bots.length }, "bot-ai: tick complete");
    }
  } catch (err) {
    logger.error({ err }, "bot-ai: tick failed");
  }
}
