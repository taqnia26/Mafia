import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, gangsTable, citiesTable, playerRanksTable, playerRankProgressTable,
  playerWeaponsTable, playerAmmoTable, playerArmorTable, playerNpcGuardsTable,
  playerGuardsTable, bodyguardRequestsTable, playerPropertiesTable,
  attacksTable, blackMarketListingsTable, crimeRecordsTable, activityLogTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, ilike, and, count, or, SQL } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router = Router();

async function resolveKillerUsername(killerId: number | null): Promise<string | null> {
  if (!killerId) return null;
  const rows = await db.select({ username: playersTable.username })
    .from(playersTable).where(eq(playersTable.id, killerId)).limit(1);
  return rows[0]?.username ?? null;
}

async function resolveRankForPlayer(playerId: number): Promise<{ currentRank: number; rankNameEn: string; rankNameAr: string; rankColor: string } | null> {
  const progress = await db
    .select({ currentRank: playerRankProgressTable.currentRank })
    .from(playerRankProgressTable)
    .where(eq(playerRankProgressTable.playerId, playerId))
    .limit(1);

  const rankNum = progress[0]?.currentRank ?? 1;
  const rankData = await db
    .select({ nameEn: playerRanksTable.nameEn, nameAr: playerRanksTable.nameAr, color: playerRanksTable.color })
    .from(playerRanksTable)
    .where(eq(playerRanksTable.rankNumber, rankNum))
    .limit(1);

  if (!rankData[0]) return null;
  return { currentRank: rankNum, rankNameEn: rankData[0].nameEn, rankNameAr: rankData[0].nameAr, rankColor: rankData[0].color };
}

router.get("/players/me", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const city = await db.select().from(citiesTable).where(eq(citiesTable.id, player.cityId)).limit(1);
    let gangName: string | null = null;
    if (player.gangId) {
      const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, player.gangId)).limit(1);
      gangName = gang[0]?.name ?? null;
    }
    const rankInfo = await resolveRankForPlayer(player.id);
    const killedByUsername = await resolveKillerUsername(player.killedByPlayerId);
    return void res.json({
      ...player,
      cityName: city[0]?.name ?? "",
      gangName,
      gangRank: player.gangRank ?? null,
      prisonReleaseAt: player.prisonReleaseAt?.toISOString() ?? null,
      travelArrivalAt: player.travelArrivalAt?.toISOString() ?? null,
      createdAt: player.createdAt.toISOString(),
      currentRank: rankInfo?.currentRank ?? 1,
      rankNameEn: rankInfo?.rankNameEn ?? "Street Rat",
      rankNameAr: rankInfo?.rankNameAr ?? "فأر الشوارع",
      rankColor: rankInfo?.rankColor ?? "#6b7280",
      isPermanentlyDead: player.isPermanentlyDead,
      diedAt: player.diedAt?.toISOString() ?? null,
      killedByPlayerId: player.killedByPlayerId ?? null,
      killedByUsername,
      deathCause: player.deathCause ?? null,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/players/me/restart", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    if (!player.isPermanentlyDead) {
      return void res.status(400).json({ error: "You can only restart after death." });
    }

    await db.transaction(async (tx) => {
      await tx.delete(playerWeaponsTable).where(eq(playerWeaponsTable.playerId, player.id));
      await tx.delete(playerAmmoTable).where(eq(playerAmmoTable.playerId, player.id));
      await tx.delete(playerArmorTable).where(eq(playerArmorTable.playerId, player.id));
      await tx.delete(playerNpcGuardsTable).where(eq(playerNpcGuardsTable.playerId, player.id));
      await tx.delete(playerGuardsTable).where(or(
        eq(playerGuardsTable.protectedPlayerId, player.id),
        eq(playerGuardsTable.guardPlayerId, player.id),
      ));
      await tx.delete(bodyguardRequestsTable).where(or(
        eq(bodyguardRequestsTable.fromPlayerId, player.id),
        eq(bodyguardRequestsTable.toPlayerId, player.id),
      ));
      await tx.delete(playerPropertiesTable).where(eq(playerPropertiesTable.playerId, player.id));
      await tx.delete(playerRankProgressTable).where(eq(playerRankProgressTable.playerId, player.id));
      await tx.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.sellerId, player.id));
      await tx.delete(attacksTable).where(or(
        eq(attacksTable.attackerId, player.id),
        eq(attacksTable.targetId, player.id),
      ));
      await tx.delete(crimeRecordsTable).where(eq(crimeRecordsTable.playerId, player.id));
      await tx.delete(notificationsTable).where(eq(notificationsTable.playerId, player.id));
      await tx.delete(activityLogTable).where(eq(activityLogTable.playerId, player.id));

      await tx.update(playersTable).set({
        money: 5000,
        health: 100,
        maxHealth: 100,
        level: 1,
        xp: 0,
        attackPower: 10,
        defensePower: 10,
        killCount: 0,
        cityId: 1,
        gangId: null,
        gangRank: null,
        isInPrison: false,
        prisonReleaseAt: null,
        prisonCrime: null,
        isTraveling: false,
        travelToCityId: null,
        travelArrivalAt: null,
        isPermanentlyDead: false,
        diedAt: null,
        killedByPlayerId: null,
        deathCause: null,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, player.id));
    });

    await logActivity(player.id, "restart", "Started over after death");
    return void res.json({ ok: true, message: "Welcome back to the streets." });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/players/me", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const { username } = req.body as { username: string };
    const [updated] = await db.update(playersTable)
      .set({ username, updatedAt: new Date() })
      .where(eq(playersTable.id, player.id))
      .returning();
    const city = await db.select().from(citiesTable).where(eq(citiesTable.id, updated.cityId)).limit(1);
    let gangName: string | null = null;
    if (updated.gangId) {
      const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, updated.gangId)).limit(1);
      gangName = gang[0]?.name ?? null;
    }
    const rankInfo = await resolveRankForPlayer(updated.id);
    const killedByUsername = await resolveKillerUsername(updated.killedByPlayerId);
    return void res.json({
      ...updated,
      cityName: city[0]?.name ?? "",
      gangName,
      gangRank: updated.gangRank ?? null,
      prisonReleaseAt: updated.prisonReleaseAt?.toISOString() ?? null,
      travelArrivalAt: updated.travelArrivalAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      currentRank: rankInfo?.currentRank ?? 1,
      rankNameEn: rankInfo?.rankNameEn ?? "Street Rat",
      rankNameAr: rankInfo?.rankNameAr ?? "فأر الشوارع",
      rankColor: rankInfo?.rankColor ?? "#6b7280",
      isPermanentlyDead: updated.isPermanentlyDead,
      diedAt: updated.diedAt?.toISOString() ?? null,
      killedByPlayerId: updated.killedByPlayerId ?? null,
      killedByUsername,
      deathCause: updated.deathCause ?? null,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/players/me/anti-spy", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const { enabled } = req.body as { enabled: boolean };
    const [updated] = await db.update(playersTable)
      .set({ antiSpyEnabled: enabled, updatedAt: new Date() })
      .where(eq(playersTable.id, player.id))
      .returning();
    const city = await db.select().from(citiesTable).where(eq(citiesTable.id, updated.cityId)).limit(1);
    let gangName: string | null = null;
    if (updated.gangId) {
      const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, updated.gangId)).limit(1);
      gangName = gang[0]?.name ?? null;
    }
    const rankInfo = await resolveRankForPlayer(updated.id);
    const killedByUsername = await resolveKillerUsername(updated.killedByPlayerId);
    return void res.json({
      ...updated,
      cityName: city[0]?.name ?? "",
      gangName,
      gangRank: updated.gangRank ?? null,
      prisonReleaseAt: updated.prisonReleaseAt?.toISOString() ?? null,
      travelArrivalAt: updated.travelArrivalAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      currentRank: rankInfo?.currentRank ?? 1,
      rankNameEn: rankInfo?.rankNameEn ?? "Street Rat",
      rankNameAr: rankInfo?.rankNameAr ?? "فأر الشوارع",
      rankColor: rankInfo?.rankColor ?? "#6b7280",
      isPermanentlyDead: updated.isPermanentlyDead,
      diedAt: updated.diedAt?.toISOString() ?? null,
      killedByPlayerId: updated.killedByPlayerId ?? null,
      killedByUsername,
      deathCause: updated.deathCause ?? null,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.get("/players", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const viewer = await getOrCreatePlayer(clerkId);

    const { cityId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions: SQL[] = [];
    if (cityId) conditions.push(eq(playersTable.cityId, parseInt(cityId)));
    if (search) conditions.push(ilike(playersTable.username, `%${search}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [players, totalResult] = await Promise.all([
      db.select({
        id: playersTable.id,
        username: playersTable.username,
        level: playersTable.level,
        xp: playersTable.xp,
        money: playersTable.money,
        attackPower: playersTable.attackPower,
        defensePower: playersTable.defensePower,
        killCount: playersTable.killCount,
        deathCount: playersTable.deathCount,
        cityId: playersTable.cityId,
        gangId: playersTable.gangId,
        gangRank: playersTable.gangRank,
        antiSpyEnabled: playersTable.antiSpyEnabled,
        isInPrison: playersTable.isInPrison,
        prisonReleaseAt: playersTable.prisonReleaseAt,
        isTraveling: playersTable.isTraveling,
        travelArrivalAt: playersTable.travelArrivalAt,
        createdAt: playersTable.createdAt,
        isPermanentlyDead: playersTable.isPermanentlyDead,
        diedAt: playersTable.diedAt,
        killedByPlayerId: playersTable.killedByPlayerId,
        deathCause: playersTable.deathCause,
        cityName: citiesTable.name,
        currentRank: playerRankProgressTable.currentRank,
        rankNameEn: playerRanksTable.nameEn,
        rankNameAr: playerRanksTable.nameAr,
        rankColor: playerRanksTable.color,
      })
        .from(playersTable)
        .leftJoin(citiesTable, eq(playersTable.cityId, citiesTable.id))
        .leftJoin(playerRankProgressTable, eq(playerRankProgressTable.playerId, playersTable.id))
        .leftJoin(playerRanksTable, eq(playerRanksTable.rankNumber, playerRankProgressTable.currentRank))
        .where(whereClause)
        .limit(limitNum)
        .offset(offset),
      db.select({ count: count() }).from(playersTable).where(whereClause),
    ]);

    const uniqueGangIds = [...new Set(players.filter(p => p.gangId).map(p => p.gangId!))];
    const gangMap: Record<number, string> = {};
    if (uniqueGangIds.length > 0) {
      const gangs = await db.select().from(gangsTable);
      gangs.forEach(g => { gangMap[g.id] = g.name; });
    }

    return void res.json({
      players: players.map(p => {
        const isSelf = p.id === viewer.id;
        const redact = !isSelf && p.antiSpyEnabled;
        return {
          ...p,
          attackPower: redact ? null : p.attackPower,
          defensePower: redact ? null : p.defensePower,
          cityName: p.cityName ?? "",
          gangName: p.gangId ? (gangMap[p.gangId] ?? null) : null,
          gangRank: p.gangRank ?? null,
          prisonReleaseAt: p.prisonReleaseAt?.toISOString() ?? null,
          travelArrivalAt: p.travelArrivalAt?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
          currentRank: p.currentRank ?? 1,
          rankNameEn: p.rankNameEn ?? "Street Rat",
          rankNameAr: p.rankNameAr ?? "فأر الشوارع",
          rankColor: p.rankColor ?? "#6b7280",
          isPermanentlyDead: p.isPermanentlyDead,
          diedAt: p.diedAt?.toISOString() ?? null,
          killedByPlayerId: p.killedByPlayerId ?? null,
          deathCause: p.deathCause ?? null,
        };
      }),
      total: totalResult[0]?.count ?? 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.get("/players/:playerId", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const viewer = await getOrCreatePlayer(clerkId);

    const playerId = parseInt(String(req.params.playerId));
    const rows = await db.select({
      id: playersTable.id,
      username: playersTable.username,
      level: playersTable.level,
      xp: playersTable.xp,
      money: playersTable.money,
      attackPower: playersTable.attackPower,
      defensePower: playersTable.defensePower,
      killCount: playersTable.killCount,
      deathCount: playersTable.deathCount,
      cityId: playersTable.cityId,
      gangId: playersTable.gangId,
      gangRank: playersTable.gangRank,
      antiSpyEnabled: playersTable.antiSpyEnabled,
      isInPrison: playersTable.isInPrison,
      prisonReleaseAt: playersTable.prisonReleaseAt,
      isTraveling: playersTable.isTraveling,
      travelArrivalAt: playersTable.travelArrivalAt,
      createdAt: playersTable.createdAt,
      isPermanentlyDead: playersTable.isPermanentlyDead,
      diedAt: playersTable.diedAt,
      killedByPlayerId: playersTable.killedByPlayerId,
      deathCause: playersTable.deathCause,
      cityName: citiesTable.name,
      currentRank: playerRankProgressTable.currentRank,
      rankNameEn: playerRanksTable.nameEn,
      rankNameAr: playerRanksTable.nameAr,
      rankColor: playerRanksTable.color,
    })
      .from(playersTable)
      .leftJoin(citiesTable, eq(playersTable.cityId, citiesTable.id))
      .leftJoin(playerRankProgressTable, eq(playerRankProgressTable.playerId, playersTable.id))
      .leftJoin(playerRanksTable, eq(playerRanksTable.rankNumber, playerRankProgressTable.currentRank))
      .where(eq(playersTable.id, playerId))
      .limit(1);

    if (!rows[0]) return void res.status(404).json({ error: "Player not found" });

    const p = rows[0];
    const isSelf = p.id === viewer.id;
    const redact = !isSelf && p.antiSpyEnabled;

    let gangName: string | null = null;
    if (p.gangId) {
      const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, p.gangId)).limit(1);
      gangName = gang[0]?.name ?? null;
    }
    const killedByUsername = await resolveKillerUsername(p.killedByPlayerId);

    return void res.json({
      ...p,
      attackPower: redact ? null : p.attackPower,
      defensePower: redact ? null : p.defensePower,
      cityName: p.cityName ?? "",
      gangName,
      gangRank: p.gangRank ?? null,
      prisonReleaseAt: p.prisonReleaseAt?.toISOString() ?? null,
      travelArrivalAt: p.travelArrivalAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      currentRank: p.currentRank ?? 1,
      rankNameEn: p.rankNameEn ?? "Street Rat",
      rankNameAr: p.rankNameAr ?? "فأر الشوارع",
      rankColor: p.rankColor ?? "#6b7280",
      isPermanentlyDead: p.isPermanentlyDead,
      diedAt: p.diedAt?.toISOString() ?? null,
      killedByPlayerId: p.killedByPlayerId ?? null,
      killedByUsername,
      deathCause: p.deathCause ?? null,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

export default router;
