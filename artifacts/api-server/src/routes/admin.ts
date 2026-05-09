import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { requireAdminRole, logAdminAction } from "../middlewares/adminAuth";
import {
  playersTable, gangsTable, citiesTable, attacksTable, activityLogTable,
  weaponsTable, ammoTable, armorItemsTable, blackMarketListingsTable,
  adminActionsLogTable, playerAmmoTable,
  listingItemTypeEnum, adminRoleEnum,
  crimeRecordsTable,
  playerWeaponsTable, playerArmorTable,
  playerNpcGuardsTable, bodyguardRequestsTable, playerGuardsTable,
} from "@workspace/db/schema";
import type { AdminRole } from "@workspace/db/schema";
import { eq, desc, count, sql, and, ilike, gte, lte, or } from "drizzle-orm";

const router = Router();

// ── Overview Stats ──────────────────────────────────────────────────────────
router.get("/admin/overview", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    const [playerCount, gangCount, prisonerCount, attacksToday] = await Promise.all([
      db.select({ count: count() }).from(playersTable),
      db.select({ count: count() }).from(gangsTable),
      db.select({ count: count() }).from(playersTable).where(eq(playersTable.isInPrison, true)),
      db.select({ count: count() }).from(attacksTable).where(
        gte(attacksTable.createdAt, new Date(Date.now() - 86400000))
      ),
    ]);

    const totalMoney = await db.select({ total: sql<number>`SUM(money)` }).from(playersTable);

    const topPlayers = await db.select({
      id: playersTable.id,
      username: playersTable.username,
      level: playersTable.level,
      killCount: playersTable.killCount,
      money: playersTable.money,
    })
      .from(playersTable)
      .orderBy(desc(playersTable.killCount))
      .limit(5);

    const recentEvents = await db.select()
      .from(activityLogTable)
      .orderBy(desc(activityLogTable.createdAt))
      .limit(10);

    res.json({
      totalPlayers: playerCount[0]?.count ?? 0,
      totalGangs: gangCount[0]?.count ?? 0,
      totalPrisoners: prisonerCount[0]?.count ?? 0,
      attacksToday: attacksToday[0]?.count ?? 0,
      totalMoneyInCirculation: Number(totalMoney[0]?.total ?? 0),
      topPlayers,
      recentEvents: recentEvents.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Players ──────────────────────────────────────────────────────────────────
router.get("/admin/players", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    const { page = "1", limit = "50", search, cityId, prisonFilter } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (search) conditions.push(ilike(playersTable.username, `%${search}%`));
    if (cityId) conditions.push(eq(playersTable.cityId, parseInt(cityId)));
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
        isTraveling: playersTable.isTraveling,
        isAdmin: playersTable.isAdmin,
        adminRole: playersTable.adminRole,
        gangId: playersTable.gangId,
        gangRank: playersTable.gangRank,
        cityId: playersTable.cityId,
        cityName: citiesTable.name,
        createdAt: playersTable.createdAt,
      })
        .from(playersTable)
        .leftJoin(citiesTable, eq(playersTable.cityId, citiesTable.id))
        .where(whereClause)
        .orderBy(desc(playersTable.createdAt))
        .limit(limitNum)
        .offset(offset),
      db.select({ count: count() }).from(playersTable).where(whereClause),
    ]);

    const gangIds = [...new Set(players.filter(p => p.gangId).map(p => p.gangId!))];
    const gangMap: Record<number, string> = {};
    if (gangIds.length > 0) {
      const gangs = await db.select({ id: gangsTable.id, name: gangsTable.name }).from(gangsTable);
      gangs.forEach(g => { gangMap[g.id] = g.name; });
    }

    res.json({
      players: players.map(p => ({
        ...p,
        cityName: p.cityName ?? "",
        gangName: p.gangId ? (gangMap[p.gangId] ?? null) : null,
        prisonReleaseAt: p.prisonReleaseAt?.toISOString() ?? null,
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

router.patch("/admin/players/:id", requireAuth, requireAdminRole("moderator"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const playerId = parseInt(String(req.params.id));
    const { money, level, xp, attackPower, defensePower, isInPrison } = req.body as Record<string, unknown>;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof money === "number") updates.money = Math.max(0, Math.floor(money));
    if (typeof level === "number") updates.level = Math.max(1, level);
    if (typeof xp === "number") updates.xp = Math.max(0, xp);
    if (typeof attackPower === "number") updates.attackPower = Math.max(1, attackPower);
    if (typeof defensePower === "number") updates.defensePower = Math.max(1, defensePower);
    if (typeof isInPrison === "boolean") {
      updates.isInPrison = isInPrison;
      if (!isInPrison) { updates.prisonReleaseAt = null; updates.prisonCrime = null; }
    }

    const [updated] = await db.update(playersTable).set(updates).where(eq(playersTable.id, playerId)).returning();
    if (!updated) return void res.status(404).json({ error: "Player not found" });

    await logAdminAction(admin.id, admin.username, "patch_player", "player", playerId, `Updated player ${updated.username}`);
    res.json({ message: "Player updated", playerId: updated.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/admin/players/:id/ammo", requireAuth, requireAdminRole("moderator"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const playerId = parseInt(String(req.params.id));
    const { ammoId, quantity } = req.body as { ammoId: number; quantity: number };
    const qty = Math.max(1, parseInt(String(quantity)));

    const player = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
    if (!player[0]) return void res.status(404).json({ error: "Player not found" });

    const existing = await db.select().from(playerAmmoTable)
      .where(and(eq(playerAmmoTable.playerId, playerId), eq(playerAmmoTable.ammoId, ammoId)))
      .limit(1);

    if (existing[0]) {
      await db.update(playerAmmoTable).set({ quantity: existing[0].quantity + qty }).where(eq(playerAmmoTable.id, existing[0].id));
    } else {
      await db.insert(playerAmmoTable).values({ playerId, ammoId, quantity: qty });
    }

    await logAdminAction(admin.id, admin.username, "grant_ammo", "player", playerId, `Granted ${qty}x ammo to ${player[0].username}`);
    res.json({ message: `Granted ${qty} ammo to player` });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/admin/players/:id/prison", requireAuth, requireAdminRole("moderator"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const playerId = parseInt(String(req.params.id));
    const { hours = 1, crime = "Admin action" } = req.body as { hours?: number; crime?: string };
    const releaseAt = new Date(Date.now() + hours * 3600000);

    const [updated] = await db.update(playersTable)
      .set({ isInPrison: true, prisonReleaseAt: releaseAt, prisonCrime: crime, updatedAt: new Date() })
      .where(eq(playersTable.id, playerId)).returning();

    if (!updated) return void res.status(404).json({ error: "Player not found" });

    await logAdminAction(admin.id, admin.username, "jail_player", "player", playerId, `Jailed ${updated.username} for ${hours}h`);
    res.json({ message: "Player jailed" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/players/:id/prison", requireAuth, requireAdminRole("moderator"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const playerId = parseInt(String(req.params.id));

    const [updated] = await db.update(playersTable)
      .set({ isInPrison: false, prisonReleaseAt: null, prisonCrime: null, updatedAt: new Date() })
      .where(eq(playersTable.id, playerId)).returning();

    if (!updated) return void res.status(404).json({ error: "Player not found" });

    await logAdminAction(admin.id, admin.username, "release_player", "player", playerId, `Released ${updated.username} from prison`);
    res.json({ message: "Player released" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/players/:id", requireAuth, requireAdminRole("superadmin"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const playerId = parseInt(String(req.params.id));

    const player = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
    if (!player[0]) return void res.status(404).json({ error: "Player not found" });

    await db.transaction(async (tx) => {
      // Find any gangs this player leads and disband them first (bossId is notNull)
      const ledGangs = await tx.select({ id: gangsTable.id }).from(gangsTable).where(eq(gangsTable.bossId, playerId));
      for (const gang of ledGangs) {
        // Remove all members from the gang before deleting it
        await tx.update(playersTable).set({ gangId: null, gangRank: null }).where(eq(playersTable.gangId, gang.id));
        await tx.delete(gangsTable).where(eq(gangsTable.id, gang.id));
      }
      // Remove this player's own gang membership (if they were a member, not boss)
      await tx.update(playersTable).set({ gangId: null, gangRank: null }).where(eq(playersTable.id, playerId));
      // Delete bodyguard/guard relationships (both sides)
      await tx.delete(playerGuardsTable).where(
        or(eq(playerGuardsTable.protectedPlayerId, playerId), eq(playerGuardsTable.guardPlayerId, playerId))
      );
      await tx.delete(bodyguardRequestsTable).where(
        or(eq(bodyguardRequestsTable.fromPlayerId, playerId), eq(bodyguardRequestsTable.toPlayerId, playerId))
      );
      await tx.delete(playerNpcGuardsTable).where(eq(playerNpcGuardsTable.playerId, playerId));
      // Delete inventory
      await tx.delete(playerWeaponsTable).where(eq(playerWeaponsTable.playerId, playerId));
      await tx.delete(playerAmmoTable).where(eq(playerAmmoTable.playerId, playerId));
      await tx.delete(playerArmorTable).where(eq(playerArmorTable.playerId, playerId));
      // Delete attack records referencing this player
      await tx.delete(attacksTable).where(
        or(eq(attacksTable.attackerId, playerId), eq(attacksTable.targetId, playerId))
      );
      // Delete logs / market listings
      await tx.delete(activityLogTable).where(eq(activityLogTable.playerId, playerId));
      await tx.delete(crimeRecordsTable).where(eq(crimeRecordsTable.playerId, playerId));
      await tx.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.sellerId, playerId));
      // Finally delete the player
      await tx.delete(playersTable).where(eq(playersTable.id, playerId));
    });

    await logAdminAction(admin.id, admin.username, "delete_player", "player", playerId, `Deleted player ${player[0].username}`);
    res.json({ message: "Player deleted" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Legacy reset endpoint
router.delete("/admin/players/:playerId/reset", requireAuth, requireAdminRole("moderator"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const playerId = parseInt(String(req.params.playerId));
    const [updated] = await db.update(playersTable)
      .set({ money: 5000, level: 1, xp: 0, attackPower: 10, defensePower: 10, killCount: 0, deathCount: 0, isInPrison: false, prisonReleaseAt: null, prisonCrime: null, gangId: null, gangRank: null, updatedAt: new Date() })
      .where(eq(playersTable.id, playerId)).returning();
    if (!updated) return void res.status(404).json({ error: "Player not found" });
    await logAdminAction(admin.id, admin.username, "reset_player", "player", playerId, `Reset stats for ${updated.username}`);
    res.json({ message: "Player stats reset", playerId: updated.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Gangs ─────────────────────────────────────────────────────────────────────
router.get("/admin/gangs", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    const gangs = await db.select().from(gangsTable).orderBy(desc(gangsTable.treasury));
    const result = await Promise.all(gangs.map(async (gang) => {
      const [members, boss] = await Promise.all([
        db.select({ count: count() }).from(playersTable).where(eq(playersTable.gangId, gang.id)),
        db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, gang.bossId)).limit(1),
      ]);
      return { ...gang, memberCount: members[0]?.count ?? 0, bossName: boss[0]?.username ?? "Unknown", createdAt: gang.createdAt.toISOString() };
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch("/admin/gangs/:id", requireAuth, requireAdminRole("admin"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const gangId = parseInt(String(req.params.id));
    const { name, description, treasury, color } = req.body as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name;
    if (typeof description === "string") updates.description = description;
    if (typeof treasury === "number") updates.treasury = Math.max(0, treasury);
    if (typeof color === "string") updates.color = color;

    const [updated] = await db.update(gangsTable).set(updates).where(eq(gangsTable.id, gangId)).returning();
    if (!updated) return void res.status(404).json({ error: "Gang not found" });

    await logAdminAction(admin.id, admin.username, "patch_gang", "gang", gangId, `Updated gang ${updated.name}`);
    res.json({ message: "Gang updated", gangId: updated.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/gangs/:id", requireAuth, requireAdminRole("admin"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const gangId = parseInt(String(req.params.id));

    const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, gangId)).limit(1);
    if (!gang[0]) return void res.status(404).json({ error: "Gang not found" });

    await db.update(playersTable).set({ gangId: null, gangRank: null, updatedAt: new Date() }).where(eq(playersTable.gangId, gangId));
    await db.delete(gangsTable).where(eq(gangsTable.id, gangId));

    await logAdminAction(admin.id, admin.username, "delete_gang", "gang", gangId, `Disbanded gang "${gang[0].name}"`);
    res.json({ message: "Gang disbanded" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/admin/gangs/:id/members", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    const gangId = parseInt(String(req.params.id));
    const members = await db.select({
      id: playersTable.id,
      username: playersTable.username,
      level: playersTable.level,
      gangRank: playersTable.gangRank,
    }).from(playersTable).where(eq(playersTable.gangId, gangId));
    res.json(members);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/admin/gangs/:id/kick/:playerId", requireAuth, requireAdminRole("admin"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const gangId = parseInt(String(req.params.id));
    const playerId = parseInt(String(req.params.playerId));

    const [updated] = await db.update(playersTable)
      .set({ gangId: null, gangRank: null, updatedAt: new Date() })
      .where(and(eq(playersTable.id, playerId), eq(playersTable.gangId, gangId)))
      .returning();

    if (!updated) return void res.status(404).json({ error: "Member not found in this gang" });

    await logAdminAction(admin.id, admin.username, "kick_member", "player", playerId, `Kicked ${updated.username} from gang ${gangId}`);
    res.json({ message: "Member kicked from gang" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Items ─────────────────────────────────────────────────────────────────────
router.get("/admin/items/weapons", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    res.json(await db.select().from(weaponsTable));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

async function patchWeapon(req: import("express").Request, res: import("express").Response) {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const weaponId = parseInt(String(req.params.weaponId ?? req.params.id));
    const updates: Record<string, unknown> = {};
    const { name, attackPower, price, description, imageUrl } = req.body as Record<string, unknown>;
    if (name !== undefined) updates.name = name;
    if (attackPower !== undefined) updates.attackPower = attackPower;
    if (price !== undefined) updates.price = price;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    const [updated] = await db.update(weaponsTable).set(updates).where(eq(weaponsTable.id, weaponId)).returning();
    if (!updated) return void res.status(404).json({ error: "Weapon not found" });
    await logAdminAction(admin.id, admin.username, "patch_weapon", "weapon", weaponId, `Updated weapon ${updated.name}`);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

async function deleteWeapon(req: import("express").Request, res: import("express").Response) {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const weaponId = parseInt(String(req.params.weaponId ?? req.params.id));
    const weapon = await db.select().from(weaponsTable).where(eq(weaponsTable.id, weaponId)).limit(1);
    await db.delete(weaponsTable).where(eq(weaponsTable.id, weaponId));
    await logAdminAction(admin.id, admin.username, "delete_weapon", "weapon", weaponId, `Deleted weapon ${weapon[0]?.name ?? weaponId}`);
    res.json({ message: "Weapon deleted" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

router.patch("/admin/items/weapons/:weaponId", requireAuth, requireAdminRole("admin"), patchWeapon);
router.patch("/admin/weapons/:id", requireAuth, requireAdminRole("admin"), patchWeapon);
router.delete("/admin/items/weapons/:weaponId", requireAuth, requireAdminRole("superadmin"), deleteWeapon);
router.delete("/admin/weapons/:id", requireAuth, requireAdminRole("superadmin"), deleteWeapon);

router.get("/admin/items/ammo", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    res.json(await db.select().from(ammoTable));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

async function patchAmmo(req: import("express").Request, res: import("express").Response) {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const ammoId = parseInt(String(req.params.ammoId ?? req.params.id));
    const updates: Record<string, unknown> = {};
    const { name, damageBonus, price } = req.body as Record<string, unknown>;
    if (name !== undefined) updates.name = name;
    if (damageBonus !== undefined) updates.damageBonus = damageBonus;
    if (price !== undefined) updates.price = price;
    const [updated] = await db.update(ammoTable).set(updates).where(eq(ammoTable.id, ammoId)).returning();
    if (!updated) return void res.status(404).json({ error: "Ammo not found" });
    await logAdminAction(admin.id, admin.username, "patch_ammo", "ammo", ammoId, `Updated ammo ${updated.name}`);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

router.patch("/admin/items/ammo/:ammoId", requireAuth, requireAdminRole("admin"), patchAmmo);
router.patch("/admin/ammo/:id", requireAuth, requireAdminRole("admin"), patchAmmo);

router.get("/admin/items/armor", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    res.json(await db.select().from(armorItemsTable));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

async function patchArmor(req: import("express").Request, res: import("express").Response) {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const armorId = parseInt(String(req.params.armorId ?? req.params.id));
    const updates: Record<string, unknown> = {};
    const { name, defenseBonus, price, description, imageUrl } = req.body as Record<string, unknown>;
    if (name !== undefined) updates.name = name;
    if (defenseBonus !== undefined) updates.defenseBonus = defenseBonus;
    if (price !== undefined) updates.price = price;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    const [updated] = await db.update(armorItemsTable).set(updates).where(eq(armorItemsTable.id, armorId)).returning();
    if (!updated) return void res.status(404).json({ error: "Armor not found" });
    await logAdminAction(admin.id, admin.username, "patch_armor", "armor", armorId, `Updated armor ${updated.name}`);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

router.patch("/admin/items/armor/:armorId", requireAuth, requireAdminRole("admin"), patchArmor);
router.patch("/admin/armor/:id", requireAuth, requireAdminRole("admin"), patchArmor);

// ── Black Market ──────────────────────────────────────────────────────────────
router.get("/admin/blackmarket", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    const listings = await db.select().from(blackMarketListingsTable).orderBy(desc(blackMarketListingsTable.createdAt));
    const formatted = await Promise.all(listings.map(async (l) => {
      const seller = await db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, l.sellerId)).limit(1);
      return { ...l, sellerUsername: seller[0]?.username ?? "Admin", createdAt: l.createdAt.toISOString() };
    }));
    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/admin/blackmarket", requireAuth, requireAdminRole("admin"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const { itemType, itemId, quantity, price } = req.body as {
      itemType: typeof listingItemTypeEnum[number];
      itemId: number;
      quantity: number;
      price: number;
    };

    const validTypes: ReadonlyArray<typeof listingItemTypeEnum[number]> = [...listingItemTypeEnum];
    if (!validTypes.includes(itemType)) return void res.status(400).json({ error: "Invalid item type" });
    const qty = Math.max(1, parseInt(String(quantity)));
    const priceInt = Math.max(1, parseInt(String(price)));

    let itemName = "Admin Item";
    if (itemType === "weapon") {
      const w = await db.select().from(weaponsTable).where(eq(weaponsTable.id, itemId)).limit(1);
      if (!w[0]) return void res.status(404).json({ error: "Weapon not found" });
      itemName = w[0].name;
    } else if (itemType === "ammo") {
      const a = await db.select().from(ammoTable).where(eq(ammoTable.id, itemId)).limit(1);
      if (!a[0]) return void res.status(404).json({ error: "Ammo not found" });
      itemName = a[0].name;
    } else if (itemType === "armor") {
      const ar = await db.select().from(armorItemsTable).where(eq(armorItemsTable.id, itemId)).limit(1);
      if (!ar[0]) return void res.status(404).json({ error: "Armor not found" });
      itemName = ar[0].name;
    }

    const [listing] = await db.insert(blackMarketListingsTable).values({
      sellerId: admin.id, itemType, itemId, itemName, quantity: qty, price: priceInt,
    }).returning();

    await logAdminAction(admin.id, admin.username, "create_listing", "blackmarket", listing.id, `Listed ${qty}x ${itemName} for $${priceInt}`);
    res.status(201).json({ ...listing, sellerUsername: admin.username, createdAt: listing.createdAt.toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/blackmarket/:id", requireAuth, requireAdminRole("admin"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const listingId = parseInt(String(req.params.id));
    const listing = await db.select().from(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId)).limit(1);
    if (!listing[0]) return void res.status(404).json({ error: "Listing not found" });
    await db.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId));
    await logAdminAction(admin.id, admin.username, "delete_listing", "blackmarket", listingId, `Removed listing ${listingId}`);
    res.json({ message: "Listing removed" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Events / Activity Log ─────────────────────────────────────────────────────
router.get("/admin/events", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    const { page = "1", limit = "50", type, playerId, dateFrom, dateTo } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const cutoff = new Date(Date.now() - 60 * 86400000);
    const conditions = [gte(activityLogTable.createdAt, cutoff)];
    if (type) conditions.push(eq(activityLogTable.type, type));
    if (playerId) {
      const numericId = parseInt(playerId);
      if (!isNaN(numericId)) {
        conditions.push(eq(activityLogTable.playerId, numericId));
      } else {
        // name-based search: filter via subquery on players username
        conditions.push(
          sql`${activityLogTable.playerId} IN (SELECT id FROM players WHERE username ILIKE ${`%${playerId}%`})`
        );
      }
    }
    if (dateFrom) conditions.push(gte(activityLogTable.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(activityLogTable.createdAt, new Date(dateTo)));

    const whereClause = and(...conditions);
    const [events, totalResult] = await Promise.all([
      db.select({
        id: activityLogTable.id,
        playerId: activityLogTable.playerId,
        type: activityLogTable.type,
        description: activityLogTable.description,
        createdAt: activityLogTable.createdAt,
        username: playersTable.username,
      })
        .from(activityLogTable)
        .leftJoin(playersTable, eq(activityLogTable.playerId, playersTable.id))
        .where(whereClause)
        .orderBy(desc(activityLogTable.createdAt))
        .limit(limitNum)
        .offset(offset),
      db.select({ count: count() }).from(activityLogTable).where(whereClause),
    ]);

    res.json({
      events: events.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
      total: totalResult[0]?.count ?? 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Admin Actions Log ──────────────────────────────────────────────────────────
router.get("/admin/actions-log", requireAuth, requireAdminRole("admin"), async (req, res) => {
  try {
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const [logs, totalResult] = await Promise.all([
      db.select().from(adminActionsLogTable).orderBy(desc(adminActionsLogTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(adminActionsLogTable),
    ]);

    res.json({
      logs: logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
      total: totalResult[0]?.count ?? 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Role Management ───────────────────────────────────────────────────────────
router.get("/admin/roles", requireAuth, requireAdminRole("superadmin"), async (req, res) => {
  try {
    const admins = await db.select({
      id: playersTable.id,
      username: playersTable.username,
      adminRole: playersTable.adminRole,
      isAdmin: playersTable.isAdmin,
      createdAt: playersTable.createdAt,
    })
      .from(playersTable)
      .where(or(eq(playersTable.isAdmin, true), sql`${playersTable.adminRole} IS NOT NULL`))
      .orderBy(playersTable.username);

    res.json(admins.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch("/admin/roles/:playerId", requireAuth, requireAdminRole("superadmin"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const playerId = parseInt(String(req.params.playerId));
    const { adminRole } = req.body as { adminRole: AdminRole | null };

    const validRoles = [...adminRoleEnum, null];
    if (!validRoles.includes(adminRole)) return void res.status(400).json({ error: "Invalid role" });

    const updates: Record<string, unknown> = { adminRole, updatedAt: new Date(), isAdmin: !!adminRole };

    const [updated] = await db.update(playersTable).set(updates).where(eq(playersTable.id, playerId)).returning();
    if (!updated) return void res.status(404).json({ error: "Player not found" });

    await logAdminAction(admin.id, admin.username, "set_role", "player", playerId, `Set ${updated.username}'s role to ${adminRole ?? "none"}`);
    res.json({ message: "Role updated", playerId: updated.id, adminRole: updated.adminRole });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/admin/roles/search", requireAuth, requireAdminRole("superadmin"), async (req, res) => {
  try {
    const { search } = req.query as { search: string };
    const players = await db.select({ id: playersTable.id, username: playersTable.username, adminRole: playersTable.adminRole })
      .from(playersTable)
      .where(ilike(playersTable.username, `%${search ?? ""}%`))
      .limit(10);
    res.json(players);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Cities ────────────────────────────────────────────────────────────────────
router.get("/admin/cities", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
  try {
    res.json(await db.select().from(citiesTable));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch("/admin/cities/:cityId", requireAuth, requireAdminRole("admin"), async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const admin = await getOrCreatePlayer(clerkId);
    const cityId = parseInt(String(req.params.cityId));
    const { name, nameAr, description, travelHoursBase } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (nameAr !== undefined) updates.nameAr = nameAr;
    if (description !== undefined) updates.description = description;
    if (travelHoursBase !== undefined) updates.travelHoursBase = Math.max(1, Math.min(24, Number(travelHoursBase)));
    const [updated] = await db.update(citiesTable).set(updates).where(eq(citiesTable.id, cityId)).returning();
    if (!updated) return void res.status(404).json({ error: "City not found" });
    await logAdminAction(admin.id, admin.username, "patch_city", "city", cityId, `Updated city ${updated.name}`);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Legacy stats ──────────────────────────────────────────────────────────────
router.get("/admin/stats", requireAuth, requireAdminRole("reviewer"), async (req, res) => {
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

export default router;
