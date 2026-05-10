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
  chatMessagesTable, chatRestrictionsTable, type ChatRestrictionScope,
} from "@workspace/db/schema";
import { eq, desc, count, sql, and, ilike, gte, or } from "drizzle-orm";

const router = Router();

// ── In-memory recent-log buffer ───────────────────────────────────────────────
const MAX_LOG_ENTRIES = 500;
const recentLogs: { ts: string; level: string; msg: string }[] = [];
export function pushAdminLog(level: string, msg: string) {
  recentLogs.push({ ts: new Date().toISOString(), level, msg });
  if (recentLogs.length > MAX_LOG_ENTRIES) recentLogs.shift();
}

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
  req.session.destroy(() => res.json({ ok: true }));
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
    const { page = "1", limit = "50", search, prisonFilter, bannedFilter } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "WHERE 1=1";
    const params: unknown[] = [];
    if (search) { params.push(`%${search}%`); whereClause += ` AND p.username ILIKE $${params.length}`; }
    if (prisonFilter === "true") whereClause += " AND p.is_in_prison = TRUE";
    if (bannedFilter === "true") whereClause += " AND p.is_banned = TRUE";

    const [rows, totalRows] = await Promise.all([
      pool.query<{
        id: number; username: string; level: number; xp: number; money: number;
        attack_power: number; defense_power: number; kill_count: number; death_count: number;
        is_in_prison: boolean; prison_release_at: string | null; is_admin: boolean;
        admin_role: string | null; gang_id: number | null; created_at: string;
        city_name: string; is_banned: boolean; ban_reason: string | null;
        is_permanently_dead: boolean; died_at: string | null; death_cause: string | null;
        is_chat_muted: boolean;
      }>(
        `SELECT p.id, p.username, p.level, p.xp, p.money, p.attack_power, p.defense_power,
          p.kill_count, p.death_count, p.is_in_prison, p.prison_release_at, p.is_admin,
          p.admin_role, p.gang_id, p.created_at, c.name AS city_name,
          COALESCE(p.is_banned, FALSE) AS is_banned, p.ban_reason,
          COALESCE(p.is_permanently_dead, FALSE) AS is_permanently_dead, p.died_at, p.death_cause,
          COALESCE(p.is_chat_muted, FALSE) AS is_chat_muted
         FROM players p
         LEFT JOIN cities c ON c.id = p.city_id
         ${whereClause}
         ORDER BY p.level DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset],
      ),
      pool.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM players p ${whereClause}`,
        params,
      ),
    ]);

    return void res.json({
      players: rows.rows.map(p => ({
        id: p.id, username: p.username, level: p.level, xp: p.xp, money: p.money,
        attackPower: p.attack_power, defensePower: p.defense_power,
        killCount: p.kill_count, deathCount: p.death_count,
        isInPrison: p.is_in_prison, prisonReleaseAt: p.prison_release_at,
        isAdmin: p.is_admin, adminRole: p.admin_role, gangId: p.gang_id,
        createdAt: p.created_at, cityName: p.city_name,
        isBanned: p.is_banned, banReason: p.ban_reason,
        isPermanentlyDead: p.is_permanently_dead, diedAt: p.died_at, deathCause: p.death_cause,
        isChatMuted: p.is_chat_muted,
      })),
      total: Number(totalRows.rows[0]?.cnt ?? 0),
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

router.post("/super-admin/players/:id/ban", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    const { reason = "Admin ban" } = req.body as { reason?: string };
    await pool.query(
      "UPDATE players SET is_banned = TRUE, ban_reason = $1, updated_at = NOW() WHERE id = $2",
      [reason, playerId],
    );
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.delete("/super-admin/players/:id/ban", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    await pool.query(
      "UPDATE players SET is_banned = FALSE, ban_reason = NULL, updated_at = NOW() WHERE id = $1",
      [playerId],
    );
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
      prisonCrime: null, gangId: null, gangRank: null,
      health: 100, isPermanentlyDead: false, diedAt: null,
      killedByPlayerId: null, deathCause: null,
      updatedAt: new Date(),
    }).where(eq(playersTable.id, playerId));
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/super-admin/players/:id/revive", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    const rows = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
    if (!rows[0]) return void res.status(404).json({ error: "Player not found" });
    await db.update(playersTable).set({
      isPermanentlyDead: false,
      diedAt: null,
      killedByPlayerId: null,
      deathCause: null,
      health: rows[0].maxHealth,
      updatedAt: new Date(),
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
      id: gangsTable.id, name: gangsTable.name, description: gangsTable.description,
      treasury: gangsTable.treasury, color: gangsTable.color, bossId: gangsTable.bossId,
      createdAt: gangsTable.createdAt,
    }).from(gangsTable).orderBy(desc(gangsTable.treasury));

    const result = await Promise.all(gangs.map(async (g) => {
      const [membersRes, bossRes, memberList] = await Promise.all([
        db.select({ count: count() }).from(playersTable).where(eq(playersTable.gangId, g.id)),
        db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, g.bossId)).limit(1),
        db.select({ id: playersTable.id, username: playersTable.username, gangRank: playersTable.gangRank })
          .from(playersTable).where(eq(playersTable.gangId, g.id)).orderBy(playersTable.gangRank),
      ]);
      return {
        ...g, memberCount: Number(membersRes[0]?.count ?? 0),
        bossName: bossRes[0]?.username ?? "Unknown",
        members: memberList,
        createdAt: g.createdAt.toISOString(),
      };
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

router.patch("/super-admin/gangs/:id/boss", requireSuperAdminSession, async (req, res) => {
  try {
    const gangId = parseInt(String(req.params.id));
    const { newBossId } = req.body as { newBossId: number };
    const [gang] = await db.select().from(gangsTable).where(eq(gangsTable.id, gangId)).limit(1);
    if (!gang) return void res.status(404).json({ error: "Gang not found" });
    const newBoss = await db.select().from(playersTable).where(eq(playersTable.id, newBossId)).limit(1);
    if (!newBoss[0]) return void res.status(404).json({ error: "New boss player not found" });
    await db.transaction(async (tx) => {
      await tx.update(gangsTable).set({ bossId: newBossId }).where(eq(gangsTable.id, gangId));
      await tx.update(playersTable).set({ gangRank: "Boss" }).where(eq(playersTable.id, newBossId));
      await tx.update(playersTable)
        .set({ gangRank: "Soldier" })
        .where(and(eq(playersTable.id, gang.bossId), eq(playersTable.gangId, gangId)));
    });
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/super-admin/gangs/:gangId/kick/:playerId", requireSuperAdminSession, async (req, res) => {
  try {
    const gangId = parseInt(String(req.params.gangId));
    const playerId = parseInt(String(req.params.playerId));
    const [gang] = await db.select().from(gangsTable).where(eq(gangsTable.id, gangId)).limit(1);
    if (!gang) return void res.status(404).json({ error: "Gang not found" });
    if (gang.bossId === playerId) return void res.status(400).json({ error: "Cannot kick the gang boss. Change boss first." });
    await db.update(playersTable)
      .set({ gangId: null, gangRank: null, updatedAt: new Date() })
      .where(and(eq(playersTable.id, playerId), eq(playersTable.gangId, gangId)));
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
    const { page = "1", status: statusFilter } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = 50;
    const offset = (pageNum - 1) * limitNum;

    const rows = await pool.query<{
      id: number; status: string; attacker_name: string; target_name: string;
      created_at: Date; travel_arrival_at: Date | null; damage_dealt: number | null;
      target_survived: boolean | null;
    }>(
      `SELECT a.id, a.status,
        p1.username AS attacker_name, p2.username AS target_name,
        a.created_at, a.travel_arrival_at, a.damage_dealt, a.target_survived
       FROM attacks a
       LEFT JOIN players p1 ON p1.id = a.attacker_id
       LEFT JOIN players p2 ON p2.id = a.target_id
       ${statusFilter ? "WHERE a.status = $3" : ""}
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      statusFilter ? [limitNum, offset, statusFilter] : [limitNum, offset],
    );

    const totalRes = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM attacks ${statusFilter ? "WHERE status = $1" : ""}`,
      statusFilter ? [statusFilter] : [],
    );

    return void res.json({
      attacks: rows.rows.map(r => ({
        ...r,
        created_at: r.created_at.toISOString(),
        travel_arrival_at: r.travel_arrival_at?.toISOString() ?? null,
      })),
      total: Number(totalRes.rows[0]?.cnt ?? 0),
      page: pageNum,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/super-admin/attacks/:id/cancel", requireSuperAdminSession, async (req, res) => {
  try {
    const attackId = parseInt(String(req.params.id));
    const [updated] = await db.update(attacksTable)
      .set({ status: "cancelled" })
      .where(and(eq(attacksTable.id, attackId), eq(attacksTable.status, "traveling")))
      .returning();
    if (!updated) return void res.status(404).json({ error: "Attack not found or already resolved" });
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Prison ────────────────────────────────────────────────────────────────────

router.get("/super-admin/prison", requireSuperAdminSession, async (_req, res) => {
  try {
    const prisoners = await db.select({
      id: playersTable.id, username: playersTable.username, level: playersTable.level,
      prisonReleaseAt: playersTable.prisonReleaseAt, prisonCrime: playersTable.prisonCrime,
    }).from(playersTable).where(eq(playersTable.isInPrison, true)).orderBy(playersTable.prisonReleaseAt);
    return void res.json(prisoners.map(p => ({ ...p, prisonReleaseAt: p.prisonReleaseAt?.toISOString() ?? null })));
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

// ── Items — Weapons & Armor Catalog ──────────────────────────────────────────

router.get("/super-admin/items", requireSuperAdminSession, async (_req, res) => {
  try {
    const [weapons, armor, ammo] = await Promise.all([
      db.select().from(weaponsTable).orderBy(weaponsTable.type, weaponsTable.price),
      db.select().from(armorItemsTable).orderBy(armorItemsTable.type, armorItemsTable.price),
      db.select().from(ammoTable).orderBy(ammoTable.type),
    ]);
    return void res.json({ weapons, armor, ammo });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/super-admin/items/weapons/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const weaponId = parseInt(String(req.params.id));
    const { name, attackPower, price, description } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name;
    if (typeof attackPower === "number") updates.attackPower = Math.max(1, attackPower);
    if (typeof price === "number") updates.price = Math.max(1, price);
    if (typeof description === "string") updates.description = description;
    const [updated] = await db.update(weaponsTable).set(updates).where(eq(weaponsTable.id, weaponId)).returning();
    if (!updated) return void res.status(404).json({ error: "Weapon not found" });
    return void res.json(updated);
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/super-admin/items/armor/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const armorId = parseInt(String(req.params.id));
    const { name, defenseBonus, price, description } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name;
    if (typeof defenseBonus === "number") updates.defenseBonus = Math.max(1, defenseBonus);
    if (typeof price === "number") updates.price = Math.max(1, price);
    if (typeof description === "string") updates.description = description;
    const [updated] = await db.update(armorItemsTable).set(updates).where(eq(armorItemsTable.id, armorId)).returning();
    if (!updated) return void res.status(404).json({ error: "Armor not found" });
    return void res.json(updated);
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.patch("/super-admin/items/ammo/:id", requireSuperAdminSession, async (req, res) => {
  try {
    const ammoId = parseInt(String(req.params.id));
    const { name, damageBonus, price } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name;
    if (typeof damageBonus === "number") updates.damageBonus = Math.max(0, damageBonus);
    if (typeof price === "number") updates.price = Math.max(1, price);
    const [updated] = await db.update(ammoTable).set(updates).where(eq(ammoTable.id, ammoId)).returning();
    if (!updated) return void res.status(404).json({ error: "Ammo not found" });
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
        id: activityLogTable.id, type: activityLogTable.type,
        description: activityLogTable.description, createdAt: activityLogTable.createdAt,
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

// ── Dev Tools ─────────────────────────────────────────────────────────────────

const DANGEROUS_PATTERNS = /\b(DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+TABLE|GRANT|REVOKE)\b/i;

router.post("/super-admin/dev/sql", requireSuperAdminSession, async (req, res) => {
  try {
    const { query: sqlQuery, confirm } = req.body as { query: string; confirm?: boolean };
    if (!sqlQuery?.trim()) return void res.status(400).json({ error: "Query required" });

    if (!confirm && DANGEROUS_PATTERNS.test(sqlQuery)) {
      return void res.status(400).json({ error: "Dangerous query detected. Set confirm=true to proceed.", requiresConfirm: true });
    }

    const result = await pool.query(sqlQuery);
    pushAdminLog("INFO", `SQL executed by admin: ${sqlQuery.slice(0, 80)}`);
    return void res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({ name: f.name })),
    });
  } catch (e) {
    return void res.status(400).json({ error: String(e) });
  }
});

router.get("/super-admin/dev/logs", requireSuperAdminSession, async (_req, res) => {
  try {
    const dbLogs = await pool.query<{ ts: string; action: string; description: string; admin_username: string }>(
      `SELECT created_at AS ts, action, description, admin_username
       FROM admin_actions_log
       ORDER BY created_at DESC LIMIT 100`,
    );
    const combined = [
      ...recentLogs.slice(-100).map(l => ({ ts: l.ts, level: l.level, source: "api", message: l.msg })),
      ...dbLogs.rows.map(r => ({ ts: r.ts, level: "ADMIN", source: "audit", message: `[${r.admin_username}] ${r.action}: ${r.description}` })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 150);
    return void res.json(combined);
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/super-admin/dev/seed-data", requireSuperAdminSession, async (req, res) => {
  try {
    const { action } = req.body as { action: "reset-player-money" | "release-all-prison" | "cancel-traveling-attacks" };

    if (action === "reset-player-money") {
      const r = await pool.query("UPDATE players SET money = 5000 WHERE money < 100");
      return void res.json({ ok: true, affected: r.rowCount, message: `Reset money for ${r.rowCount} broke players` });
    }

    if (action === "release-all-prison") {
      const r = await pool.query("UPDATE players SET is_in_prison = FALSE, prison_release_at = NULL, prison_crime = NULL WHERE is_in_prison = TRUE");
      return void res.json({ ok: true, affected: r.rowCount, message: `Released ${r.rowCount} prisoners` });
    }

    if (action === "cancel-traveling-attacks") {
      const r = await pool.query("UPDATE attacks SET status = 'cancelled' WHERE status = 'traveling'");
      return void res.json({ ok: true, affected: r.rowCount, message: `Cancelled ${r.rowCount} in-flight attacks` });
    }

    return void res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────

let gameSettings = { xpMultiplier: 1.0, moneyMultiplier: 1.0, crimeSuccessBonus: 0 };

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

// ── Chat moderation ───────────────────────────────────────────────────────────

const ALLOWED_CHAT_SCOPES: ChatRestrictionScope[] = ["global", "gang", "city", "private", "all"];

router.post("/super-admin/players/:id/chat-mute", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    const { channel = "all", reason, durationHours } = req.body as { channel?: ChatRestrictionScope; reason?: string; durationHours?: number };
    if (!ALLOWED_CHAT_SCOPES.includes(channel)) {
      return void res.status(400).json({ error: "Invalid channel. Allowed: global, gang, city, private, all." });
    }
    const player = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
    if (!player[0]) return void res.status(404).json({ error: "Player not found" });

    const expiresAt = (typeof durationHours === "number" && durationHours > 0)
      ? new Date(Date.now() + durationHours * 3600000)
      : null;

    if (channel === "all") {
      await db.update(playersTable).set({ isChatMuted: true, updatedAt: new Date() }).where(eq(playersTable.id, playerId));
    }

    // Replace any existing restriction for this scope with the new one.
    await db.delete(chatRestrictionsTable).where(and(
      eq(chatRestrictionsTable.playerId, playerId),
      eq(chatRestrictionsTable.channel, channel),
    ));
    await db.insert(chatRestrictionsTable).values({
      playerId, channel, reason: reason ?? null, expiresAt,
    });
    pushAdminLog("ADMIN", `Chat-muted player ${playerId} on channel ${channel}` + (expiresAt ? ` until ${expiresAt.toISOString()}` : " (permanent)"));
    return void res.json({ ok: true, expiresAt: expiresAt?.toISOString() ?? null });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.delete("/super-admin/players/:id/chat-mute", requireSuperAdminSession, async (req, res) => {
  try {
    const playerId = parseInt(String(req.params.id));
    const channel = (req.query.channel as ChatRestrictionScope | undefined);
    if (channel && !ALLOWED_CHAT_SCOPES.includes(channel)) {
      return void res.status(400).json({ error: "Invalid channel." });
    }
    if (channel) {
      await db.delete(chatRestrictionsTable).where(and(
        eq(chatRestrictionsTable.playerId, playerId),
        eq(chatRestrictionsTable.channel, channel),
      ));
      if (channel === "all") {
        await db.update(playersTable).set({ isChatMuted: false, updatedAt: new Date() }).where(eq(playersTable.id, playerId));
      }
    } else {
      await db.delete(chatRestrictionsTable).where(eq(chatRestrictionsTable.playerId, playerId));
      await db.update(playersTable).set({ isChatMuted: false, updatedAt: new Date() }).where(eq(playersTable.id, playerId));
    }
    pushAdminLog("ADMIN", `Chat-unmuted player ${playerId}` + (channel ? ` on ${channel}` : " (all channels)"));
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.delete("/super-admin/chat/:messageId", requireSuperAdminSession, async (req, res) => {
  try {
    const messageId = parseInt(String(req.params.messageId));
    if (!Number.isFinite(messageId)) return void res.status(400).json({ error: "Invalid message id" });
    const result = await db.update(chatMessagesTable)
      .set({ deleted: true })
      .where(eq(chatMessagesTable.id, messageId))
      .returning({ id: chatMessagesTable.id, senderId: chatMessagesTable.senderId });
    if (result.length === 0) return void res.status(404).json({ error: "Message not found" });
    pushAdminLog("ADMIN", `Deleted chat message ${messageId} (sender ${result[0].senderId})`);
    return void res.json({ ok: true });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

export default router;
