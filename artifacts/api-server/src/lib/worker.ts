import { db } from "./db";
import {
  playersTable, attacksTable, weaponsTable,
  playerNpcGuardsTable, npcBodyguardsTable, playerGuardsTable,
  activityLogTable, playerPropertiesTable, propertyTypesTable,
} from "@workspace/db/schema";
import { eq, and, lte, lt, sql } from "drizzle-orm";
import { logActivity } from "./activityLog";
import { createNotification } from "./notifications";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 30_000;

async function processTravelArrivals(): Promise<void> {
  const now = new Date();
  const travelers = await db
    .select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.isTraveling, true),
        lte(playersTable.travelArrivalAt, now),
      ),
    );

  for (const player of travelers) {
    if (!player.travelToCityId) continue;
    await db
      .update(playersTable)
      .set({
        cityId: player.travelToCityId,
        isTraveling: false,
        travelToCityId: null,
        travelArrivalAt: null,
        updatedAt: new Date(),
      })
      .where(eq(playersTable.id, player.id));
    await logActivity(player.id, "arrived", `Arrived in new city`);
  }

  if (travelers.length > 0) {
    logger.info({ count: travelers.length }, "worker: travel arrivals processed");
  }
}

async function processPrisonReleases(): Promise<void> {
  const now = new Date();
  const prisoners = await db
    .select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.isInPrison, true),
        lte(playersTable.prisonReleaseAt, now),
      ),
    );

  for (const player of prisoners) {
    await db
      .update(playersTable)
      .set({
        isInPrison: false,
        prisonReleaseAt: null,
        prisonCrime: null,
        updatedAt: new Date(),
      })
      .where(eq(playersTable.id, player.id));
    await logActivity(player.id, "released", "Released from prison");
  }

  if (prisoners.length > 0) {
    logger.info({ count: prisoners.length }, "worker: prison releases processed");
  }
}

async function processAttackArrivals(): Promise<void> {
  const now = new Date();
  const arrivedAttacks = await db
    .select()
    .from(attacksTable)
    .where(
      and(
        eq(attacksTable.status, "traveling"),
        lte(attacksTable.travelArrivalAt, now),
      ),
    );

  for (const attack of arrivedAttacks) {
    try {
      const [attacker, target, weapon] = await Promise.all([
        db.select().from(playersTable).where(eq(playersTable.id, attack.attackerId)).limit(1),
        db.select().from(playersTable).where(eq(playersTable.id, attack.targetId)).limit(1),
        db.select().from(weaponsTable).where(eq(weaponsTable.id, attack.weaponId)).limit(1),
      ]);

      if (!attacker[0] || !target[0]) {
        await db.update(attacksTable).set({ status: "failed" }).where(eq(attacksTable.id, attack.id));
        continue;
      }

      // Skip and refund-style cancel if the target is already permanently dead.
      // Award no kill/xp/money — the run is already over.
      if (target[0].isPermanentlyDead) {
        await db.update(attacksTable)
          .set({ status: "cancelled", damageDealt: 0, targetSurvived: true })
          .where(eq(attacksTable.id, attack.id));
        await logActivity(
          attacker[0].id,
          "attack_repelled",
          `Attack on ${target[0].username} cancelled — target is already dead`,
        );
        await createNotification(
          attacker[0].id,
          "attack_resolved",
          `⚠️ Your attack on ${target[0].username} was cancelled — they are already dead.`,
          "/attack",
        );
        continue;
      }

      // Combat stat model:
      //   - player.attackPower / player.defensePower are the source of truth for all combat.
      //   - Rank ATK/DEF bonuses are baked directly into these columns at rank-upgrade time
      //     (see routes/ranks.ts POST /ranks/upgrade). No separate lookup is needed here.
      //   - NPC guard defense is also baked in (added on hire, removed on dismiss).
      // Fetch active player guards and add their defensePower on top.
      const activePlayerGuards = await db
        .select({
          id: playerGuardsTable.id,
          guardPlayerId: playerGuardsTable.guardPlayerId,
          guardDefense: playersTable.defensePower,
          guardUsername: playersTable.username,
        })
        .from(playerGuardsTable)
        .leftJoin(playersTable, eq(playerGuardsTable.guardPlayerId, playersTable.id))
        .where(eq(playerGuardsTable.protectedPlayerId, target[0].id));

      const playerGuardBonus = activePlayerGuards.reduce((s, g) => s + (g.guardDefense ?? 0), 0);
      const totalDefense = target[0].defensePower + playerGuardBonus;

      const weaponBonus = weapon[0]?.attackPower ?? 0;
      const totalAttack = weaponBonus * attack.ammoUsed + attacker[0].attackPower;
      const damage = Math.max(1, totalAttack - totalDefense);
      const attackWins = damage > 0;

      if (attackWins) {
        // Guard absorption order: NPC guards first, then player guards
        const firstNpcGuard = await db
          .select({
            id: playerNpcGuardsTable.id,
            defensePower: npcBodyguardsTable.defensePower,
            npcName: npcBodyguardsTable.name,
          })
          .from(playerNpcGuardsTable)
          .leftJoin(npcBodyguardsTable, eq(playerNpcGuardsTable.npcGuardId, npcBodyguardsTable.id))
          .where(eq(playerNpcGuardsTable.playerId, target[0].id))
          .limit(1);

        const firstGuard = firstNpcGuard[0] ?? null;

        if (firstGuard) {
          // NPC guard absorbs the blow
          const guardDef = firstGuard.defensePower ?? 0;
          await db.transaction(async (tx) => {
            await tx.delete(playerNpcGuardsTable).where(eq(playerNpcGuardsTable.id, firstGuard.id));
            if (guardDef > 0) {
              await tx.update(playersTable).set({
                defensePower: sql`GREATEST(10, ${playersTable.defensePower} - ${guardDef})`,
                updatedAt: new Date(),
              }).where(eq(playersTable.id, target[0].id));
            }
            await tx.update(attacksTable)
              .set({ status: "completed", damageDealt: damage, targetSurvived: true })
              .where(eq(attacksTable.id, attack.id));
          });

          await logActivity(
            attacker[0].id,
            "attack_repelled",
            `Attack on ${target[0].username} was intercepted by their NPC bodyguard`,
          );
          await logActivity(
            target[0].id,
            "attack_defended",
            `Your bodyguard ${firstGuard.npcName ?? "Unknown"} sacrificed themselves to protect you from ${attacker[0].username}!`,
          );
          await Promise.all([
            createNotification(attacker[0].id, "attack_resolved", `🛡️ Your attack on ${target[0].username} was blocked by their bodyguard`, "/attack"),
            createNotification(target[0].id, "attack_resolved", `🛡️ ${attacker[0].username}'s attack was intercepted by your bodyguard`, "/attack"),
          ]);
        } else if (activePlayerGuards[0]) {
          // Player guard absorbs the blow — remove them from guard duty
          const pg = activePlayerGuards[0];
          await db.transaction(async (tx) => {
            await tx.delete(playerGuardsTable).where(eq(playerGuardsTable.id, pg.id));
            await tx.update(attacksTable)
              .set({ status: "completed", damageDealt: damage, targetSurvived: true })
              .where(eq(attacksTable.id, attack.id));
          });

          await logActivity(
            attacker[0].id,
            "attack_repelled",
            `Attack on ${target[0].username} was intercepted by their player bodyguard`,
          );
          await logActivity(
            target[0].id,
            "attack_defended",
            `Your guard ${pg.guardUsername ?? "Unknown"} stepped in and protected you from ${attacker[0].username}!`,
          );
          if (pg.guardPlayerId) {
            await logActivity(
              pg.guardPlayerId,
              "guard_dismissed",
              `You took a hit for ${target[0].username} and were dismissed from guard duty.`,
            );
          }
          await Promise.all([
            createNotification(attacker[0].id, "attack_resolved", `🛡️ Your attack on ${target[0].username} was blocked by their player bodyguard`, "/attack"),
            createNotification(target[0].id, "attack_resolved", `🛡️ ${attacker[0].username}'s attack was blocked by your guard`, "/attack"),
          ]);
        } else {
          // No guards — player takes full damage to HP
          const newHealth = target[0].health - damage;
          const targetDied = newHealth <= 0;
          const moneyStolen = Math.min(target[0].money, Math.floor(damage * 10));
          const xpGain = 50 + Math.floor(damage / 2);

          await db.transaction(async (tx) => {
            await tx.update(attacksTable)
              .set({ status: "completed", damageDealt: damage, targetSurvived: !targetDied })
              .where(eq(attacksTable.id, attack.id));

            await tx.update(playersTable).set({
              killCount: targetDied ? sql`${playersTable.killCount} + 1` : playersTable.killCount,
              money: sql`${playersTable.money} + ${moneyStolen}`,
              xp: sql`${playersTable.xp} + ${xpGain}`,
              level: sql`FLOOR((${playersTable.xp} + ${xpGain}) / 1000) + 1`,
              updatedAt: new Date(),
            }).where(eq(playersTable.id, attacker[0].id));

            if (targetDied) {
              await tx.update(playersTable).set({
                health: 0,
                deathCount: sql`${playersTable.deathCount} + 1`,
                money: sql`GREATEST(0, ${playersTable.money} - ${moneyStolen})`,
                isPermanentlyDead: true,
                diedAt: new Date(),
                killedByPlayerId: attacker[0].id,
                deathCause: `Killed by ${attacker[0].username}`,
                updatedAt: new Date(),
              }).where(eq(playersTable.id, target[0].id));
            } else {
              await tx.update(playersTable).set({
                health: Math.max(1, newHealth),
                money: sql`GREATEST(0, ${playersTable.money} - ${moneyStolen})`,
                updatedAt: new Date(),
              }).where(eq(playersTable.id, target[0].id));
            }
          });

          await logActivity(
            attacker[0].id,
            "attack_won",
            `Won attack on ${target[0].username} — dealt ${damage} dmg, stole $${moneyStolen}${targetDied ? " (eliminated!)" : ""}`,
          );
          await logActivity(
            target[0].id,
            "attack_lost",
            `Lost against ${attacker[0].username} — took ${damage} dmg, lost $${moneyStolen}${targetDied ? " (KILLED — permanent death)" : ""}`,
          );
          await Promise.all([
            createNotification(
              attacker[0].id,
              "attack_resolved",
              targetDied
                ? `💀 You eliminated ${target[0].username}! +$${moneyStolen} stolen`
                : `⚔️ Attack on ${target[0].username} landed — ${damage} dmg, $${moneyStolen} stolen`,
              "/attack",
            ),
            createNotification(
              target[0].id,
              "attack_resolved",
              targetDied
                ? `☠️ You were killed by ${attacker[0].username}. Your run is over. -$${moneyStolen}`
                : `⚔️ ${attacker[0].username} attacked you — ${damage} dmg taken, -$${moneyStolen}`,
              "/attack",
            ),
          ]);
        }
      } else {
        // Attack failed — target's defense held
        await db.update(attacksTable)
          .set({ status: "completed", damageDealt: 0, targetSurvived: true })
          .where(eq(attacksTable.id, attack.id));

        await logActivity(
          attacker[0].id,
          "attack_repelled",
          `Attack on ${target[0].username} was repelled`,
        );
        await logActivity(
          target[0].id,
          "attack_defended",
          `Repelled attack from ${attacker[0].username}`,
        );
        await Promise.all([
          createNotification(attacker[0].id, "attack_resolved", `🛡️ Your attack on ${target[0].username} was repelled`, "/attack"),
          createNotification(target[0].id, "attack_resolved", `🛡️ You repelled an attack from ${attacker[0].username}`, "/attack"),
        ]);
      }
    } catch (err) {
      logger.error({ err, attackId: attack.id }, "worker: error resolving attack");
      await db
        .update(attacksTable)
        .set({ status: "failed" })
        .where(eq(attacksTable.id, attack.id));
    }
  }

  if (arrivedAttacks.length > 0) {
    logger.info({ count: arrivedAttacks.length }, "worker: attacks resolved");
  }
}

const PROPERTY_INCOME_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let lastPropertyIncomeAt = 0;

async function collectPropertyIncome(): Promise<void> {
  const now = Date.now();
  if (now - lastPropertyIncomeAt < PROPERTY_INCOME_INTERVAL_MS) return;
  lastPropertyIncomeAt = now;

  const MAX_HOURS = 24;
  const nowDate = new Date(now);

  try {
    const rows = await db
      .select({
        id: playerPropertiesTable.id,
        playerId: playerPropertiesTable.playerId,
        level: playerPropertiesTable.level,
        lastIncomeCollectedAt: playerPropertiesTable.lastIncomeCollectedAt,
        baseIncomePerHour: propertyTypesTable.baseIncomePerHour,
      })
      .from(playerPropertiesTable)
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id));

    const incomeByPlayer: Record<number, number> = {};

    for (const r of rows) {
      const base = r.baseIncomePerHour ?? 0;
      const hoursElapsed = Math.min(
        (now - r.lastIncomeCollectedAt.getTime()) / 3600000,
        MAX_HOURS,
      );
      const income = Math.floor(hoursElapsed * base * r.level);
      if (income > 0) {
        incomeByPlayer[r.playerId] = (incomeByPlayer[r.playerId] ?? 0) + income;
        await db.update(playerPropertiesTable)
          .set({ lastIncomeCollectedAt: nowDate })
          .where(eq(playerPropertiesTable.id, r.id));
      }
    }

    for (const [playerIdStr, totalIncome] of Object.entries(incomeByPlayer)) {
      const playerId = parseInt(playerIdStr);
      await db.update(playersTable)
        .set({ money: sql`${playersTable.money} + ${totalIncome}`, updatedAt: nowDate })
        .where(eq(playersTable.id, playerId));
    }

    const totalPlayers = Object.keys(incomeByPlayer).length;
    if (totalPlayers > 0) {
      logger.info({ totalPlayers }, "worker: property income collected");
    }
  } catch (err) {
    logger.error({ err }, "worker: property income collection error");
  }
}

const ANTI_SPY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // every hour
let lastAntiSpyCleanupAt = 0;

async function clearExpiredAntiSpy(): Promise<void> {
  const now = Date.now();
  if (now - lastAntiSpyCleanupAt < ANTI_SPY_CLEANUP_INTERVAL_MS) return;
  lastAntiSpyCleanupAt = now;
  try {
    const result = await db.update(playersTable)
      .set({ antiSpyExpiresAt: null, antiSpyEnabled: false, updatedAt: new Date(now) })
      .where(and(
        lte(playersTable.antiSpyExpiresAt, new Date(now)),
      ));
    if ((result.rowCount ?? 0) > 0) {
      logger.info({ count: result.rowCount }, "worker: cleared expired Anti-Spy flags");
    }
  } catch (err) {
    logger.error({ err }, "worker: anti-spy cleanup error");
  }
}

const EVENT_RETENTION_DAYS = 60;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // run every 6 hours
let lastCleanupAt = 0;

async function cleanupOldEvents(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  const cutoff = new Date(now - EVENT_RETENTION_DAYS * 86400000);
  try {
    const result = await db.delete(activityLogTable).where(lt(activityLogTable.createdAt, cutoff));
    if ((result.rowCount ?? 0) > 0) {
      logger.info({ count: result.rowCount, cutoff }, "worker: pruned old activity log events");
    }
  } catch (err) {
    logger.error({ err }, "worker: event cleanup error");
  }
}

async function tick(): Promise<void> {
  try {
    await Promise.all([
      processTravelArrivals(),
      processPrisonReleases(),
      processAttackArrivals(),
      collectPropertyIncome(),
      clearExpiredAntiSpy(),
      cleanupOldEvents(),
    ]);
  } catch (err) {
    logger.error({ err }, "worker: tick error");
  }
}

export function startWorker(): void {
  logger.info("worker: starting background job loop");
  void tick();
  setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
}
