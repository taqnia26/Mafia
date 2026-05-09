import { db } from "./db";
import {
  playersTable, attacksTable, weaponsTable,
  playerNpcGuardsTable, npcBodyguardsTable,
} from "@workspace/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
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

      const npcGuards = await db
        .select({ defensePower: npcBodyguardsTable.defensePower })
        .from(playerNpcGuardsTable)
        .leftJoin(npcBodyguardsTable, eq(playerNpcGuardsTable.npcGuardId, npcBodyguardsTable.id))
        .where(eq(playerNpcGuardsTable.playerId, target[0].id));

      const guardBonus = npcGuards.reduce((sum, g) => sum + (g.defensePower ?? 0), 0);
      const totalDefense = target[0].defensePower + guardBonus;

      const weaponBonus = weapon[0]?.attackPower ?? 0;
      const attackPower = attacker[0].attackPower + weaponBonus + (attack.ammoUsed * 2);
      const damage = Math.max(0, attackPower - totalDefense);
      const targetSurvived = totalDefense >= attackPower;

      if (!targetSurvived) {
        const moneyStolen = Math.min(
          target[0].money,
          Math.floor(damage * 10),
        );
        const xpGain = 50 + Math.floor(damage / 2);

        await db.transaction(async (tx) => {
          await tx
            .update(attacksTable)
            .set({ status: "completed", damageDealt: damage, targetSurvived: false })
            .where(eq(attacksTable.id, attack.id));

          await tx
            .update(playersTable)
            .set({
              killCount: sql`${playersTable.killCount} + 1`,
              money: sql`${playersTable.money} + ${moneyStolen}`,
              xp: sql`${playersTable.xp} + ${xpGain}`,
              level: sql`FLOOR((${playersTable.xp} + ${xpGain}) / 1000) + 1`,
              updatedAt: new Date(),
            })
            .where(eq(playersTable.id, attacker[0].id));

          await tx
            .update(playersTable)
            .set({
              deathCount: sql`${playersTable.deathCount} + 1`,
              money: sql`GREATEST(0, ${playersTable.money} - ${moneyStolen})`,
              updatedAt: new Date(),
            })
            .where(eq(playersTable.id, target[0].id));
        });

        await logActivity(
          attacker[0].id,
          "attack_won",
          `Won attack on ${target[0].username} — dealt ${damage} dmg, stole $${moneyStolen}`,
        );
        await logActivity(
          target[0].id,
          "attack_lost",
          `Lost against ${attacker[0].username} — took ${damage} dmg, lost $${moneyStolen}`,
        );
      } else {
        await db
          .update(attacksTable)
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
