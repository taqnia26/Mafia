import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, gangsTable, playerWeaponsTable, playerAmmoTable,
  attacksTable, activityLogTable, playerNpcGuardsTable, playerGuardsTable, citiesTable,
  playerRankProgressTable, playerRanksTable,
} from "@workspace/db/schema";
import { eq, desc, count, and, or, sql } from "drizzle-orm";

const router = Router();

const XP_PER_LEVEL = 1000;

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const [weapons, ammo, pendingAttacks, incomingAttacks, npcGuards, playerGuards, city, rankProgress] = await Promise.all([
      db.select({ count: count() }).from(playerWeaponsTable).where(eq(playerWeaponsTable.playerId, player.id)),
      db.select({ totalQty: sql<number>`sum(quantity)` }).from(playerAmmoTable).where(eq(playerAmmoTable.playerId, player.id)),
      db.select({ count: count() }).from(attacksTable).where(and(eq(attacksTable.attackerId, player.id), eq(attacksTable.status, "traveling"))),
      db.select({ count: count() }).from(attacksTable).where(and(eq(attacksTable.targetId, player.id), eq(attacksTable.status, "traveling"))),
      db.select({ count: count() }).from(playerNpcGuardsTable).where(eq(playerNpcGuardsTable.playerId, player.id)),
      db.select({ count: count() }).from(playerGuardsTable).where(eq(playerGuardsTable.protectedPlayerId, player.id)),
      db.select().from(citiesTable).where(eq(citiesTable.id, player.cityId)).limit(1),
      db.select({ currentRank: playerRankProgressTable.currentRank })
        .from(playerRankProgressTable)
        .where(eq(playerRankProgressTable.playerId, player.id))
        .limit(1),
    ]);

    let gangName: string | null = null;
    if (player.gangId) {
      const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, player.gangId)).limit(1);
      gangName = gang[0]?.name ?? null;
    }

    const bodyguardCount = (npcGuards[0]?.count ?? 0) + (playerGuards[0]?.count ?? 0);
    const currentRankNum = rankProgress[0]?.currentRank ?? 1;
    const rankData = await db.select({ nameEn: playerRanksTable.nameEn, nameAr: playerRanksTable.nameAr, color: playerRanksTable.color })
      .from(playerRanksTable)
      .where(eq(playerRanksTable.rankNumber, currentRankNum))
      .limit(1);

    return void res.json({
      money: player.money,
      level: player.level,
      xp: player.xp,
      xpToNextLevel: player.level * XP_PER_LEVEL,
      killCount: player.killCount,
      deathCount: player.deathCount,
      attackPower: player.attackPower,
      defensePower: player.defensePower,
      gangName,
      gangRank: player.gangRank ?? null,
      weaponCount: weapons[0]?.count ?? 0,
      bodyguardCount,
      ammoCount: Number(ammo[0]?.totalQty ?? 0),
      pendingAttacks: pendingAttacks[0]?.count ?? 0,
      incomingAttacks: incomingAttacks[0]?.count ?? 0,
      isInPrison: player.isInPrison,
      prisonReleaseAt: player.prisonReleaseAt?.toISOString() ?? null,
      cityName: city[0]?.name ?? "",
      isTraveling: player.isTraveling,
      currentRank: currentRankNum,
      rankNameEn: rankData[0]?.nameEn ?? "Street Rat",
      rankNameAr: rankData[0]?.nameAr ?? "فأر الشوارع",
      rankColor: rankData[0]?.color ?? "#6b7280",
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/dashboard/activity", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const activities = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.playerId, player.id))
      .orderBy(desc(activityLogTable.createdAt))
      .limit(20);

    res.json(activities.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/dashboard/leaderboard", requireAuth, async (req, res) => {
  try {
    const players = await db.select({
      id: playersTable.id,
      username: playersTable.username,
      level: playersTable.level,
      killCount: playersTable.killCount,
      gangId: playersTable.gangId,
      cityId: playersTable.cityId,
      cityName: citiesTable.name,
    })
      .from(playersTable)
      .leftJoin(citiesTable, eq(playersTable.cityId, citiesTable.id))
      .orderBy(desc(playersTable.killCount))
      .limit(10);

    const gangIds = [...new Set(players.filter(p => p.gangId).map(p => p.gangId!))];
    let gangMap: Record<number, string> = {};
    if (gangIds.length > 0) {
      const gangs = await db.select().from(gangsTable);
      gangs.forEach(g => { gangMap[g.id] = g.name; });
    }

    res.json(players.map((p, idx) => ({
      rank: idx + 1,
      playerId: p.id,
      username: p.username,
      level: p.level,
      killCount: p.killCount,
      gangName: p.gangId ? (gangMap[p.gangId] ?? null) : null,
      cityName: p.cityName ?? "",
    })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
