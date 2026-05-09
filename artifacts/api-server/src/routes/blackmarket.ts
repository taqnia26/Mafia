import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { blackMarketListingsTable, playersTable, weaponsTable, ammoTable, armorItemsTable, playerWeaponsTable, playerAmmoTable, playerArmorTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router = Router();

router.get("/blackmarket", requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    let query = db.select().from(blackMarketListingsTable);
    const listings = type
      ? await db.select().from(blackMarketListingsTable).where(eq(blackMarketListingsTable.itemType, type as any)).orderBy(desc(blackMarketListingsTable.createdAt))
      : await db.select().from(blackMarketListingsTable).orderBy(desc(blackMarketListingsTable.createdAt));

    const formatted = await Promise.all(listings.map(async (l) => {
      const seller = await db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, l.sellerId)).limit(1);
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
    const { itemType, itemId, quantity, price } = req.body;

    let itemName = "Unknown";
    if (itemType === "weapon") {
      const w = await db.select().from(weaponsTable).where(eq(weaponsTable.id, itemId)).limit(1);
      itemName = w[0]?.name ?? "Unknown";
    } else if (itemType === "ammo") {
      const a = await db.select().from(ammoTable).where(eq(ammoTable.id, itemId)).limit(1);
      itemName = a[0]?.name ?? "Unknown";
    } else if (itemType === "armor") {
      const ar = await db.select().from(armorItemsTable).where(eq(armorItemsTable.id, itemId)).limit(1);
      itemName = ar[0]?.name ?? "Unknown";
    }

    const [listing] = await db.insert(blackMarketListingsTable).values({
      sellerId: player.id,
      itemType,
      itemId,
      itemName,
      quantity,
      price,
    }).returning();

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
    const listingId = parseInt(req.params.listingId);

    const listing = await db.select().from(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId)).limit(1);
    if (!listing[0]) return res.status(404).json({ error: "Listing not found" });
    if (listing[0].sellerId === player.id) return res.status(400).json({ error: "Cannot buy your own listing" });
    if (player.money < listing[0].price) return res.status(400).json({ error: "Insufficient funds" });

    const seller = await db.select().from(playersTable).where(eq(playersTable.id, listing[0].sellerId)).limit(1);

    await db.update(playersTable).set({ money: player.money - listing[0].price, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    if (seller[0]) {
      await db.update(playersTable).set({ money: seller[0].money + listing[0].price, updatedAt: new Date() }).where(eq(playersTable.id, seller[0].id));
    }

    await db.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId));

    await logActivity(player.id, "black_market_purchase", `Bought ${listing[0].quantity}x ${listing[0].itemName} for $${listing[0].price}`);
    if (seller[0]) {
      await logActivity(seller[0].id, "black_market_sale", `Sold ${listing[0].quantity}x ${listing[0].itemName} for $${listing[0].price}`);
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
    const listingId = parseInt(req.params.listingId);

    const listing = await db.select().from(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId)).limit(1);
    if (!listing[0]) return res.status(404).json({ error: "Listing not found" });
    if (listing[0].sellerId !== player.id) return res.status(403).json({ error: "Not your listing" });

    await db.delete(blackMarketListingsTable).where(eq(blackMarketListingsTable.id, listingId));

    res.json({ message: "Listing cancelled" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
