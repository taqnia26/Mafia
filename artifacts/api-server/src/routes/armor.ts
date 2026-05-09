import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { armorItemsTable, playerArmorTable, playersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/armor", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(armorItemsTable);
    res.json(items.map(i => ({ ...i, imageUrl: i.imageUrl ?? null })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/armor/my", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const rows = await db.select({
      id: playerArmorTable.id,
      armorId: playerArmorTable.armorId,
      armorName: armorItemsTable.name,
      armorType: armorItemsTable.type,
      defenseBonus: armorItemsTable.defenseBonus,
      quantity: playerArmorTable.quantity,
      acquiredAt: playerArmorTable.acquiredAt,
    })
      .from(playerArmorTable)
      .leftJoin(armorItemsTable, eq(playerArmorTable.armorId, armorItemsTable.id))
      .where(eq(playerArmorTable.playerId, player.id));

    res.json(rows.map(r => ({
      ...r,
      acquiredAt: r.acquiredAt?.toISOString() ?? new Date().toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/armor/:armorId/buy", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const armorId = parseInt(req.params.armorId);
    const quantity = parseInt(req.body.quantity ?? "1");

    const armor = await db.select().from(armorItemsTable).where(eq(armorItemsTable.id, armorId)).limit(1);
    if (!armor[0]) return res.status(404).json({ error: "Armor not found" });

    const totalCost = armor[0].price * quantity;
    if (player.money < totalCost) return res.status(400).json({ error: "Insufficient funds" });

    await db.update(playersTable).set({ money: player.money - totalCost, updatedAt: new Date() }).where(eq(playersTable.id, player.id));

    const existing = await db.select().from(playerArmorTable).where(and(eq(playerArmorTable.playerId, player.id), eq(playerArmorTable.armorId, armorId))).limit(1);
    let row;
    if (existing[0]) {
      [row] = await db.update(playerArmorTable).set({ quantity: existing[0].quantity + quantity }).where(eq(playerArmorTable.id, existing[0].id)).returning();
    } else {
      [row] = await db.insert(playerArmorTable).values({ playerId: player.id, armorId, quantity }).returning();
    }

    const defenseIncrease = armor[0].defenseBonus * quantity;
    await db.update(playersTable).set({ defensePower: player.defensePower + defenseIncrease, updatedAt: new Date() }).where(eq(playersTable.id, player.id));

    res.json({
      id: row.id,
      armorId,
      armorName: armor[0].name,
      armorType: armor[0].type,
      defenseBonus: armor[0].defenseBonus,
      quantity: row.quantity,
      acquiredAt: row.acquiredAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
