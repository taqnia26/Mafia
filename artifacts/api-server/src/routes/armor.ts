import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireNotInPrison, requireAlive, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { armorItemsTable, playerArmorTable, playersTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

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

router.post("/armor/:armorId/buy", requireAuth, requireAlive, requireNotInPrison, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    if (player.isInPrison) return void res.status(400).json({ error: "Cannot buy armor while in prison" });
    const armorId = parseInt(String(req.params.armorId));
    const quantity = parseInt(String(req.body.quantity ?? "1"));

    if (!Number.isInteger(quantity) || quantity < 1) {
      return void res.status(400).json({ error: "Quantity must be a positive integer" });
    }

    const armor = await db.select().from(armorItemsTable).where(eq(armorItemsTable.id, armorId)).limit(1);
    if (!armor[0]) return void res.status(404).json({ error: "Armor not found" });

    const totalCost = armor[0].price * quantity;
    if (player.money < totalCost) return void res.status(400).json({ error: "Insufficient funds" });

    let row;
    await db.transaction(async (tx) => {
      await tx.update(playersTable)
        .set({ money: sql`${playersTable.money} - ${totalCost}`, updatedAt: new Date() })
        .where(eq(playersTable.id, player.id));

      const existing = await tx.select().from(playerArmorTable)
        .where(and(eq(playerArmorTable.playerId, player.id), eq(playerArmorTable.armorId, armorId)))
        .limit(1);

      if (existing[0]) {
        [row] = await tx.update(playerArmorTable)
          .set({ quantity: existing[0].quantity + quantity })
          .where(eq(playerArmorTable.id, existing[0].id))
          .returning();
      } else {
        [row] = await tx.insert(playerArmorTable)
          .values({ playerId: player.id, armorId, quantity })
          .returning();
      }

      await tx.update(playersTable)
        .set({
          defensePower: sql`${playersTable.defensePower} + ${armor[0].defenseBonus * quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(playersTable.id, player.id));
    });

    res.json({
      id: row!.id,
      armorId,
      armorName: armor[0].name,
      armorType: armor[0].type,
      defenseBonus: armor[0].defenseBonus,
      quantity: row!.quantity,
      acquiredAt: row!.acquiredAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
