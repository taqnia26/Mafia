import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { weaponsTable, playerWeaponsTable, ammoTable, playerAmmoTable, playersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/weapons", requireAuth, async (req, res) => {
  try {
    const weapons = await db.select().from(weaponsTable);
    res.json(weapons.map(w => ({ ...w, imageUrl: w.imageUrl ?? null })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/weapons/my", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const rows = await db.select({
      id: playerWeaponsTable.id,
      weaponId: playerWeaponsTable.weaponId,
      weaponName: weaponsTable.name,
      weaponType: weaponsTable.type,
      attackPower: weaponsTable.attackPower,
      quantity: playerWeaponsTable.quantity,
      acquiredAt: playerWeaponsTable.acquiredAt,
    })
      .from(playerWeaponsTable)
      .leftJoin(weaponsTable, eq(playerWeaponsTable.weaponId, weaponsTable.id))
      .where(eq(playerWeaponsTable.playerId, player.id));

    res.json(rows.map(r => ({
      ...r,
      acquiredAt: r.acquiredAt?.toISOString() ?? new Date().toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/weapons/:weaponId/buy", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const weaponId = parseInt(req.params.weaponId);
    const quantity = parseInt(req.body.quantity ?? "1");

    const weapon = await db.select().from(weaponsTable).where(eq(weaponsTable.id, weaponId)).limit(1);
    if (!weapon[0]) return res.status(404).json({ error: "Weapon not found" });

    const totalCost = weapon[0].price * quantity;
    if (player.money < totalCost) return res.status(400).json({ error: "Insufficient funds" });

    await db.update(playersTable).set({ money: player.money - totalCost, updatedAt: new Date() }).where(eq(playersTable.id, player.id));

    const existing = await db.select().from(playerWeaponsTable).where(and(eq(playerWeaponsTable.playerId, player.id), eq(playerWeaponsTable.weaponId, weaponId))).limit(1);
    let row;
    if (existing[0]) {
      [row] = await db.update(playerWeaponsTable).set({ quantity: existing[0].quantity + quantity }).where(eq(playerWeaponsTable.id, existing[0].id)).returning();
    } else {
      [row] = await db.insert(playerWeaponsTable).values({ playerId: player.id, weaponId, quantity }).returning();
    }

    const attackIncrease = weapon[0].attackPower * quantity;
    await db.update(playersTable).set({ attackPower: player.attackPower + attackIncrease, updatedAt: new Date() }).where(eq(playersTable.id, player.id));

    res.json({
      id: row.id,
      weaponId,
      weaponName: weapon[0].name,
      weaponType: weapon[0].type,
      attackPower: weapon[0].attackPower,
      quantity: row.quantity,
      acquiredAt: row.acquiredAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/ammo", requireAuth, async (req, res) => {
  try {
    const ammos = await db.select().from(ammoTable);
    res.json(ammos);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/ammo/my", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const rows = await db.select({
      id: playerAmmoTable.id,
      ammoId: playerAmmoTable.ammoId,
      ammoName: ammoTable.name,
      ammoType: ammoTable.type,
      quantity: playerAmmoTable.quantity,
    })
      .from(playerAmmoTable)
      .leftJoin(ammoTable, eq(playerAmmoTable.ammoId, ammoTable.id))
      .where(eq(playerAmmoTable.playerId, player.id));

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/ammo/:ammoId/buy", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const ammoId = parseInt(req.params.ammoId);
    const quantity = parseInt(req.body.quantity ?? "1");

    const ammo = await db.select().from(ammoTable).where(eq(ammoTable.id, ammoId)).limit(1);
    if (!ammo[0]) return res.status(404).json({ error: "Ammo not found" });

    const totalCost = ammo[0].price * quantity;
    if (player.money < totalCost) return res.status(400).json({ error: "Insufficient funds" });

    await db.update(playersTable).set({ money: player.money - totalCost, updatedAt: new Date() }).where(eq(playersTable.id, player.id));

    const existing = await db.select().from(playerAmmoTable).where(and(eq(playerAmmoTable.playerId, player.id), eq(playerAmmoTable.ammoId, ammoId))).limit(1);
    let row;
    if (existing[0]) {
      [row] = await db.update(playerAmmoTable).set({ quantity: existing[0].quantity + quantity }).where(eq(playerAmmoTable.id, existing[0].id)).returning();
    } else {
      [row] = await db.insert(playerAmmoTable).values({ playerId: player.id, ammoId, quantity }).returning();
    }

    res.json({
      id: row.id,
      ammoId,
      ammoName: ammo[0].name,
      ammoType: ammo[0].type,
      quantity: row.quantity,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
