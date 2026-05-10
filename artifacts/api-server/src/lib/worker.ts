import { db } from "./db";
import {
  playersTable, attacksTable, weaponsTable,
  playerNpcGuardsTable, npcBodyguardsTable, playerGuardsTable,
  activityLogTable, playerPropertiesTable, propertyTypesTable,
  nuclearReactorStateTable, notificationsTable,
  bankLoansTable, bankTransactionsTable,
  chatMessagesTable, chatRateLimitsTable, chatRestrictionsTable,
} from "@workspace/db/schema";
import { eq, and, lte, lt, ne, gt, sql } from "drizzle-orm";
import { logActivity } from "./activityLog";
import { createNotification } from "./notifications";
import { logger } from "./logger";
import { REACTOR } from "./reactor";
import { BANK_CONFIG, applyHourlyInterest } from "./bank";

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

          // Reactor sabotage: a successful, unguarded hit also damages every reactor
          // the target owns — independent of HP outcome. Process meltdowns inline.
          try {
            await damageTargetReactors(target[0].id, target[0].username, attacker[0].username);
          } catch (rerr) {
            logger.error({ rerr, targetId: target[0].id }, "worker: reactor damage hook failed");
          }

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
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .where(ne(propertyTypesTable.isReactor, true));

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

const CHAT_RETENTION_DAYS = 7;
const CHAT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // run once per day
let lastChatCleanupAt = 0;

async function cleanupOldChatMessages(): Promise<void> {
  const now = Date.now();
  if (now - lastChatCleanupAt < CHAT_CLEANUP_INTERVAL_MS) return;
  lastChatCleanupAt = now;

  const cutoff = new Date(now - CHAT_RETENTION_DAYS * 86400000);
  const rateLimitCutoff = new Date(now - 3600000); // rate-limit log only needs ~1h
  try {
    const msgRes = await db.delete(chatMessagesTable).where(lt(chatMessagesTable.createdAt, cutoff));
    if ((msgRes.rowCount ?? 0) > 0) {
      logger.info({ count: msgRes.rowCount, cutoff }, "worker: pruned old chat messages");
    }
    const expiredAll = await db.delete(chatRestrictionsTable).where(and(
      sql`${chatRestrictionsTable.expiresAt} IS NOT NULL`,
      lt(chatRestrictionsTable.expiresAt, new Date()),
    )).returning({ playerId: chatRestrictionsTable.playerId, channel: chatRestrictionsTable.channel });
    if (expiredAll.length > 0) {
      logger.info({ count: expiredAll.length }, "worker: pruned expired chat restrictions");
      // For each player whose 'all'-channel restriction expired, clear the
      // mirrored isChatMuted flag (only if no other active 'all' restriction
      // remains for them).
      const allChannelPlayerIds = Array.from(new Set(
        expiredAll.filter(r => r.channel === "all").map(r => r.playerId),
      ));
      for (const pid of allChannelPlayerIds) {
        const stillMuted = await db.select({ id: chatRestrictionsTable.id })
          .from(chatRestrictionsTable)
          .where(and(
            eq(chatRestrictionsTable.playerId, pid),
            eq(chatRestrictionsTable.channel, "all"),
          ))
          .limit(1);
        if (stillMuted.length === 0) {
          await db.update(playersTable)
            .set({ isChatMuted: false, updatedAt: new Date() })
            .where(eq(playersTable.id, pid));
        }
      }
    }
    await db.delete(chatRateLimitsTable).where(lt(chatRateLimitsTable.sentAt, rateLimitCutoff));
  } catch (err) {
    logger.error({ err }, "worker: chat cleanup error");
  }
}

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

async function damageTargetReactors(targetId: number, targetUsername: string, attackerUsername: string): Promise<void> {
  const reactors = await db
    .select({
      stateId: nuclearReactorStateTable.id,
      ppId: nuclearReactorStateTable.playerPropertyId,
      integrity: nuclearReactorStateTable.integrity,
      isUnderConstruction: nuclearReactorStateTable.isUnderConstruction,
    })
    .from(nuclearReactorStateTable)
    .leftJoin(playerPropertiesTable, eq(nuclearReactorStateTable.playerPropertyId, playerPropertiesTable.id))
    .where(eq(playerPropertiesTable.playerId, targetId));

  for (const r of reactors) {
    const newIntegrity = (r.integrity ?? 100) - REACTOR.INTEGRITY_DAMAGE_PER_HIT;
    if (newIntegrity > 0) {
      await db.update(nuclearReactorStateTable)
        .set({ integrity: newIntegrity })
        .where(eq(nuclearReactorStateTable.id, r.stateId));
      await logActivity(
        targetId,
        "reactor_damaged",
        `Your Nuclear Reactor took sabotage damage from ${attackerUsername} — integrity ${newIntegrity}%`,
      );
      await createNotification(
        targetId,
        "reactor_damaged",
        `☢️ Your Nuclear Reactor was damaged by ${attackerUsername} — integrity now ${newIntegrity}%`,
        "/properties",
      );
    } else {
      // Meltdown — delete reactor, deduct cleanup fee, broadcast to all alive players
      await db.transaction(async (tx) => {
        await tx.delete(playerPropertiesTable).where(eq(playerPropertiesTable.id, r.ppId));
        await tx.update(playersTable)
          .set({
            money: sql`GREATEST(0, ${playersTable.money} - ${REACTOR.MELTDOWN_FEE})`,
            updatedAt: new Date(),
          })
          .where(eq(playersTable.id, targetId));
      });

      await logActivity(
        targetId,
        "reactor_meltdown",
        `Your Nuclear Reactor MELTED DOWN! Cleanup fee: $${REACTOR.MELTDOWN_FEE.toLocaleString()}`,
      );

      // Server-wide notification (all currently-alive players)
      try {
        await db.execute(sql`
          INSERT INTO notifications (player_id, type, message, link)
          SELECT id, 'reactor_meltdown',
            ${"☢️ NUCLEAR MELTDOWN! " + targetUsername + "'s reactor exploded after sabotage by " + attackerUsername + "."},
            '/properties'
          FROM players
          WHERE is_permanently_dead = false
        `);
      } catch (e) {
        logger.error({ e }, "worker: reactor meltdown broadcast failed");
      }

      logger.warn({ targetId, attackerUsername }, "worker: reactor meltdown");
    }
  }
}

async function processReactors(): Promise<void> {
  try {
    const now = new Date();
    // 1) Complete construction for any reactors whose timer has elapsed.
    //    Anchor lastPayoutAt to constructionCompleteAt (not now) so any time
    //    between completion and worker recovery still accrues income.
    const completedRows = await db.update(nuclearReactorStateTable)
      .set({
        isUnderConstruction: false,
        lastPayoutAt: nuclearReactorStateTable.constructionCompleteAt,
      })
      .where(and(
        eq(nuclearReactorStateTable.isUnderConstruction, true),
        lte(nuclearReactorStateTable.constructionCompleteAt, now),
      ))
      .returning({ id: nuclearReactorStateTable.id, ppId: nuclearReactorStateTable.playerPropertyId });

    for (const c of completedRows) {
      const [pp] = await db.select({ playerId: playerPropertiesTable.playerId })
        .from(playerPropertiesTable)
        .where(eq(playerPropertiesTable.id, c.ppId))
        .limit(1);
      if (pp) {
        await logActivity(pp.playerId, "reactor_constructed", `Your Nuclear Reactor is online and producing energy!`);
        await createNotification(pp.playerId, "reactor_built", `⚛️ Your Nuclear Reactor is online — energy production has begun!`, "/properties");
      }
    }

    // 2) For each constructed reactor, advance one full hour at a time, automatically
    //    converting generated energy into the owner's cash. Deterministic and idempotent
    //    via the lastPayoutAt CAS guard.
    const active = await db
      .select({
        stateId: nuclearReactorStateTable.id,
        ppId: nuclearReactorStateTable.playerPropertyId,
        energyUnits: nuclearReactorStateTable.energyUnits,
        lastPayoutAt: nuclearReactorStateTable.lastPayoutAt,
        playerId: playerPropertiesTable.playerId,
      })
      .from(nuclearReactorStateTable)
      .leftJoin(playerPropertiesTable, eq(nuclearReactorStateTable.playerPropertyId, playerPropertiesTable.id))
      .where(eq(nuclearReactorStateTable.isUnderConstruction, false));

    for (const r of active) {
      if (!r.playerId) continue;
      const elapsedMs = now.getTime() - r.lastPayoutAt.getTime();
      const fullHours = Math.min(REACTOR.MAX_CATCHUP_HOURS, Math.floor(elapsedMs / 3600000));
      if (fullHours <= 0) continue;
      // Persist accumulation up to the cap, then convert all stored energy
      // to cash. Cap protects against unbounded payout if the worker has
      // been offline for an extended period (within MAX_CATCHUP_HOURS).
      const energyGenerated = REACTOR.ENERGY_PER_HOUR * fullHours;
      const stored = Math.min(REACTOR.ENERGY_CAP, (r.energyUnits ?? 0) + energyGenerated);
      const money = stored * REACTOR.MONEY_PER_ENERGY;
      const newLastPayoutAt = new Date(r.lastPayoutAt.getTime() + fullHours * 3600000);

      await db.transaction(async (tx) => {
        const claimed = await tx.update(nuclearReactorStateTable)
          .set({ energyUnits: 0, lastPayoutAt: newLastPayoutAt })
          .where(and(
            eq(nuclearReactorStateTable.id, r.stateId),
            eq(nuclearReactorStateTable.lastPayoutAt, r.lastPayoutAt),
          ))
          .returning({ id: nuclearReactorStateTable.id });
        if (claimed.length === 0) return;
        await tx.update(playersTable)
          .set({ money: sql`${playersTable.money} + ${money}`, updatedAt: new Date() })
          .where(eq(playersTable.id, r.playerId!));
      });
    }
  } catch (err) {
    logger.error({ err }, "worker: reactor processing error");
  }
}

async function processBankInterest(): Promise<void> {
  try {
    const now = new Date();
    const players = await db
      .select({
        id: playersTable.id,
        bankBalance: playersTable.bankBalance,
        lastBankInterestAt: playersTable.lastBankInterestAt,
      })
      .from(playersTable)
      .where(and(
        eq(playersTable.isPermanentlyDead, false),
        gt(playersTable.bankBalance, 0),
      ));

    for (const p of players) {
      const last = p.lastBankInterestAt ?? now;
      const elapsedMs = now.getTime() - last.getTime();
      const fullHours = Math.min(BANK_CONFIG.MAX_INTEREST_CATCHUP_HOURS, Math.floor(elapsedMs / 3600000));
      if (fullHours <= 0) {
        if (!p.lastBankInterestAt) {
          await db.update(playersTable)
            .set({ lastBankInterestAt: now })
            .where(and(eq(playersTable.id, p.id), sql`${playersTable.lastBankInterestAt} IS NULL`));
        }
        continue;
      }
      const { interest } = applyHourlyInterest(p.bankBalance, fullHours);
      const newAnchor = new Date(last.getTime() + fullHours * 3600000);

      await db.transaction(async (tx) => {
        // CAS guard on lastBankInterestAt prevents double-credit if worker overlaps.
        const [updated] = await tx.update(playersTable)
          .set({
            bankBalance: sql`${playersTable.bankBalance} + ${interest}`,
            lastBankInterestAt: newAnchor,
            updatedAt: now,
          })
          .where(and(
            eq(playersTable.id, p.id),
            p.lastBankInterestAt
              ? eq(playersTable.lastBankInterestAt, p.lastBankInterestAt)
              : sql`${playersTable.lastBankInterestAt} IS NULL`,
          ))
          .returning({ bankBalance: playersTable.bankBalance });
        if (!updated || interest <= 0) return;
        await tx.insert(bankTransactionsTable).values({
          playerId: p.id, type: "interest", amount: interest, balanceAfter: updated.bankBalance,
        });
      });

      if (interest > 0) {
        await logActivity(p.id, "bank_interest",
          `Earned $${interest.toLocaleString()} interest on bank deposit (${fullHours}h)`);
      }
    }
  } catch (err) {
    logger.error({ err }, "worker: bank interest error");
  }
}

async function processOverdueLoans(): Promise<void> {
  try {
    const now = new Date();
    // Just identify candidates — actual ownership is taken via per-row lock below.
    const candidates = await db
      .select({ id: bankLoansTable.id })
      .from(bankLoansTable)
      .where(and(eq(bankLoansTable.status, "active"), lte(bankLoansTable.dueAt, now)));

    let processedCount = 0;
    type SideEffect =
      | { kind: "activity"; playerId: number; type: "bank_loan_garnished" | "bank_loan_seized"; msg: string }
      | { kind: "notify"; playerId: number; msg: string };

    for (const candidate of candidates) {
      // Single transaction per loan: claim with FOR UPDATE SKIP LOCKED, then
      // do all collection work atomically. Crash → rollback → loan stays
      // active for next tick (idempotent). Concurrent worker → skips this row.
      const sideEffects: SideEffect[] = [];
      const result = await db.transaction(async (tx) => {
        const [loan] = await tx
          .select({
            id: bankLoansTable.id,
            playerId: bankLoansTable.playerId,
            remaining: bankLoansTable.remaining,
          })
          .from(bankLoansTable)
          .where(and(
            eq(bankLoansTable.id, candidate.id),
            eq(bankLoansTable.status, "active"),
            lte(bankLoansTable.dueAt, now),
          ))
          .for("update", { skipLocked: true });
        if (!loan || !loan.playerId) return null;

        const playerId = loan.playerId;
        const owed = loan.remaining;
        let recovered = 0;

        // Lock the player row for the rest of the collection.
        const [p] = await tx
          .select({ money: playersTable.money, bankBalance: playersTable.bankBalance })
          .from(playersTable)
          .where(eq(playersTable.id, playerId))
          .for("update");
        if (!p) return null;

        // 1) Cash
        let stillOwed = owed - recovered;
        if (stillOwed > 0 && p.money > 0) {
          const t = Math.min(stillOwed, p.money);
          await tx.update(playersTable)
            .set({ money: sql`${playersTable.money} - ${t}`, updatedAt: now })
            .where(eq(playersTable.id, playerId));
          recovered += t;
          sideEffects.push({
            kind: "activity", playerId, type: "bank_loan_garnished",
            msg: `Bank deducted $${t.toLocaleString()} from your cash for overdue loan #${loan.id}`,
          });
        }

        // 2) Property seizure (smallest-first, non-reactor)
        stillOwed = owed - recovered;
        if (stillOwed > 0) {
          const properties = await tx
            .select({
              id: playerPropertiesTable.id,
              level: playerPropertiesTable.level,
              price: propertyTypesTable.price,
              nameEn: propertyTypesTable.nameEn,
              isReactor: propertyTypesTable.isReactor,
            })
            .from(playerPropertiesTable)
            .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
            .where(eq(playerPropertiesTable.playerId, playerId));

          const ranked = properties
            .filter(prop => !prop.isReactor)
            .map(prop => ({ ...prop, value: (prop.price ?? 0) * prop.level }))
            .sort((a, b) => a.value - b.value);

          for (const prop of ranked) {
            if (stillOwed <= 0) break;
            const deleted = await tx.delete(playerPropertiesTable)
              .where(eq(playerPropertiesTable.id, prop.id))
              .returning({ id: playerPropertiesTable.id });
            if (deleted.length === 0) continue;
            const credit = Math.min(stillOwed, prop.value);
            recovered += credit;
            stillOwed -= credit;
            sideEffects.push({
              kind: "activity", playerId, type: "bank_loan_seized",
              msg: `Bank seized your property "${prop.nameEn ?? "?"}" (worth $${prop.value.toLocaleString()}) for overdue loan #${loan.id}`,
            });
            sideEffects.push({
              kind: "notify", playerId,
              msg: `🏦 The bank seized your "${prop.nameEn ?? "property"}" for an unpaid loan.`,
            });
          }
        }

        // 3) Bank deposit garnish
        stillOwed = owed - recovered;
        if (stillOwed > 0 && p.bankBalance > 0) {
          const t = Math.min(stillOwed, p.bankBalance);
          const [updated] = await tx.update(playersTable)
            .set({ bankBalance: sql`${playersTable.bankBalance} - ${t}`, updatedAt: now })
            .where(eq(playersTable.id, playerId))
            .returning({ bankBalance: playersTable.bankBalance });
          if (updated) {
            await tx.insert(bankTransactionsTable).values({
              playerId, type: "loan_garnished", amount: t, balanceAfter: updated.bankBalance,
            });
            recovered += t;
            sideEffects.push({
              kind: "activity", playerId, type: "bank_loan_garnished",
              msg: `Bank garnished $${t.toLocaleString()} from your deposit account for overdue loan #${loan.id}`,
            });
          }
        }

        const finalRemaining = Math.max(0, owed - recovered);
        const finalStatus: "repaid" | "defaulted" = finalRemaining === 0 ? "repaid" : "defaulted";
        await tx.update(bankLoansTable).set({
          remaining: finalRemaining,
          status: finalStatus,
        }).where(eq(bankLoansTable.id, loan.id));

        sideEffects.push({
          kind: "notify", playerId,
          msg: finalStatus === "repaid"
            ? `🏦 The bank force-collected your overdue loan #${loan.id} in full.`
            : `🏦 Your overdue loan #${loan.id} defaulted with $${finalRemaining.toLocaleString()} unrecovered.`,
        });

        return { processed: true };
      }).catch((err) => {
        logger.error({ err, loanId: candidate.id }, "worker: overdue loan tx failed (will retry next tick)");
        return null;
      });

      if (result?.processed) {
        processedCount++;
        // Side-effects only after tx commits — safe to skip on rollback.
        for (const fx of sideEffects) {
          if (fx.kind === "activity") {
            await logActivity(fx.playerId, fx.type, fx.msg);
          } else {
            await createNotification(fx.playerId, "attack_resolved", fx.msg, "/bank");
          }
        }
      }
    }

    if (processedCount > 0) {
      logger.info({ count: processedCount }, "worker: overdue loans processed");
    }
  } catch (err) {
    logger.error({ err }, "worker: overdue loan processing error");
  }
}

async function tick(): Promise<void> {
  try {
    await Promise.all([
      processTravelArrivals(),
      processPrisonReleases(),
      processAttackArrivals(),
      collectPropertyIncome(),
      processReactors(),
      processBankInterest(),
      processOverdueLoans(),
      clearExpiredAntiSpy(),
      cleanupOldEvents(),
      cleanupOldChatMessages(),
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
