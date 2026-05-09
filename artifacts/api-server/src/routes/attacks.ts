import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireNotInPrison, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  attacksTable, playersTable, weaponsTable, citiesTable,
  playerWeaponsTable, playerAmmoTable, playerNpcGuardsTable, playerArmorTable, armorItemsTable,
} from "@workspace/db/schema";
import { eq, and, desc, sum } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";
import { recordSpy, hasRecentSpy } from "../lib/spyCache";

const router = Router();

router.post("/attacks/spy/:targetPlayerId", requireAuth, requireNotInPrison, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const targetId = parseInt(String(req.params.targetPlayerId));

    if (targetId === player.id) return void res.status(400).json({ error: "Cannot spy on yourself" });

    const target = await db.select().from(playersTable).where(eq(playersTable.id, targetId)).limit(1);
    if (!target[0]) return void res.status(404).json({ error: "Target not found" });

    const t = target[0];

    if (t.antiSpyEnabled) {
      return void res.json({
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

    const [city, npcGuards, armor, playerWeapons] = await Promise.all([
      db.select().from(citiesTable).where(eq(citiesTable.id, t.cityId)).limit(1),
      db.select().from(playerNpcGuardsTable).where(eq(playerNpcGuardsTable.playerId, t.id)),
      db.select({ armorName: armorItemsTable.name })
        .from(playerArmorTable)
        .leftJoin(armorItemsTable, eq(playerArmorTable.armorId, armorItemsTable.id))
        .where(eq(playerArmorTable.playerId, t.id)),
      db.select({ weaponName: weaponsTable.name, quantity: playerWeaponsTable.quantity })
        .from(playerWeaponsTable)
        .leftJoin(weaponsTable, eq(playerWeaponsTable.weaponId, weaponsTable.id))
        .where(eq(playerWeaponsTable.playerId, t.id)),
    ]);

    recordSpy(player.id, t.id);

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
      weapons: playerWeapons.map(w => `${w.weaponName ?? "Unknown"} x${w.quantity}`),
      isInPrison: t.isInPrison,
      cityName: city[0]?.name ?? "",
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/attacks", requireAuth, requireNotInPrison, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    if (player.isInPrison) return void res.status(400).json({ error: "Cannot attack while in prison" });
    if (player.isTraveling) return void res.status(400).json({ error: "Cannot attack while traveling" });

    const { targetPlayerId, weaponId, ammoQuantity } = req.body;
    if (!hasRecentSpy(player.id, parseInt(String(targetPlayerId)))) {
      return void res.status(400).json({ error: "You must spy on your target before attacking" });
    }
    const ammoQty = parseInt(String(ammoQuantity));
    if (!targetPlayerId || !weaponId || !ammoQty || ammoQty < 1) {
      return void res.status(400).json({ error: "targetPlayerId, weaponId, and ammoQuantity are required" });
    }

    const [target, weaponCatalog, ownedWeapon] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, targetPlayerId)).limit(1),
      db.select().from(weaponsTable).where(eq(weaponsTable.id, weaponId)).limit(1),
      db.select().from(playerWeaponsTable)
        .where(and(eq(playerWeaponsTable.playerId, player.id), eq(playerWeaponsTable.weaponId, weaponId)))
        .limit(1),
    ]);

    if (!target[0]) return void res.status(404).json({ error: "Target not found" });
    if (!weaponCatalog[0]) return void res.status(404).json({ error: "Weapon not found" });
    if (target[0].id === player.id) return void res.status(400).json({ error: "Cannot attack yourself" });

    if (!ownedWeapon[0] || ownedWeapon[0].quantity < 1) {
      return void res.status(400).json({ error: "You do not own that weapon" });
    }

    const allPlayerAmmo = await db.select().from(playerAmmoTable)
      .where(eq(playerAmmoTable.playerId, player.id))
      .orderBy(playerAmmoTable.id);

    const totalAmmo = allPlayerAmmo.reduce((s, a) => s + a.quantity, 0);
    if (totalAmmo < ammoQty) {
      return void res.status(400).json({ error: `Insufficient ammo — you have ${totalAmmo}, need ${ammoQty}` });
    }

    const [fromCity, toCity] = await Promise.all([
      db.select().from(citiesTable).where(eq(citiesTable.id, player.cityId)).limit(1),
      db.select().from(citiesTable).where(eq(citiesTable.id, target[0].cityId)).limit(1),
    ]);

    // Travel time is distance-based: average of both cities' travelHoursBase, clamped to [4, 6]h
    const fromBase = fromCity[0]?.travelHoursBase ?? 4;
    const toBase = toCity[0]?.travelHoursBase ?? 4;
    const travelHours = Math.min(6, Math.max(4, Math.round(((fromBase + toBase) / 2) * 10) / 10));
    const arrivalAt = new Date(Date.now() + travelHours * 3600 * 1000);

    const [attack] = await db.transaction(async (tx) => {
      let remaining = ammoQty;
      for (const row of allPlayerAmmo) {
        if (remaining <= 0) break;
        const deduct = Math.min(row.quantity, remaining);
        const newQty = row.quantity - deduct;
        if (newQty === 0) {
          await tx.delete(playerAmmoTable).where(eq(playerAmmoTable.id, row.id));
        } else {
          await tx.update(playerAmmoTable).set({ quantity: newQty }).where(eq(playerAmmoTable.id, row.id));
        }
        remaining -= deduct;
      }

      return tx.insert(attacksTable).values({
        attackerId: player.id,
        targetId: target[0].id,
        weaponId,
        ammoUsed: ammoQty,
        fromCityId: player.cityId,
        toCityId: target[0].cityId,
        status: "traveling",
        travelArrivalAt: arrivalAt,
      }).returning();
    });

    await Promise.all([
      logActivity(player.id, "attack_sent", `Attacking ${target[0].username} — ETA ${arrivalAt.toISOString()}`),
      logActivity(target[0].id, "attack_received", `Under attack from ${player.username}!`),
    ]);

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
      weaponName: weaponCatalog[0].name,
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

    const attacks = await db.select().from(attacksTable)
      .where(eq(attacksTable.attackerId, player.id))
      .orderBy(desc(attacksTable.createdAt))
      .limit(20);

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

    const attacks = await db.select().from(attacksTable)
      .where(eq(attacksTable.targetId, player.id))
      .orderBy(desc(attacksTable.createdAt))
      .limit(20);

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

router.post("/attacks/:attackId/cancel", requireAuth, requireNotInPrison, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const attackId = parseInt(String(req.params.attackId));

    const attack = await db.select().from(attacksTable).where(eq(attacksTable.id, attackId)).limit(1);
    if (!attack[0]) return void res.status(404).json({ error: "Attack not found" });
    if (attack[0].attackerId !== player.id) return void res.status(403).json({ error: "Not your attack" });
    if (attack[0].status !== "traveling") return void res.status(400).json({ error: "Cannot cancel completed attack" });

    await db.update(attacksTable).set({ status: "cancelled" }).where(eq(attacksTable.id, attackId));

    res.json({ message: "Attack cancelled" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
