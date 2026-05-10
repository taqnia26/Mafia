import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireAlive, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, playerPropertiesTable, propertyTypesTable, safeHouseRentalsTable,
} from "@workspace/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";
import { SAFE_HOUSE, recordAdminRevenue } from "../lib/phase1";

const router = Router();

// List rentable safe houses in the player's current city.
router.get("/safe-house/listings", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const rows = await db
      .select({
        playerPropertyId: playerPropertiesTable.id,
        ownerId: playerPropertiesTable.playerId,
        ownerName: playersTable.username,
        level: playerPropertiesTable.level,
        nameEn: propertyTypesTable.nameEn,
        nameAr: propertyTypesTable.nameAr,
      })
      .from(playerPropertiesTable)
      .innerJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .innerJoin(playersTable, eq(playersTable.id, playerPropertiesTable.playerId))
      .where(and(
        eq(propertyTypesTable.slug, "safe_house"),
        eq(playersTable.cityId, player.cityId),
      ));

    return void res.json(rows.map(r => ({
      ...r,
      // Suggested rent scales with level: $10k * level
      suggestedRent: SAFE_HOUSE.MIN_RENT * r.level,
    })));
  } catch {
    return void res.status(500).json({ error: "Failed to load safe houses" });
  }
});

// Current safe house status for the player.
router.get("/safe-house/me", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const expired = player.inSafeHouse && player.safeHouseExpiresAt && player.safeHouseExpiresAt <= new Date();
    if (expired) {
      await db.update(playersTable)
        .set({ inSafeHouse: false, safeHouseExpiresAt: null })
        .where(eq(playersTable.id, player.id));
      return void res.json({ inSafeHouse: false, expiresAt: null });
    }

    return void res.json({
      inSafeHouse: !!player.inSafeHouse,
      expiresAt: player.safeHouseExpiresAt?.toISOString() ?? null,
    });
  } catch {
    return void res.status(500).json({ error: "Failed to load safe house status" });
  }
});

// Rent a safe house.
router.post("/safe-house/rent", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const { playerPropertyId, rentAmount, durationDays = 7 } =
      req.body as { playerPropertyId?: number; rentAmount?: number; durationDays?: number };

    if (!playerPropertyId || !rentAmount) {
      return void res.status(400).json({ error: "playerPropertyId and rentAmount are required" });
    }
    if (rentAmount < SAFE_HOUSE.MIN_RENT) {
      return void res.status(400).json({ error: `Minimum rent is $${SAFE_HOUSE.MIN_RENT.toLocaleString()}` });
    }
    if (durationDays < 1 || durationDays > SAFE_HOUSE.MAX_DAYS) {
      return void res.status(400).json({ error: `Duration must be 1-${SAFE_HOUSE.MAX_DAYS} days` });
    }
    if (player.money < rentAmount) {
      return void res.status(400).json({ error: "Insufficient funds" });
    }

    const [property] = await db
      .select({
        id: playerPropertiesTable.id,
        ownerId: playerPropertiesTable.playerId,
        slug: propertyTypesTable.slug,
        ownerCityId: playersTable.cityId,
      })
      .from(playerPropertiesTable)
      .innerJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .innerJoin(playersTable, eq(playersTable.id, playerPropertiesTable.playerId))
      .where(eq(playerPropertiesTable.id, playerPropertyId)).limit(1);

    if (!property || property.slug !== "safe_house") {
      return void res.status(404).json({ error: "Safe house not found" });
    }
    if (property.ownerCityId !== player.cityId) {
      return void res.status(400).json({ error: "Safe House must be in your current city" });
    }
    if (property.ownerId === player.id) {
      return void res.status(400).json({ error: "You cannot rent your own safe house" });
    }

    const ownerRevenue = Math.floor(rentAmount * SAFE_HOUSE.OWNER_CUT);
    const adminRevenue = rentAmount - ownerRevenue;
    const endTime = new Date(Date.now() + durationDays * 86400000);
    const ip = (req.ip ?? null) as string | null;

    await db.transaction(async (tx) => {
      // Lock the renter row to serialize concurrent /rent calls and re-check cooldown.
      const lockedRows = await tx.select({
        money: playersTable.money,
        expires: playersTable.safeHouseExpiresAt,
      })
        .from(playersTable)
        .where(eq(playersTable.id, player.id))
        .for("update").limit(1);
      const me = lockedRows[0];
      if (!me) throw new Error("PLAYER_GONE");
      if (me.money < rentAmount) throw new Error("INSUFFICIENT_FUNDS");

      const recent = await tx.select({ id: safeHouseRentalsTable.id })
        .from(safeHouseRentalsTable)
        .where(and(
          eq(safeHouseRentalsTable.renterId, player.id),
          gt(safeHouseRentalsTable.createdAt, sql`NOW() - INTERVAL '24 hours'`),
        )).limit(1);
      if (recent.length > 0) throw new Error("COOLDOWN");

      await tx.update(playersTable)
        .set({ money: sql`${playersTable.money} - ${rentAmount}`, updatedAt: new Date() })
        .where(eq(playersTable.id, player.id));

      await tx.update(playersTable)
        .set({ money: sql`${playersTable.money} + ${ownerRevenue}`, updatedAt: new Date() })
        .where(eq(playersTable.id, property.ownerId));

      await tx.insert(safeHouseRentalsTable).values({
        playerPropertyId: property.id,
        renterId: player.id,
        ownerId: property.ownerId,
        rentAmount, ownerRevenue, adminRevenue,
        startTime: new Date(), endTime, status: "active",
        renterIp: ip,
      });

      await tx.update(playersTable)
        .set({ inSafeHouse: true, safeHouseExpiresAt: endTime, updatedAt: new Date() })
        .where(eq(playersTable.id, player.id));
    });

    await recordAdminRevenue(
      "safe_house_rental", adminRevenue,
      `Rental from ${player.username} ($${rentAmount} total, 65% admin cut)`,
    );
    await logActivity(player.id, "safe_house_rented",
      `Rented safe house for $${rentAmount.toLocaleString()} until ${endTime.toISOString().slice(0,16)}`);

    return void res.json({
      success: true,
      rentPaid: rentAmount,
      ownerReceived: ownerRevenue,
      adminReceived: adminRevenue,
      protectedUntil: endTime.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INSUFFICIENT_FUNDS") return void res.status(400).json({ error: "Insufficient funds" });
    if (msg === "COOLDOWN") return void res.status(429).json({ error: "You can only rent once every 24 hours" });
    if (msg === "PLAYER_GONE") return void res.status(404).json({ error: "Player not found" });
    return void res.status(500).json({ error: "Failed to rent safe house" });
  }
});

export default router;
