import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, gangsTable, citiesTable, attacksTable, crimeRecordsTable,
} from "@workspace/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";

const router = Router();

async function requireAdmin(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) {
  const clerkId = getCurrentClerkId(req);
  const player = await getOrCreatePlayer(clerkId);
  if (!player.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [playerCount, gangCount, attackCount, prisonerCount] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(gangsTable),
      db.select({ count: count() }).from(attacksTable),
      db.select({ count: count() }).from(playersTable).where(eq(playersTable.isInPrison, true)),
    ]);

    const totalMoney = await db.select({ total: sql<number>`SUM(money)` }).from(playersTable);

    res.json({
      totalPlayers: playerCount[0]?.count ?? 0,
      totalGangs: gangCount[0]?.count ?? 0,
      totalAttacks: attackCount[0]?.count ?? 0,
      totalPrisoners: prisonerCount[0]?.count ?? 0,
      totalMoneyInCirculation: Number(totalMoney[0]?.total ?? 0),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/admin/players", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const [players, totalResult] = await Promise.all([
      db.select({
        id: playersTable.id,
        username: playersTable.username,
        level: playersTable.level,
        money: playersTable.money,
        killCount: playersTable.killCount,
        deathCount: playersTable.deathCount,
        isInPrison: playersTable.isInPrison,
        isTraveling: playersTable.isTraveling,
        isAdmin: playersTable.isAdmin,
        gangId: playersTable.gangId,
        cityId: playersTable.cityId,
        cityName: citiesTable.name,
        createdAt: playersTable.createdAt,
      })
        .from(playersTable)
        .leftJoin(citiesTable, eq(playersTable.cityId, citiesTable.id))
        .orderBy(desc(playersTable.createdAt))
        .limit(limitNum)
        .offset(offset),
      db.select({ count: count() }).from(playersTable),
    ]);

    res.json({
      players: players.map(p => ({
        ...p,
        cityName: p.cityName ?? "",
        createdAt: p.createdAt.toISOString(),
      })),
      total: totalResult[0]?.count ?? 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch("/admin/players/:playerId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.playerId));
    const { isInPrison, money, isAdmin } = req.body as {
      isInPrison?: boolean;
      money?: number;
      isAdmin?: boolean;
    };

    const updates: Partial<{
      isInPrison: boolean;
      prisonReleaseAt: null;
      prisonCrime: null;
      money: number;
      isAdmin: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (typeof isInPrison === "boolean") {
      updates.isInPrison = isInPrison;
      if (!isInPrison) {
        updates.prisonReleaseAt = null;
        updates.prisonCrime = null;
      }
    }
    if (typeof money === "number" && money >= 0) {
      updates.money = Math.floor(money);
    }
    if (typeof isAdmin === "boolean") {
      updates.isAdmin = isAdmin;
    }

    const [updated] = await db.update(playersTable)
      .set(updates)
      .where(eq(playersTable.id, playerId))
      .returning();

    if (!updated) return void res.status(404).json({ error: "Player not found" });

    res.json({ message: "Player updated", playerId: updated.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/players/:playerId/reset", requireAuth, requireAdmin, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.playerId));

    const [updated] = await db.update(playersTable)
      .set({
        money: 5000,
        level: 1,
        xp: 0,
        attackPower: 10,
        defensePower: 10,
        killCount: 0,
        deathCount: 0,
        isInPrison: false,
        prisonReleaseAt: null,
        prisonCrime: null,
        gangId: null,
        gangRank: null,
        updatedAt: new Date(),
      })
      .where(eq(playersTable.id, playerId))
      .returning();

    if (!updated) return void res.status(404).json({ error: "Player not found" });

    res.json({ message: "Player stats reset", playerId: updated.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/admin/gangs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const gangs = await db.select().from(gangsTable).orderBy(desc(gangsTable.treasury));
    const result = await Promise.all(gangs.map(async (gang) => {
      const members = await db.select({ count: count() }).from(playersTable).where(eq(playersTable.gangId, gang.id));
      return {
        ...gang,
        memberCount: members[0]?.count ?? 0,
        createdAt: gang.createdAt.toISOString(),
      };
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/gangs/:gangId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const gangId = parseInt(String(req.params.gangId));

    await db.update(playersTable)
      .set({ gangId: null, gangRank: null, updatedAt: new Date() })
      .where(eq(playersTable.gangId, gangId));

    await db.delete(gangsTable).where(eq(gangsTable.id, gangId));

    res.json({ message: "Gang disbanded" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
