import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  blackMarketListingsTable, playersTable, weaponsTable, ammoTable, armorItemsTable,
  playerWeaponsTable, playerAmmoTable, playerArmorTable,
  listingItemTypeEnum,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

type ItemType = typeof listingItemTypeEnum[number];

const router = Router();

router.get("/blackmarket", requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    const validTypes: ReadonlyArray<ItemType> = [...listingItemTypeEnum];
    const itemType = typeof type === "string" && validTypes.includes(type as ItemType)
      ? (type as ItemType)
      : null;

    const listings = itemType
      ? await db.select().from(blackMarketListingsTable)
          .where(eq(blackMarketListingsTable.itemType, itemType))
          .orderBy(desc(blackMarketListingsTable.createdAt))
      : await db.select().from(blackMarketListingsTable)
          .orderBy(desc(blackMarketListingsTable.createdAt));

    const formatted = await Promise.all(listings.map(async (l) => {
      const seller = await db.select({ username: playersTable.username })
        .from(playersTable)
        .where(eq(playersTable.id, l.sellerId))
        .limit(1);
      return {
        ...l,
        sellerUsername: seller[0]?.username ?? "Unknown",
        createdAt: l.createdAt.toISOString(),
      };
    }));

    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/blackmarket", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const { itemType, itemId, quantity, price } = req.body as {
      itemType: ItemType;
      itemId: number;
      quantity: number;
      price: number;
    };

    const validTypes: ReadonlyArray<ItemType> = [...listingItemTypeEnum];
    if (!validTypes.includes(itemType)) return void res.status(400).json({ error: "Invalid item type" });
    const qty = parseInt(String(quantity));
    const priceInt = parseInt(String(price));
    if (!Number.isInteger(qty) || qty < 1) return void res.status(400).json({ error: "Quantity must be a positive integer" });
    if (!Number.isInteger(priceInt) || priceInt < 1) return void res.status(400).json({ error: "Price must be a positive integer" });

    let itemName = "Unknown";

    if (itemType === "weapon") {
      const ownership = await db.select().from(playerWeaponsTable)
        .where(and(eq(playerWeaponsTable.playerId, player.id), eq(playerWeaponsTable.weaponId, itemId)))
        .limit(1);
      if (!ownership[0] || ownership[0].quantity < qty) {
        return void res.status(400).json({ error: "Insufficient weapon inventory" });
      }
      const w = await db.select().from(weaponsTable).where(eq(weaponsTable.id, itemId)).limit(1);
      if (!w[0]) return void res.status(404).json({ error: "Weapon not found" });
      itemName = w[0].name;

      const newQty = ownership[0].quantity - qty;
      if (newQty === 0) {
        await db.delete(playerWeaponsTable).where(eq(playerWeaponsTable.id, ownership[0].id));
      } else {
        await db.update(playerWeaponsTable).set({ quantity: newQty }).where(eq(playerWeaponsTable.id, ownership[0].id));
      }
      await db.update(playersTable).set({
        attackPower: sql`GREATEST(10, ${playersTable.attackPower} - ${w[0].attackPower * qty})`,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, player.id));

    } else if (itemType === "ammo") {
      const ownership = await db.select().from(playerAmmoTable)
        .where(and(eq(playerAmmoTable.playerId, player.id), eq(playerAmmoTable.ammoId, itemId)))
        .limit(1);
      if (!ownership[0] || ownership[0].quantity < qty) {
        return void res.status(400).json({ error: "Insufficient ammo inventory" });
      }
      const a = await db.select().from(ammoTable).where(eq(ammoTable.id, itemId)).limit(1);
      if (!a[0]) return void res.status(404).json({ error: "Ammo not found" });
      itemName = a[0].name;

      await db.update(playerAmmoTable)
        .set({ quantity: ownership[0].quantity - qty })
        .where(eq(playerAmmoTable.id, ownership[0].id));

    } else if (itemType === "armor") {
      const ownership = await db.select().from(playerArmorTable)
        .where(and(eq(playerArmorTable.playerId, player.id), eq(playerArmorTable.armorId, itemId)))
        .limit(1);
      if (!ownership[0] || ownership[0].quantity < qty) {
        return void res.status(400).json({ error: "Insufficient armor inventory" });
      }
      const ar = await db.select().from(armorItemsTable).where(eq(armorItemsTable.id, itemId)).limit(1);
      if (!ar[0]) return void res.status(404).json({ error: "Armor not found" });
      itemName = ar[0].name;

      const newQty = ownership[0].quantity - qty;
      if (newQty === 0) {
        await db.delete(playerArmorTable).where(eq(playerArmorTable.id, ownership[0].id));
      } else {
        await db.update(playerArmorTable).set({ quantity: newQty }).where(eq(playerArmorTable.id, ownership[0].id));
      }
      await db.update(playersTable).set({
        defensePower: sql`GREATEST(10, ${playersTable.defensePower} - ${ar[0].defenseBonus * qty})`,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, player.id));
    }

    const [listing] = await db.insert(blackMarketListingsTable).values({
      sellerId: player.id,
      itemType,
      itemId,
      itemName,
      quantity: qty,
      price: priceInt,
    }).returning();

    await logActivity(player.id, "black_market_listed", `Listed ${qty}x ${itemName} for $${priceInt}`);

    res.status(201).json({
      ...listing,
      sellerUsername: player.username,
      createdAt: listing.createdAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/blackmarket/my", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const listings = await db.select().from(blackMarketListingsTable)
      .where(eq(blackMarketListingsTable.sellerId, player.id))
      .orderBy(desc(blackMarketListingsTable.createdAt));

    res.json(listings.map(l => ({
      ...l,
      sellerUsername: player.username,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/blackmarket/:listingId/buy", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const listingId = parseInt(String(req.params.listingId));

    const listing = await db.select().from(blackMarketListingsTable)
      .where(eq(blackMarketListingsTable.id, listingId)).limit(1);
    if (!listing[0]) return void res.status(404).json({ error: "Listing not found" });
    if (listing[0].sellerId === player.id) return void res.status(400).json({ error: "Cannot buy your own listing" });
    if (player.money < listing[0].price) return void res.status(400).json({ error: "Insufficient funds" });

    const { itemType, itemId, quantity: qty, price, itemName } = listing[0];

    const seller = await db.select().from(playersTable)
      .where(eq(playersTable.id, listing[0].sellerId)).limit(1);

    await db.transaction(async (tx) => {
      await tx.update(playersTable)
        .set({ money: sql`${playersTable.money} - ${price}`, updatedAt: new Date() })
        .where(eq(playersTable.id, player.id));

      if (seller[0]) {
        await tx.update(playersTable)
          .set({ money: sql`${playersTable.money} + ${price}`, updatedAt: new Date() })
          .where(eq(playersTable.id, seller[0].id));
      }

      await tx.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId));

      if (itemType === "weapon") {
        const existing = await tx.select().from(playerWeaponsTable)
          .where(and(eq(playerWeaponsTable.playerId, player.id), eq(playerWeaponsTable.weaponId, itemId)))
          .limit(1);
        if (existing[0]) {
          await tx.update(playerWeaponsTable)
            .set({ quantity: existing[0].quantity + qty })
            .where(eq(playerWeaponsTable.id, existing[0].id));
        } else {
          await tx.insert(playerWeaponsTable).values({ playerId: player.id, weaponId: itemId, quantity: qty });
        }
        const weapon = await db.select().from(weaponsTable).where(eq(weaponsTable.id, itemId)).limit(1);
        if (weapon[0]) {
          await tx.update(playersTable).set({
            attackPower: sql`${playersTable.attackPower} + ${weapon[0].attackPower * qty}`,
            updatedAt: new Date(),
          }).where(eq(playersTable.id, player.id));
        }

      } else if (itemType === "ammo") {
        const existing = await tx.select().from(playerAmmoTable)
          .where(and(eq(playerAmmoTable.playerId, player.id), eq(playerAmmoTable.ammoId, itemId)))
          .limit(1);
        if (existing[0]) {
          await tx.update(playerAmmoTable)
            .set({ quantity: existing[0].quantity + qty })
            .where(eq(playerAmmoTable.id, existing[0].id));
        } else {
          await tx.insert(playerAmmoTable).values({ playerId: player.id, ammoId: itemId, quantity: qty });
        }

      } else if (itemType === "armor") {
        const existing = await tx.select().from(playerArmorTable)
          .where(and(eq(playerArmorTable.playerId, player.id), eq(playerArmorTable.armorId, itemId)))
          .limit(1);
        if (existing[0]) {
          await tx.update(playerArmorTable)
            .set({ quantity: existing[0].quantity + qty })
            .where(eq(playerArmorTable.id, existing[0].id));
        } else {
          await tx.insert(playerArmorTable).values({ playerId: player.id, armorId: itemId, quantity: qty });
        }
        const armor = await db.select().from(armorItemsTable).where(eq(armorItemsTable.id, itemId)).limit(1);
        if (armor[0]) {
          await tx.update(playersTable).set({
            defensePower: sql`${playersTable.defensePower} + ${armor[0].defenseBonus * qty}`,
            updatedAt: new Date(),
          }).where(eq(playersTable.id, player.id));
        }
      }
    });

    await logActivity(player.id, "black_market_purchase", `Bought ${qty}x ${itemName} for $${price}`);
    if (seller[0]) {
      await logActivity(seller[0].id, "black_market_sale", `Sold ${qty}x ${itemName} for $${price}`);
    }

    res.json({ message: "Purchase successful" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/blackmarket/:listingId", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const listingId = parseInt(String(req.params.listingId));

    const listing = await db.select().from(blackMarketListingsTable)
      .where(eq(blackMarketListingsTable.id, listingId)).limit(1);
    if (!listing[0]) return void res.status(404).json({ error: "Listing not found" });
    if (listing[0].sellerId !== player.id) return void res.status(403).json({ error: "Not your listing" });

    const { itemType, itemId, quantity: qty } = listing[0];

    await db.transaction(async (tx) => {
      await tx.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId));

      if (itemType === "weapon") {
        const existing = await tx.select().from(playerWeaponsTable)
          .where(and(eq(playerWeaponsTable.playerId, player.id), eq(playerWeaponsTable.weaponId, itemId)))
          .limit(1);
        if (existing[0]) {
          await tx.update(playerWeaponsTable)
            .set({ quantity: existing[0].quantity + qty })
            .where(eq(playerWeaponsTable.id, existing[0].id));
        } else {
          await tx.insert(playerWeaponsTable).values({ playerId: player.id, weaponId: itemId, quantity: qty });
        }
        const weapon = await db.select().from(weaponsTable).where(eq(weaponsTable.id, itemId)).limit(1);
        if (weapon[0]) {
          await tx.update(playersTable).set({
            attackPower: sql`${playersTable.attackPower} + ${weapon[0].attackPower * qty}`,
            updatedAt: new Date(),
          }).where(eq(playersTable.id, player.id));
        }

      } else if (itemType === "ammo") {
        const existing = await tx.select().from(playerAmmoTable)
          .where(and(eq(playerAmmoTable.playerId, player.id), eq(playerAmmoTable.ammoId, itemId)))
          .limit(1);
        if (existing[0]) {
          await tx.update(playerAmmoTable)
            .set({ quantity: existing[0].quantity + qty })
            .where(eq(playerAmmoTable.id, existing[0].id));
        } else {
          await tx.insert(playerAmmoTable).values({ playerId: player.id, ammoId: itemId, quantity: qty });
        }

      } else if (itemType === "armor") {
        const existing = await tx.select().from(playerArmorTable)
          .where(and(eq(playerArmorTable.playerId, player.id), eq(playerArmorTable.armorId, itemId)))
          .limit(1);
        if (existing[0]) {
          await tx.update(playerArmorTable)
            .set({ quantity: existing[0].quantity + qty })
            .where(eq(playerArmorTable.id, existing[0].id));
        } else {
          await tx.insert(playerArmorTable).values({ playerId: player.id, armorId: itemId, quantity: qty });
        }
        const armor = await db.select().from(armorItemsTable).where(eq(armorItemsTable.id, itemId)).limit(1);
        if (armor[0]) {
          await tx.update(playersTable).set({
            defensePower: sql`${playersTable.defensePower} + ${armor[0].defenseBonus * qty}`,
            updatedAt: new Date(),
          }).where(eq(playersTable.id, player.id));
        }
      }
    });

    res.json({ message: "Listing cancelled and inventory returned" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
