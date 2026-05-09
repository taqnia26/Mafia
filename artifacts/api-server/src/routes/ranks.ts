import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { requireNotInPrison } from "../lib/auth";
import { playerRanksTable, playerRankProgressTable, playersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router = Router();

async function getPlayerRank(playerId: number): Promise<number> {
  const rows = await db
    .select({ currentRank: playerRankProgressTable.currentRank })
    .from(playerRankProgressTable)
    .where(eq(playerRankProgressTable.playerId, playerId))
    .limit(1);
  return rows[0]?.currentRank ?? 1;
}

async function ensureRankProgress(playerId: number): Promise<number> {
  const existing = await db
    .select()
    .from(playerRankProgressTable)
    .where(eq(playerRankProgressTable.playerId, playerId))
    .limit(1);
  if (existing[0]) return existing[0].currentRank;
  await db.insert(playerRankProgressTable).values({ playerId, currentRank: 1 });
  return 1;
}

router.get("/ranks", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const [allRanks, currentRank] = await Promise.all([
      db.select().from(playerRanksTable).orderBy(playerRanksTable.rankNumber),
      ensureRankProgress(player.id),
    ]);

    const nextRank = allRanks.find(r => r.rankNumber === currentRank + 1);
    const currentRankData = allRanks.find(r => r.rankNumber === currentRank);

    const ranksWithEligibility = allRanks.map(rank => {
      const isCurrentRank = rank.rankNumber === currentRank;
      const isNextRank = rank.rankNumber === currentRank + 1;
      const canUpgrade = isNextRank
        && player.level >= rank.requiredLevel
        && player.money >= rank.requiredMoney
        && player.xp >= rank.requiredXp
        && player.killCount >= rank.requiredKills;

      const missingRequirements: string[] = [];
      if (isNextRank) {
        if (player.level < rank.requiredLevel) missingRequirements.push(`Level ${rank.requiredLevel} (you: ${player.level})`);
        if (player.money < rank.requiredMoney) missingRequirements.push(`$${rank.requiredMoney.toLocaleString()} (you: $${player.money.toLocaleString()})`);
        if (player.xp < rank.requiredXp) missingRequirements.push(`${rank.requiredXp.toLocaleString()} XP (you: ${player.xp.toLocaleString()})`);
        if (player.killCount < rank.requiredKills) missingRequirements.push(`${rank.requiredKills} kills (you: ${player.killCount})`);
      }

      return {
        ...rank,
        isCurrentRank,
        isNextRank,
        canUpgrade,
        missingRequirements,
        unlocked: rank.rankNumber <= currentRank,
      };
    });

    return void res.json({
      ranks: ranksWithEligibility,
      currentRank,
      currentRankData: currentRankData ?? null,
      nextRank: nextRank ?? null,
      player: {
        level: player.level,
        money: player.money,
        xp: player.xp,
        killCount: player.killCount,
      },
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/ranks/upgrade", requireAuth, requireNotInPrison, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const currentRank = await ensureRankProgress(player.id);
    const allRanks = await db.select().from(playerRanksTable).orderBy(playerRanksTable.rankNumber);
    const nextRank = allRanks.find(r => r.rankNumber === currentRank + 1);

    if (!nextRank) {
      return void res.status(400).json({ error: "You are already at the maximum rank." });
    }

    if (player.level < nextRank.requiredLevel) {
      return void res.status(400).json({ error: `Requires Level ${nextRank.requiredLevel}` });
    }
    if (player.money < nextRank.requiredMoney) {
      return void res.status(400).json({ error: `Requires $${nextRank.requiredMoney.toLocaleString()}` });
    }
    if (player.xp < nextRank.requiredXp) {
      return void res.status(400).json({ error: `Requires ${nextRank.requiredXp.toLocaleString()} XP` });
    }
    if (player.killCount < nextRank.requiredKills) {
      return void res.status(400).json({ error: `Requires ${nextRank.requiredKills} kills` });
    }

    const prevRank = allRanks.find(r => r.rankNumber === currentRank);
    const atkIncrease = nextRank.atkBonus - (prevRank?.atkBonus ?? 0);
    const defIncrease = nextRank.defBonus - (prevRank?.defBonus ?? 0);

    await db.transaction(async (tx) => {
      await tx.update(playersTable).set({
        money: sql`${playersTable.money} - ${nextRank.requiredMoney}`,
        attackPower: sql`${playersTable.attackPower} + ${atkIncrease}`,
        defensePower: sql`${playersTable.defensePower} + ${defIncrease}`,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, player.id));

      const existing = await tx.select().from(playerRankProgressTable).where(eq(playerRankProgressTable.playerId, player.id)).limit(1);
      if (existing[0]) {
        await tx.update(playerRankProgressTable).set({ currentRank: nextRank.rankNumber, upgradedAt: new Date() }).where(eq(playerRankProgressTable.playerId, player.id));
      } else {
        await tx.insert(playerRankProgressTable).values({ playerId: player.id, currentRank: nextRank.rankNumber });
      }
    });

    await logActivity(player.id, "rank_upgrade", `Promoted to ${nextRank.nameEn} — +${atkIncrease} ATK, +${defIncrease} DEF`);

    return void res.json({
      success: true,
      newRank: nextRank.rankNumber,
      newRankName: nextRank.nameEn,
      newRankNameAr: nextRank.nameAr,
      atkIncrease,
      defIncrease,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

export { getPlayerRank, ensureRankProgress };
export default router;
