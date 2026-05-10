import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireAlive, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  propertyTypesTable, playerPropertiesTable, playerRanksTable,
  playerRankProgressTable, playersTable,
} from "@workspace/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router = Router();

function incomePerHour(baseIncomePerHour: number, level: number): number {
  return Math.floor(baseIncomePerHour * level);
}

function upgradeCost(price: number, nextLevel: number): number {
  if (nextLevel === 2) return Math.floor(price * 0.5);
  if (nextLevel === 3) return Math.floor(price * 1.0);
  if (nextLevel === 4) return Math.floor(price * 2.0);
  return 0;
}

function calcPendingIncome(property: { baseIncomePerHour: number; level: number; lastIncomeCollectedAt: Date }): number {
  const MAX_HOURS = 24;
  const now = Date.now();
  const lastCollected = property.lastIncomeCollectedAt.getTime();
  const hoursElapsed = Math.min((now - lastCollected) / 3600000, MAX_HOURS);
  return Math.floor(hoursElapsed * incomePerHour(property.baseIncomePerHour, property.level));
}

router.get("/properties/types", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const rankProgressRows = await db.select().from(playerRankProgressTable)
      .where(eq(playerRankProgressTable.playerId, player.id)).limit(1);
    const currentRankNum = rankProgressRows[0]?.currentRank ?? 1;

    const rankRow = await db.select().from(playerRanksTable)
      .where(eq(playerRanksTable.rankNumber, currentRankNum)).limit(1);
    const maxProperties = rankRow[0]?.maxProperties ?? 0;

    const [types, ownedRows] = await Promise.all([
      db.select().from(propertyTypesTable).where(eq(propertyTypesTable.isActive, true)),
      db.select({ typeId: playerPropertiesTable.propertyTypeId, cnt: count() })
        .from(playerPropertiesTable)
        .where(eq(playerPropertiesTable.playerId, player.id))
        .groupBy(playerPropertiesTable.propertyTypeId),
    ]);

    const totalOwned = ownedRows.reduce((sum, r) => sum + Number(r.cnt), 0);
    const ownedByType: Record<number, number> = {};
    for (const r of ownedRows) {
      ownedByType[r.typeId] = Number(r.cnt);
    }

    const result = types.map(t => ({
      id: t.id,
      nameEn: t.nameEn,
      nameAr: t.nameAr,
      descriptionEn: t.descriptionEn,
      descriptionAr: t.descriptionAr,
      price: t.price,
      baseIncomePerHour: t.baseIncomePerHour,
      requiredLevel: t.requiredLevel,
      maxLevel: t.maxLevel,
      icon: t.icon,
      imageUrl: t.imageUrl,
      perksEn: t.perksEn,
      perksAr: t.perksAr,
      ownedCount: ownedByType[t.id] ?? 0,
      canAfford: player.money >= t.price,
      levelMet: player.level >= t.requiredLevel,
      rankSlotAvailable: totalOwned < maxProperties,
      maxProperties,
      totalOwned,
    }));

    return void res.json(result);
  } catch (err) {
    return void res.status(500).json({ error: "Failed to fetch property types" });
  }
});

router.get("/properties/my", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const rows = await db
      .select({
        id: playerPropertiesTable.id,
        level: playerPropertiesTable.level,
        purchasedAt: playerPropertiesTable.purchasedAt,
        lastIncomeCollectedAt: playerPropertiesTable.lastIncomeCollectedAt,
        typeId: propertyTypesTable.id,
        nameEn: propertyTypesTable.nameEn,
        nameAr: propertyTypesTable.nameAr,
        descriptionEn: propertyTypesTable.descriptionEn,
        descriptionAr: propertyTypesTable.descriptionAr,
        price: propertyTypesTable.price,
        baseIncomePerHour: propertyTypesTable.baseIncomePerHour,
        maxLevel: propertyTypesTable.maxLevel,
        icon: propertyTypesTable.icon,
        imageUrl: propertyTypesTable.imageUrl,
        perksEn: propertyTypesTable.perksEn,
        perksAr: propertyTypesTable.perksAr,
      })
      .from(playerPropertiesTable)
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .where(eq(playerPropertiesTable.playerId, player.id));

    const result = rows.map(r => {
      const currentIncome = incomePerHour(r.baseIncomePerHour ?? 0, r.level);
      const nextLevelIncome = r.level < (r.maxLevel ?? 4)
        ? incomePerHour(r.baseIncomePerHour ?? 0, r.level + 1)
        : null;
      const upgradePrice = r.level < (r.maxLevel ?? 4)
        ? upgradeCost(r.price ?? 0, r.level + 1)
        : null;
      const pendingIncome = calcPendingIncome({
        baseIncomePerHour: r.baseIncomePerHour ?? 0,
        level: r.level,
        lastIncomeCollectedAt: r.lastIncomeCollectedAt,
      });

      return {
        id: r.id,
        level: r.level,
        purchasedAt: r.purchasedAt.toISOString(),
        lastIncomeCollectedAt: r.lastIncomeCollectedAt.toISOString(),
        typeId: r.typeId,
        nameEn: r.nameEn ?? "",
        nameAr: r.nameAr ?? "",
        descriptionEn: r.descriptionEn ?? "",
        descriptionAr: r.descriptionAr ?? "",
        icon: r.icon ?? "building",
        imageUrl: r.imageUrl ?? "",
        perksEn: r.perksEn ?? "",
        perksAr: r.perksAr ?? "",
        incomePerHour: currentIncome,
        nextLevelIncome,
        upgradePrice,
        maxLevel: r.maxLevel ?? 4,
        pendingIncome,
        canCollect: pendingIncome > 0,
      };
    });

    return void res.json(result);
  } catch (err) {
    return void res.status(500).json({ error: "Failed to fetch properties" });
  }
});

router.post("/properties/buy", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const { propertyTypeId } = req.body as { propertyTypeId?: number };

    if (!propertyTypeId) {
      return void res.status(400).json({ error: "propertyTypeId is required" });
    }

    const [propType] = await db.select().from(propertyTypesTable)
      .where(and(eq(propertyTypesTable.id, propertyTypeId), eq(propertyTypesTable.isActive, true)))
      .limit(1);

    if (!propType) {
      return void res.status(404).json({ error: "Property type not found" });
    }
    if (player.level < propType.requiredLevel) {
      return void res.status(400).json({ error: `Requires level ${propType.requiredLevel}` });
    }
    if (player.money < propType.price) {
      return void res.status(400).json({ error: "Insufficient funds" });
    }

    const rankProgressRows = await db.select().from(playerRankProgressTable)
      .where(eq(playerRankProgressTable.playerId, player.id)).limit(1);
    const currentRankNum = rankProgressRows[0]?.currentRank ?? 1;
    const rankRow = await db.select().from(playerRanksTable)
      .where(eq(playerRanksTable.rankNumber, currentRankNum)).limit(1);
    const maxProperties = rankRow[0]?.maxProperties ?? 0;

    const [ownedCount] = await db.select({ cnt: count() })
      .from(playerPropertiesTable)
      .where(eq(playerPropertiesTable.playerId, player.id));
    const totalOwned = Number(ownedCount?.cnt ?? 0);

    if (totalOwned >= maxProperties) {
      return void res.status(400).json({
        error: `Your rank allows a maximum of ${maxProperties} properties. Upgrade your rank to own more.`,
      });
    }

    const now = new Date();
    let newProp: typeof playerPropertiesTable.$inferSelect | undefined;
    try {
      newProp = await db.transaction(async (tx) => {
        const deducted = await tx.update(playersTable)
          .set({ money: sql`${playersTable.money} - ${propType.price}`, updatedAt: now })
          .where(and(eq(playersTable.id, player.id), sql`${playersTable.money} >= ${propType.price}`))
          .returning({ id: playersTable.id });
        if (deducted.length === 0) {
          throw new Error("INSUFFICIENT_FUNDS");
        }

        const [ownedNow] = await tx.select({ cnt: count() })
          .from(playerPropertiesTable)
          .where(eq(playerPropertiesTable.playerId, player.id));
        if (Number(ownedNow?.cnt ?? 0) >= maxProperties) {
          throw new Error("SLOT_FULL");
        }

        const [inserted] = await tx.insert(playerPropertiesTable).values({
          playerId: player.id,
          propertyTypeId: propType.id,
          level: 1,
          purchasedAt: now,
          lastIncomeCollectedAt: now,
        }).returning();
        return inserted;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "INSUFFICIENT_FUNDS") {
        return void res.status(400).json({ error: "Insufficient funds" });
      }
      if (msg === "SLOT_FULL") {
        return void res.status(400).json({
          error: `Your rank allows a maximum of ${maxProperties} properties. Upgrade your rank to own more.`,
        });
      }
      throw e;
    }

    if (!newProp) {
      return void res.status(500).json({ error: "Failed to purchase property" });
    }

    await logActivity(player.id, "property_purchased", `Purchased ${propType.nameEn} for $${propType.price.toLocaleString()}`);

    const baseIncome = incomePerHour(propType.baseIncomePerHour, 1);
    const nextIncome = propType.maxLevel > 1 ? incomePerHour(propType.baseIncomePerHour, 2) : null;
    const upCost = propType.maxLevel > 1 ? upgradeCost(propType.price, 2) : null;

    return void res.status(201).json({
      id: newProp.id,
      level: newProp.level,
      purchasedAt: newProp.purchasedAt.toISOString(),
      lastIncomeCollectedAt: newProp.lastIncomeCollectedAt.toISOString(),
      typeId: propType.id,
      nameEn: propType.nameEn,
      nameAr: propType.nameAr,
      descriptionEn: propType.descriptionEn,
      descriptionAr: propType.descriptionAr,
      icon: propType.icon,
      imageUrl: propType.imageUrl,
      perksEn: propType.perksEn,
      perksAr: propType.perksAr,
      incomePerHour: baseIncome,
      nextLevelIncome: nextIncome,
      upgradePrice: upCost,
      maxLevel: propType.maxLevel,
      pendingIncome: 0,
      canCollect: false,
    });
  } catch (err) {
    return void res.status(500).json({ error: "Failed to purchase property" });
  }
});

router.post("/properties/:id/upgrade", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const propId = parseInt(String(req.params.id));

    if (isNaN(propId)) {
      return void res.status(400).json({ error: "Invalid property ID" });
    }

    const [prop] = await db
      .select({
        id: playerPropertiesTable.id,
        level: playerPropertiesTable.level,
        playerId: playerPropertiesTable.playerId,
        typeId: propertyTypesTable.id,
        nameEn: propertyTypesTable.nameEn,
        nameAr: propertyTypesTable.nameAr,
        maxLevel: propertyTypesTable.maxLevel,
        price: propertyTypesTable.price,
      })
      .from(playerPropertiesTable)
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .where(and(eq(playerPropertiesTable.id, propId), eq(playerPropertiesTable.playerId, player.id)))
      .limit(1);

    if (!prop) {
      return void res.status(404).json({ error: "Property not found" });
    }
    if (prop.level >= (prop.maxLevel ?? 4)) {
      return void res.status(400).json({ error: "Property is already at maximum level" });
    }

    const cost = upgradeCost(prop.price ?? 0, prop.level + 1);
    if (player.money < cost) {
      return void res.status(400).json({ error: `Insufficient funds. Upgrade costs $${cost.toLocaleString()}` });
    }

    const upgraded = await db.transaction(async (tx) => {
      const deducted = await tx.update(playersTable)
        .set({ money: sql`${playersTable.money} - ${cost}`, updatedAt: new Date() })
        .where(and(eq(playersTable.id, player.id), sql`${playersTable.money} >= ${cost}`))
        .returning({ id: playersTable.id });
      if (deducted.length === 0) return false;
      await tx.update(playerPropertiesTable)
        .set({ level: prop.level + 1 })
        .where(and(eq(playerPropertiesTable.id, propId), eq(playerPropertiesTable.level, prop.level)));
      return true;
    });

    if (!upgraded) {
      return void res.status(400).json({ error: "Insufficient funds. Upgrade costs $" + cost.toLocaleString() });
    }

    await logActivity(
      player.id,
      "property_upgraded",
      `Upgraded ${prop.nameEn ?? "property"} to level ${prop.level + 1} for $${cost.toLocaleString()}`,
    );

    return void res.json({ success: true, newLevel: prop.level + 1, cost });
  } catch (err) {
    return void res.status(500).json({ error: "Failed to upgrade property" });
  }
});

router.post("/properties/collect", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const rows = await db
      .select({
        id: playerPropertiesTable.id,
        level: playerPropertiesTable.level,
        lastIncomeCollectedAt: playerPropertiesTable.lastIncomeCollectedAt,
        baseIncomePerHour: propertyTypesTable.baseIncomePerHour,
        nameEn: propertyTypesTable.nameEn,
      })
      .from(playerPropertiesTable)
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .where(eq(playerPropertiesTable.playerId, player.id));

    if (rows.length === 0) {
      return void res.status(400).json({ error: "No properties to collect income from" });
    }

    let totalIncome = 0;
    const now = new Date();

    await db.transaction(async (tx) => {
      for (const r of rows) {
        const income = calcPendingIncome({
          baseIncomePerHour: r.baseIncomePerHour ?? 0,
          level: r.level,
          lastIncomeCollectedAt: r.lastIncomeCollectedAt,
        });
        if (income > 0) {
          const claimed = await tx.update(playerPropertiesTable)
            .set({ lastIncomeCollectedAt: now })
            .where(and(
              eq(playerPropertiesTable.id, r.id),
              eq(playerPropertiesTable.lastIncomeCollectedAt, r.lastIncomeCollectedAt),
            ))
            .returning({ id: playerPropertiesTable.id });
          if (claimed.length > 0) {
            totalIncome += income;
          }
        }
      }

      if (totalIncome > 0) {
        await tx.update(playersTable)
          .set({ money: sql`${playersTable.money} + ${totalIncome}`, updatedAt: now })
          .where(eq(playersTable.id, player.id));
      }
    });

    if (totalIncome > 0) {
      await logActivity(player.id, "income_collected", `Collected $${totalIncome.toLocaleString()} from ${rows.length} properties`);
    }

    return void res.json({ success: true, totalIncome, propertiesCount: rows.length });
  } catch (err) {
    return void res.status(500).json({ error: "Failed to collect property income" });
  }
});

export default router;
