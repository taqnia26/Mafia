import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, gangsTable, citiesTable,
} from "@workspace/db/schema";
import { eq, ilike, and, count, SQL } from "drizzle-orm";

const router = Router();

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
    res.json({
      ...player,
      cityName: city[0]?.name ?? "",
      gangName,
      gangRank: player.gangRank ?? null,
      prisonReleaseAt: player.prisonReleaseAt?.toISOString() ?? null,
      travelArrivalAt: player.travelArrivalAt?.toISOString() ?? null,
      createdAt: player.createdAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
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
    res.json({
      ...updated,
      cityName: city[0]?.name ?? "",
      gangName,
      gangRank: updated.gangRank ?? null,
      prisonReleaseAt: updated.prisonReleaseAt?.toISOString() ?? null,
      travelArrivalAt: updated.travelArrivalAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
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
    res.json({
      ...updated,
      cityName: city[0]?.name ?? "",
      gangName,
      gangRank: updated.gangRank ?? null,
      prisonReleaseAt: updated.prisonReleaseAt?.toISOString() ?? null,
      travelArrivalAt: updated.travelArrivalAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
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
        clerkId: playersTable.clerkId,
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
        cityName: citiesTable.name,
      })
        .from(playersTable)
        .leftJoin(citiesTable, eq(playersTable.cityId, citiesTable.id))
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

    res.json({
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
        };
      }),
      total: totalResult[0]?.count ?? 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/players/:playerId", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const viewer = await getOrCreatePlayer(clerkId);

    const playerId = parseInt(String(req.params.playerId));
    const rows = await db.select({
      id: playersTable.id,
      clerkId: playersTable.clerkId,
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
      cityName: citiesTable.name,
    })
      .from(playersTable)
      .leftJoin(citiesTable, eq(playersTable.cityId, citiesTable.id))
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

    res.json({
      ...p,
      attackPower: redact ? null : p.attackPower,
      defensePower: redact ? null : p.defensePower,
      cityName: p.cityName ?? "",
      gangName,
      gangRank: p.gangRank ?? null,
      prisonReleaseAt: p.prisonReleaseAt?.toISOString() ?? null,
      travelArrivalAt: p.travelArrivalAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
