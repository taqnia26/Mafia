import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  attacksTable, playersTable, weaponsTable, citiesTable,
  playerAmmoTable, playerNpcGuardsTable, playerArmorTable, armorItemsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router = Router();

router.post("/attacks/spy/:targetPlayerId", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const targetId = parseInt(req.params.targetPlayerId);

    const target = await db.select().from(playersTable).where(eq(playersTable.id, targetId)).limit(1);
    if (!target[0]) return res.status(404).json({ error: "Target not found" });

    const t = target[0];

    if (t.antiSpyEnabled) {
      return res.json({
        success: false,
        blocked: true,
        targetPlayerId: targetId,
        targetUsername: null,
        level: null,
        attackPower: null,
        defensePower: null,
        bodyguardCount: null,
        armorItems: null,
        weapons: null,
        isInPrison: null,
        cityName: null,
      });
    }

    const [city, npcGuards, armor] = await Promise.all([
      db.select().from(citiesTable).where(eq(citiesTable.id, t.cityId)).limit(1),
      db.select().from(playerNpcGuardsTable).where(eq(playerNpcGuardsTable.playerId, t.id)),
      db.select({ armorName: armorItemsTable.name }).from(playerArmorTable).leftJoin(armorItemsTable, eq(playerArmorTable.armorId, armorItemsTable.id)).where(eq(playerArmorTable.playerId, t.id)),
    ]);

    res.json({
      success: true,
      blocked: false,
      targetPlayerId: t.id,
      targetUsername: t.username,
      level: t.level,
      attackPower: t.attackPower,
      defensePower: t.defensePower,
      bodyguardCount: npcGuards.length,
      armorItems: armor.map(a => a.armorName ?? "Unknown"),
      weapons: null,
      isInPrison: t.isInPrison,
      cityName: city[0]?.name ?? "",
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/attacks", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    if (player.isInPrison) return res.status(400).json({ error: "Cannot attack while in prison" });
    if (player.isTraveling) return res.status(400).json({ error: "Cannot attack while traveling" });

    const { targetPlayerId, weaponId, ammoQuantity } = req.body;

    const [target, weapon] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, targetPlayerId)).limit(1),
      db.select().from(weaponsTable).where(eq(weaponsTable.id, weaponId)).limit(1),
    ]);

    if (!target[0]) return res.status(404).json({ error: "Target not found" });
    if (!weapon[0]) return res.status(404).json({ error: "Weapon not found" });
    if (target[0].id === player.id) return res.status(400).json({ error: "Cannot attack yourself" });

    const playerAmmo = await db.select().from(playerAmmoTable).where(eq(playerAmmoTable.playerId, player.id)).limit(1);
    const totalAmmo = playerAmmo.reduce((sum, a) => sum + a.quantity, 0);
    if (totalAmmo < ammoQuantity) return res.status(400).json({ error: "Insufficient ammo" });

    const travelHours = 4 + Math.random() * 2;
    const arrivalAt = new Date(Date.now() + travelHours * 3600 * 1000);

    const fromCity = await db.select().from(citiesTable).where(eq(citiesTable.id, player.cityId)).limit(1);
    const toCity = await db.select().from(citiesTable).where(eq(citiesTable.id, target[0].cityId)).limit(1);

    const [attack] = await db.insert(attacksTable).values({
      attackerId: player.id,
      targetId: target[0].id,
      weaponId,
      ammoUsed: ammoQuantity,
      fromCityId: player.cityId,
      toCityId: target[0].cityId,
      status: "traveling",
      travelArrivalAt: arrivalAt,
    }).returning();

    if (playerAmmo[0]) {
      const remainingAmmo = Math.max(0, playerAmmo[0].quantity - ammoQuantity);
      await db.update(playerAmmoTable).set({ quantity: remainingAmmo }).where(eq(playerAmmoTable.id, playerAmmo[0].id));
    }

    await logActivity(player.id, "attack_sent", `Attacking ${target[0].username} - arriving at ${arrivalAt.toISOString()}`);
    await logActivity(target[0].id, "attack_received", `Under attack from ${player.username}!`);

    res.status(201).json({
      id: attack.id,
      attackerId: attack.attackerId,
      attackerUsername: player.username,
      targetId: attack.targetId,
      targetUsername: target[0].username,
      status: attack.status,
      travelArrivalAt: attack.travelArrivalAt?.toISOString() ?? null,
      ammoUsed: attack.ammoUsed,
      damageDealt: null,
      targetSurvived: null,
      fromCityName: fromCity[0]?.name ?? "",
      toCityName: toCity[0]?.name ?? "",
      weaponName: weapon[0].name,
      createdAt: attack.createdAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/attacks/my", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const attacks = await db.select().from(attacksTable).where(eq(attacksTable.attackerId, player.id)).orderBy(desc(attacksTable.createdAt)).limit(20);
    const formatted = await Promise.all(attacks.map(async (a) => {
      const [target, weapon, fromCity, toCity] = await Promise.all([
        db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, a.targetId)).limit(1),
        db.select({ name: weaponsTable.name }).from(weaponsTable).where(eq(weaponsTable.id, a.weaponId)).limit(1),
        db.select({ name: citiesTable.name }).from(citiesTable).where(eq(citiesTable.id, a.fromCityId)).limit(1),
        db.select({ name: citiesTable.name }).from(citiesTable).where(eq(citiesTable.id, a.toCityId)).limit(1),
      ]);
      return {
        ...a,
        attackerUsername: player.username,
        targetUsername: target[0]?.username ?? "Unknown",
        fromCityName: fromCity[0]?.name ?? "",
        toCityName: toCity[0]?.name ?? "",
        weaponName: weapon[0]?.name ?? "Unknown",
        travelArrivalAt: a.travelArrivalAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      };
    }));

    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/attacks/incoming", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const attacks = await db.select().from(attacksTable).where(eq(attacksTable.targetId, player.id)).orderBy(desc(attacksTable.createdAt)).limit(20);
    const formatted = await Promise.all(attacks.map(async (a) => {
      const [attacker, weapon, fromCity, toCity] = await Promise.all([
        db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, a.attackerId)).limit(1),
        db.select({ name: weaponsTable.name }).from(weaponsTable).where(eq(weaponsTable.id, a.weaponId)).limit(1),
        db.select({ name: citiesTable.name }).from(citiesTable).where(eq(citiesTable.id, a.fromCityId)).limit(1),
        db.select({ name: citiesTable.name }).from(citiesTable).where(eq(citiesTable.id, a.toCityId)).limit(1),
      ]);
      return {
        ...a,
        attackerUsername: attacker[0]?.username ?? "Unknown",
        targetUsername: player.username,
        fromCityName: fromCity[0]?.name ?? "",
        toCityName: toCity[0]?.name ?? "",
        weaponName: weapon[0]?.name ?? "Unknown",
        travelArrivalAt: a.travelArrivalAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      };
    }));

    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/attacks/:attackId/cancel", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const attackId = parseInt(req.params.attackId);

    const attack = await db.select().from(attacksTable).where(eq(attacksTable.id, attackId)).limit(1);
    if (!attack[0]) return res.status(404).json({ error: "Attack not found" });
    if (attack[0].attackerId !== player.id) return res.status(403).json({ error: "Not your attack" });
    if (attack[0].status !== "traveling") return res.status(400).json({ error: "Cannot cancel completed attack" });

    await db.update(attacksTable).set({ status: "cancelled" }).where(eq(attacksTable.id, attackId));

    res.json({ message: "Attack cancelled" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
