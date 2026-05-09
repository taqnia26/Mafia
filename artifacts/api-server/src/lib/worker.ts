import { db } from "./db";
import {
  playersTable, attacksTable, weaponsTable,
  playerNpcGuardsTable, npcBodyguardsTable, playerGuardsTable,
} from "@workspace/db/schema";
import { eq, and, lte, sql, sum } from "drizzle-orm";
import { logActivity } from "./activityLog";
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

      // target.defensePower already includes NPC guard bonuses (added on hire, removed on dismiss).
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

            await tx.update(playersTable).set({
              health: targetDied ? 50 : Math.max(1, newHealth),
              deathCount: targetDied ? sql`${playersTable.deathCount} + 1` : playersTable.deathCount,
              money: sql`GREATEST(0, ${playersTable.money} - ${moneyStolen})`,
              updatedAt: new Date(),
            }).where(eq(playersTable.id, target[0].id));
          });

          await logActivity(
            attacker[0].id,
            "attack_won",
            `Won attack on ${target[0].username} — dealt ${damage} dmg, stole $${moneyStolen}${targetDied ? " (eliminated!)" : ""}`,
          );
          await logActivity(
            target[0].id,
            "attack_lost",
            `Lost against ${attacker[0].username} — took ${damage} dmg, lost $${moneyStolen}${targetDied ? " (eliminated — HP reset to 50)" : ""}`,
          );
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

async function tick(): Promise<void> {
  try {
    await Promise.all([
      processTravelArrivals(),
      processPrisonReleases(),
      processAttackArrivals(),
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
