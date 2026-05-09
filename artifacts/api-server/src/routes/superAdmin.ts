import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../lib/db";
import { pool } from "../lib/db";
import { requireSuperAdminSession } from "../middlewares/superAdminAuth";
import {
  playersTable, gangsTable, citiesTable, attacksTable, activityLogTable,
  weaponsTable, ammoTable, armorItemsTable, blackMarketListingsTable,
  crimeTypesTable, crimeRecordsTable,
  playerWeaponsTable, playerAmmoTable, playerArmorTable,
  playerNpcGuardsTable, bodyguardRequestsTable, playerGuardsTable,
} from "@workspace/db/schema";
import { eq, desc, count, sql, and, ilike, gte, or } from "drizzle-orm";

const router = Router();

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post("/super-admin/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return void res.status(400).json({ error: "Username and password required" });
    }

    const result = await pool.query<{ id: number; username: string; password_hash: string }>(
      "SELECT id, username, password_hash FROM admin_credentials WHERE username = $1 LIMIT 1",
      [username.trim().toLowerCase()],
    );

    if (result.rows.length === 0) {
      return void res.status(401).json({ error: "Invalid credentials" });
    }

    const row = result.rows[0];
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return void res.status(401).json({ error: "Invalid credentials" });
    }

    await pool.query("UPDATE admin_credentials SET last_login_at = NOW() WHERE id = $1", [row.id]);

    req.session.superAdminId = row.id;
    req.session.superAdminUsername = row.username;

    return void res.json({ ok: true, username: row.username });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/super-admin/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/super-admin/auth/me", (req, res) => {
  if (!req.session?.superAdminId) {
    return void res.status(401).json({ error: "Not authenticated" });
  }
  return void res.json({ id: req.session.superAdminId, username: req.session.superAdminUsername });
});

// ── Stats Dashboard ───────────────────────────────────────────────────────────

router.get("/super-admin/stats", requireSuperAdminSession, async (_req, res) => {
  try {
    const [playerCount, gangCount, prisonerCount, attacksToday] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(gangsTable),
      db.select({ count: count() }).from(playersTable).where(eq(playersTable.isInPrison, true)),
      db.select({ count: count() }).from(attacksTable).where(
        gte(attacksTable.createdAt, new Date(Date.now() - 86400000)),
      ),
    ]);

    const totalMoney = await db.select({ total: sql<string>`COALESCE(SUM(money),0)` }).from(playersTable);

    const attacksByDay = await pool.query<{ day: string; cnt: string }>(
      `SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*) AS cnt
       FROM attacks
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY day ORDER BY day`,
    );

    const crimesByType = await pool.query<{ name: string; cnt: string }>(
      `SELECT ct.name, COUNT(cr.id) AS cnt
       FROM crime_types ct
       LEFT JOIN crime_records cr ON cr.crime_type_id = ct.id AND cr.created_at >= NOW() - INTERVAL '7 days'
       GROUP BY ct.name ORDER BY cnt DESC LIMIT 7`,
    );

    const topPlayers = await db.select({
      id: playersTable.id,
      username: playersTable.username,
      level: playersTable.level,
      killCount: playersTable.killCount,
      money: playersTable.money,
    }).from(playersTable).orderBy(desc(playersTable.level)).limit(5);

    const recentActivity = await db.select({
      id: activityLogTable.id,
      type: activityLogTable.type,
      description: activityLogTable.description,
      createdAt: activityLogTable.createdAt,
      username: playersTable.username,
    }).from(activityLogTable)
      .leftJoin(playersTable, eq(activityLogTable.playerId, playersTable.id))
      .orderBy(desc(activityLogTable.createdAt))
      .limit(15);

    return void res.json({
      totalPlayers: Number(playerCount[0]?.count ?? 0),
      totalGangs: Number(gangCount[0]?.count ?? 0),
      totalPrisoners: Number(prisonerCount[0]?.count ?? 0),
      attacksToday: Number(attacksToday[0]?.count ?? 0),
      totalMoneyInCirculation: Number(totalMoney[0]?.total ?? 0),
      attacksByDay: attacksByDay.rows.map(r => ({ day: r.day, count: Number(r.cnt) })),
      crimesByType: crimesByType.rows.map(r => ({ name: r.name, count: Number(r.cnt) })),
      topPlayers,
      recentActivity: recentActivity.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Players ───────────────────────────────────────────────────────────────────

router.get("/super-admin/players", requireSuperAdminSession, async (req, res) => {
  try {
    const { page = "1", limit = "50", search, prisonFilter } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (search) conditions.push(ilike(playersTable.username, `%${search}%`));
    if (prisonFilter === "true") conditions.push(eq(playersTable.isInPrison, true));
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
        isInPrison: playersTable.isInPrison,
        prisonReleaseAt: playersTable.prisonReleaseAt,
        isAdmin: playersTable.isAdmin,
        adminRole: playersTable.adminRole,
        gangId: playersTable.gangId,
        createdAt: playersTable.createdAt,
        cityName: citiesTable.name,
      }).from(playersTable)
        .leftJoin(citiesTable, eq(playersTable.cityId, citiesTable.id))
        .where(whereClause)
        .orderBy(desc(playersTable.level))
        .limit(limitNum).offset(offset),
      db.select({ count: count() }).from(playersTable).where(whereClause),
    ]);

    return void res.json({
      players: players.map(p => ({
        ...p,
        prisonReleaseAt: p.prisonReleaseAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      total: Number(totalResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/super-admin/players/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    const { money, level, xp, attackPower, defensePower } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof money === "number") updates.money = Math.max(0, Math.floor(money));
    if (typeof level === "number") updates.level = Math.max(1, level);
    if (typeof xp === "number") updates.xp = Math.max(0, xp);
    if (typeof attackPower === "number") updates.attackPower = Math.max(1, attackPower);
    if (typeof defensePower === "number") updates.defensePower = Math.max(1, defensePower);
    const [updated] = await db.update(playersTable).set(updates).where(eq(playersTable.id, playerId)).returning();
    if (!updated) return void res.status(404).json({ error: "Player not found" });
    return void res.json({ ok: true, player: { id: updated.id, username: updated.username } });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/super-admin/players/:id/add-money", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    const { amount } = req.body as { amount: number };
    const delta = Math.floor(Number(amount));
    await db.update(playersTable)
      .set({ money: sql`${playersTable.money} + ${delta}`, updatedAt: new Date() })
      .where(eq(playersTable.id, playerId));
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/super-admin/players/:id/prison", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    const { hours = 1, crime = "Admin action" } = req.body as { hours?: number; crime?: string };
    const releaseAt = new Date(Date.now() + Number(hours) * 3600000);
    const [updated] = await db.update(playersTable)
      .set({ isInPrison: true, prisonReleaseAt: releaseAt, prisonCrime: crime, updatedAt: new Date() })
      .where(eq(playersTable.id, playerId)).returning();
    if (!updated) return void res.status(404).json({ error: "Player not found" });
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.delete("/super-admin/players/:id/prison", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    await db.update(playersTable)
      .set({ isInPrison: false, prisonReleaseAt: null, prisonCrime: null, updatedAt: new Date() })
      .where(eq(playersTable.id, playerId));
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.delete("/super-admin/players/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    const player = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
    if (!player[0]) return void res.status(404).json({ error: "Player not found" });
    await db.transaction(async (tx) => {
      const ledGangs = await tx.select({ id: gangsTable.id }).from(gangsTable).where(eq(gangsTable.bossId, playerId));
      for (const gang of ledGangs) {
        await tx.update(playersTable).set({ gangId: null, gangRank: null }).where(eq(playersTable.gangId, gang.id));
        await tx.delete(gangsTable).where(eq(gangsTable.id, gang.id));
      }
      await tx.update(playersTable).set({ gangId: null, gangRank: null }).where(eq(playersTable.id, playerId));
      await tx.delete(playerGuardsTable).where(or(eq(playerGuardsTable.protectedPlayerId, playerId), eq(playerGuardsTable.guardPlayerId, playerId)));
      await tx.delete(bodyguardRequestsTable).where(or(eq(bodyguardRequestsTable.fromPlayerId, playerId), eq(bodyguardRequestsTable.toPlayerId, playerId)));
      await tx.delete(playerNpcGuardsTable).where(eq(playerNpcGuardsTable.playerId, playerId));
      await tx.delete(playerWeaponsTable).where(eq(playerWeaponsTable.playerId, playerId));
      await tx.delete(playerAmmoTable).where(eq(playerAmmoTable.playerId, playerId));
      await tx.delete(playerArmorTable).where(eq(playerArmorTable.playerId, playerId));
      await tx.delete(attacksTable).where(or(eq(attacksTable.attackerId, playerId), eq(attacksTable.targetId, playerId)));
      await tx.delete(activityLogTable).where(eq(activityLogTable.playerId, playerId));
      await tx.delete(crimeRecordsTable).where(eq(crimeRecordsTable.playerId, playerId));
      await tx.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.sellerId, playerId));
      await tx.delete(playersTable).where(eq(playersTable.id, playerId));
    });
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/super-admin/players/:id/reset", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    await db.update(playersTable).set({
      money: 5000, level: 1, xp: 0, attackPower: 10, defensePower: 10,
      killCount: 0, deathCount: 0, isInPrison: false, prisonReleaseAt: null,
      prisonCrime: null, gangId: null, gangRank: null, updatedAt: new Date(),
    }).where(eq(playersTable.id, playerId));
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Gangs ─────────────────────────────────────────────────────────────────────

router.get("/super-admin/gangs", requireSuperAdminSession, async (_req, res) => {
  try {
    const gangs = await db.select({
      id: gangsTable.id,
      name: gangsTable.name,
      description: gangsTable.description,
      treasury: gangsTable.treasury,
      color: gangsTable.color,
      bossId: gangsTable.bossId,
      createdAt: gangsTable.createdAt,
    }).from(gangsTable).orderBy(desc(gangsTable.treasury));

    const result = await Promise.all(gangs.map(async (g) => {
      const [members, boss] = await Promise.all([
        db.select({ count: count() }).from(playersTable).where(eq(playersTable.gangId, g.id)),
        db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, g.bossId)).limit(1),
      ]);
      return { ...g, memberCount: Number(members[0]?.count ?? 0), bossName: boss[0]?.username ?? "Unknown", createdAt: g.createdAt.toISOString() };
    }));

    return void res.json(result);
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/super-admin/gangs/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const gangId = parseInt(String(req.params.id));
    const { name, description, treasury, color } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name;
    if (typeof description === "string") updates.description = description;
    if (typeof treasury === "number") updates.treasury = Math.max(0, treasury);
    if (typeof color === "string") updates.color = color;
    const [updated] = await db.update(gangsTable).set(updates).where(eq(gangsTable.id, gangId)).returning();
    if (!updated) return void res.status(404).json({ error: "Gang not found" });
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.delete("/super-admin/gangs/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const gangId = parseInt(String(req.params.id));
    await db.update(playersTable).set({ gangId: null, gangRank: null, updatedAt: new Date() }).where(eq(playersTable.gangId, gangId));
    await db.delete(gangsTable).where(eq(gangsTable.id, gangId));
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Attacks ───────────────────────────────────────────────────────────────────

router.get("/super-admin/attacks", requireSuperAdminSession, async (req, res) => {
  try {
    const { page = "1" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = 50;
    const offset = (pageNum - 1) * limitNum;

    const rows = await pool.query<{
      id: number; status: string; outcome: string | null;
      attacker_name: string; target_name: string;
      created_at: Date; arrives_at: Date | null;
    }>(
      `SELECT a.id, a.status, a.outcome,
        p1.username AS attacker_name, p2.username AS target_name,
        a.created_at, a.arrives_at
       FROM attacks a
       LEFT JOIN players p1 ON p1.id = a.attacker_id
       LEFT JOIN players p2 ON p2.id = a.target_id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limitNum, offset],
    );

    const totalRes = await db.select({ count: count() }).from(attacksTable);

    return void res.json({
      attacks: rows.rows.map(r => ({
        ...r,
        created_at: r.created_at.toISOString(),
        arrives_at: r.arrives_at?.toISOString() ?? null,
      })),
      total: Number(totalRes[0]?.count ?? 0),
      page: pageNum,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Prison ────────────────────────────────────────────────────────────────────

router.get("/super-admin/prison", requireSuperAdminSession, async (_req, res) => {
  try {
    const prisoners = await db.select({
      id: playersTable.id,
      username: playersTable.username,
      level: playersTable.level,
      prisonReleaseAt: playersTable.prisonReleaseAt,
      prisonCrime: playersTable.prisonCrime,
    }).from(playersTable)
      .where(eq(playersTable.isInPrison, true))
      .orderBy(playersTable.prisonReleaseAt);

    return void res.json(prisoners.map(p => ({
      ...p,
      prisonReleaseAt: p.prisonReleaseAt?.toISOString() ?? null,
    })));
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Crime Types ───────────────────────────────────────────────────────────────

router.get("/super-admin/crimes", requireSuperAdminSession, async (_req, res) => {
  try {
    const crimes = await db.select().from(crimeTypesTable).orderBy(crimeTypesTable.requiredLevel);
    return void res.json(crimes);
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/super-admin/crimes/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const crimeId = parseInt(String(req.params.id));
    const { minReward, maxReward, xpReward, successRate, cooldownMinutes, prisonTimeHours } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof minReward === "number") updates.minReward = Math.max(1, minReward);
    if (typeof maxReward === "number") updates.maxReward = Math.max(1, maxReward);
    if (typeof xpReward === "number") updates.xpReward = Math.max(0, xpReward);
    if (typeof successRate === "number") updates.successRate = Math.min(1, Math.max(0, successRate));
    if (typeof cooldownMinutes === "number") updates.cooldownMinutes = Math.max(1, cooldownMinutes);
    if (typeof prisonTimeHours === "number") updates.prisonTimeHours = Math.max(0, prisonTimeHours);
    const [updated] = await db.update(crimeTypesTable).set(updates).where(eq(crimeTypesTable.id, crimeId)).returning();
    if (!updated) return void res.status(404).json({ error: "Crime not found" });
    return void res.json(updated);
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Cities ────────────────────────────────────────────────────────────────────

router.get("/super-admin/cities", requireSuperAdminSession, async (_req, res) => {
  try {
    const cities = await db.select().from(citiesTable).orderBy(citiesTable.name);
    return void res.json(cities);
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/super-admin/cities/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const cityId = parseInt(String(req.params.id));
    const { name, nameAr, description, travelHoursBase } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name;
    if (typeof nameAr === "string") updates.nameAr = nameAr;
    if (typeof description === "string") updates.description = description;
    if (typeof travelHoursBase === "number") updates.travelHoursBase = Math.max(1, Math.min(72, travelHoursBase));
    const [updated] = await db.update(citiesTable).set(updates).where(eq(citiesTable.id, cityId)).returning();
    if (!updated) return void res.status(404).json({ error: "City not found" });
    return void res.json(updated);
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Black Market ──────────────────────────────────────────────────────────────

router.get("/super-admin/blackmarket", requireSuperAdminSession, async (_req, res) => {
  try {
    const listings = await pool.query<{
      id: number; item_type: string; item_name: string; quantity: number; price: number;
      seller_name: string; created_at: Date;
    }>(
      `SELECT bm.id, bm.item_type, bm.item_name, bm.quantity, bm.price,
        p.username AS seller_name, bm.created_at
       FROM black_market_listings bm
       LEFT JOIN players p ON p.id = bm.seller_id
       ORDER BY bm.created_at DESC LIMIT 100`,
    );
    return void res.json(listings.rows.map(r => ({ ...r, created_at: r.created_at.toISOString() })));
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.delete("/super-admin/blackmarket/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const listingId = parseInt(String(req.params.id));
    await db.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId));
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Activity Log ──────────────────────────────────────────────────────────────

router.get("/super-admin/activity-log", requireSuperAdminSession, async (req, res) => {
  try {
    const { page = "1", search } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [gte(activityLogTable.createdAt, new Date(Date.now() - 30 * 86400000))];
    if (search) {
      conditions.push(sql`${activityLogTable.playerId} IN (SELECT id FROM players WHERE username ILIKE ${`%${search}%`})`);
    }

    const [events, totalResult] = await Promise.all([
      db.select({
        id: activityLogTable.id,
        type: activityLogTable.type,
        description: activityLogTable.description,
        createdAt: activityLogTable.createdAt,
        username: playersTable.username,
      }).from(activityLogTable)
        .leftJoin(playersTable, eq(activityLogTable.playerId, playersTable.id))
        .where(and(...conditions))
        .orderBy(desc(activityLogTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ count: count() }).from(activityLogTable).where(and(...conditions)),
    ]);

    return void res.json({
      events: events.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
      total: Number(totalResult[0]?.count ?? 0),
      page: pageNum,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Dev Tools — SQL Console ───────────────────────────────────────────────────

const ALLOWED_STATEMENTS = /^\s*(SELECT|EXPLAIN)\s/i;
const DANGEROUS_PATTERNS = /\b(DROP|TRUNCATE|DELETE|INSERT|UPDATE|ALTER|CREATE|GRANT|REVOKE)\b/i;

router.post("/super-admin/dev/sql", requireSuperAdminSession, async (req, res) => {
  try {
    const { query: sqlQuery, confirm } = req.body as { query: string; confirm?: boolean };
    if (!sqlQuery?.trim()) return void res.status(400).json({ error: "Query required" });

    if (!confirm && DANGEROUS_PATTERNS.test(sqlQuery)) {
      return void res.status(400).json({ error: "Dangerous query detected. Set confirm=true to proceed.", requiresConfirm: true });
    }

    if (!ALLOWED_STATEMENTS.test(sqlQuery) && !confirm) {
      return void res.status(400).json({ error: "Only SELECT/EXPLAIN allowed without confirm=true", requiresConfirm: true });
    }

    const result = await pool.query(sqlQuery);
    return void res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({ name: f.name })),
    });
  } catch (e) {
    return void res.status(400).json({ error: String(e) });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────

let gameSettings = {
  xpMultiplier: 1.0,
  moneyMultiplier: 1.0,
  crimeSuccessBonus: 0,
};

router.get("/super-admin/settings", requireSuperAdminSession, (_req, res) => {
  res.json(gameSettings);
});

router.patch("/super-admin/settings", requireSuperAdminSession, (req, res) => {
  const { xpMultiplier, moneyMultiplier, crimeSuccessBonus } = req.body as typeof gameSettings;
  if (typeof xpMultiplier === "number") gameSettings.xpMultiplier = Math.max(0.1, Math.min(10, xpMultiplier));
  if (typeof moneyMultiplier === "number") gameSettings.moneyMultiplier = Math.max(0.1, Math.min(10, moneyMultiplier));
  if (typeof crimeSuccessBonus === "number") gameSettings.crimeSuccessBonus = Math.max(-0.5, Math.min(0.5, crimeSuccessBonus));
  res.json(gameSettings);
});

export default router;
