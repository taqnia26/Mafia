import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireAlive, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  propertyTypesTable, playerPropertiesTable, playerRanksTable,
  playerRankProgressTable, playersTable, nuclearReactorStateTable,
} from "@workspace/db/schema";
import { eq, and, sql, count, ne } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";
import { createNotification } from "../lib/notifications";
import { REACTOR, reactorIncomePerHour } from "../lib/reactor";

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

// Reactor payout: full hours since lastPayoutAt are converted to cash; any
// already-stored energy_units are also paid out. Always returns a result so
// stored energy can be claimed even if no new full hour has elapsed.
function calcReactorPayout(state: {
  energyUnits: number;
  lastPayoutAt: Date;
}): { fullHours: number; energyGenerated: number; storedEnergy: number; totalEnergy: number; money: number; newLastPayoutAt: Date } {
  const now = Date.now();
  const elapsedMs = now - state.lastPayoutAt.getTime();
  const fullHours = Math.min(REACTOR.MAX_CATCHUP_HOURS, Math.max(0, Math.floor(elapsedMs / 3600000)));
  const energyGenerated = REACTOR.ENERGY_PER_HOUR * fullHours;
  const storedEnergy = state.energyUnits ?? 0;
  // Cap accumulated energy at ENERGY_CAP — same rule the worker applies.
  const totalEnergy = Math.min(REACTOR.ENERGY_CAP, energyGenerated + storedEnergy);
  return {
    fullHours,
    energyGenerated,
    storedEnergy,
    totalEnergy,
    money: totalEnergy * REACTOR.MONEY_PER_ENERGY,
    newLastPayoutAt: fullHours > 0
      ? new Date(state.lastPayoutAt.getTime() + fullHours * 3600000)
      : state.lastPayoutAt,
  };
}

// Returns the timestamp at which the *next* hourly payout will fire.
function nextReactorPayoutAt(lastPayoutAt: Date): Date {
  return new Date(lastPayoutAt.getTime() + 3600000);
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
      isReactor: t.isReactor,
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
        isReactor: propertyTypesTable.isReactor,
        reactorEnergy: nuclearReactorStateTable.energyUnits,
        reactorIntegrity: nuclearReactorStateTable.integrity,
        reactorLastPayoutAt: nuclearReactorStateTable.lastPayoutAt,
        reactorIsUnderConstruction: nuclearReactorStateTable.isUnderConstruction,
        reactorConstructionCompleteAt: nuclearReactorStateTable.constructionCompleteAt,
        reactorCityId: nuclearReactorStateTable.cityId,
      })
      .from(playerPropertiesTable)
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .leftJoin(nuclearReactorStateTable, eq(nuclearReactorStateTable.playerPropertyId, playerPropertiesTable.id))
      .where(eq(playerPropertiesTable.playerId, player.id));

    const result = rows.map(r => {
      const isReactor = !!r.isReactor;
      const reactorState = (isReactor && r.reactorLastPayoutAt) ? {
        energyUnits: r.reactorEnergy ?? 0,
        integrity: r.reactorIntegrity ?? 100,
        lastPayoutAt: r.reactorLastPayoutAt,
        isUnderConstruction: !!r.reactorIsUnderConstruction,
        constructionCompleteAt: r.reactorConstructionCompleteAt!,
        cityId: r.reactorCityId ?? 0,
      } : null;

      let currentIncome: number;
      let nextLevelIncome: number | null;
      let upgradePrice: number | null;
      let pendingIncome: number;

      if (isReactor && reactorState) {
        currentIncome = reactorState.isUnderConstruction ? 0 : reactorIncomePerHour();
        nextLevelIncome = null;
        upgradePrice = null;
        if (reactorState.isUnderConstruction) {
          pendingIncome = 0;
        } else {
          const payout = calcReactorPayout({
            energyUnits: reactorState.energyUnits,
            lastPayoutAt: reactorState.lastPayoutAt,
          });
          pendingIncome = payout.money;
        }
      } else {
        currentIncome = incomePerHour(r.baseIncomePerHour ?? 0, r.level);
        nextLevelIncome = r.level < (r.maxLevel ?? 4)
          ? incomePerHour(r.baseIncomePerHour ?? 0, r.level + 1)
          : null;
        upgradePrice = r.level < (r.maxLevel ?? 4)
          ? upgradeCost(r.price ?? 0, r.level + 1)
          : null;
        pendingIncome = calcPendingIncome({
          baseIncomePerHour: r.baseIncomePerHour ?? 0,
          level: r.level,
          lastIncomeCollectedAt: r.lastIncomeCollectedAt,
        });
      }

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
        isReactor,
        reactor: reactorState ? {
          energyUnits: reactorState.energyUnits,
          energyCap: REACTOR.ENERGY_CAP,
          integrity: reactorState.integrity,
          isUnderConstruction: reactorState.isUnderConstruction,
          constructionCompleteAt: reactorState.constructionCompleteAt.toISOString(),
          lastPayoutAt: reactorState.lastPayoutAt.toISOString(),
          nextPayoutAt: reactorState.isUnderConstruction
            ? reactorState.constructionCompleteAt.toISOString()
            : nextReactorPayoutAt(reactorState.lastPayoutAt).toISOString(),
          energyPerHour: REACTOR.ENERGY_PER_HOUR,
          moneyPerEnergy: REACTOR.MONEY_PER_ENERGY,
          cityId: reactorState.cityId,
        } : null,
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

    if (propType.isReactor) {
      const existingReactor = await db
        .select({ id: nuclearReactorStateTable.id })
        .from(nuclearReactorStateTable)
        .leftJoin(playerPropertiesTable, eq(nuclearReactorStateTable.playerPropertyId, playerPropertiesTable.id))
        .where(and(
          eq(playerPropertiesTable.playerId, player.id),
          eq(nuclearReactorStateTable.cityId, player.cityId),
        ))
        .limit(1);
      if (existingReactor.length > 0) {
        return void res.status(400).json({ error: "You already own a Nuclear Reactor in this city" });
      }
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
    const constructionCompleteAt = new Date(now.getTime() + REACTOR.CONSTRUCTION_HOURS * 3600 * 1000);
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

        if (propType.isReactor) {
          await tx.insert(nuclearReactorStateTable).values({
            playerPropertyId: inserted.id,
            cityId: player.cityId,
            energyUnits: 0,
            integrity: 100,
            lastPayoutAt: constructionCompleteAt,
            isUnderConstruction: true,
            constructionCompleteAt,
          });
        }

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

    if (propType.isReactor) {
      await logActivity(player.id, "reactor_built",
        `Started construction on a Nuclear Reactor for $${propType.price.toLocaleString()} — completes in ${REACTOR.CONSTRUCTION_HOURS / 24} days`);
    } else {
      await logActivity(player.id, "property_purchased", `Purchased ${propType.nameEn} for $${propType.price.toLocaleString()}`);
    }

    const baseIncome = propType.isReactor ? 0 : incomePerHour(propType.baseIncomePerHour, 1);
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
      nextLevelIncome: propType.isReactor ? null : nextIncome,
      upgradePrice: propType.isReactor ? null : upCost,
      maxLevel: propType.maxLevel,
      pendingIncome: 0,
      canCollect: false,
      isReactor: propType.isReactor,
      reactor: propType.isReactor ? {
        energyUnits: 0,
        energyCap: REACTOR.ENERGY_CAP,
        integrity: 100,
        isUnderConstruction: true,
        constructionCompleteAt: constructionCompleteAt.toISOString(),
        lastPayoutAt: constructionCompleteAt.toISOString(),
        nextPayoutAt: constructionCompleteAt.toISOString(),
        energyPerHour: REACTOR.ENERGY_PER_HOUR,
        moneyPerEnergy: REACTOR.MONEY_PER_ENERGY,
        cityId: player.cityId,
      } : null,
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
        isReactor: propertyTypesTable.isReactor,
      })
      .from(playerPropertiesTable)
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .where(and(eq(playerPropertiesTable.id, propId), eq(playerPropertiesTable.playerId, player.id)))
      .limit(1);

    if (!prop) {
      return void res.status(404).json({ error: "Property not found" });
    }
    if (prop.isReactor) {
      return void res.status(400).json({ error: "Nuclear reactors cannot be upgraded" });
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

    // Skip reactors here — they have their own collection endpoint.
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
      .where(and(
        eq(playerPropertiesTable.playerId, player.id),
        ne(propertyTypesTable.isReactor, true),
      ));

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

router.get("/properties/reactor/:id", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const propId = parseInt(String(req.params.id));
    if (isNaN(propId)) return void res.status(400).json({ error: "Invalid property ID" });

    const [row] = await db
      .select({
        id: playerPropertiesTable.id,
        purchasedAt: playerPropertiesTable.purchasedAt,
        nameEn: propertyTypesTable.nameEn,
        nameAr: propertyTypesTable.nameAr,
        descriptionEn: propertyTypesTable.descriptionEn,
        descriptionAr: propertyTypesTable.descriptionAr,
        icon: propertyTypesTable.icon,
        isReactor: propertyTypesTable.isReactor,
        energyUnits: nuclearReactorStateTable.energyUnits,
        integrity: nuclearReactorStateTable.integrity,
        lastPayoutAt: nuclearReactorStateTable.lastPayoutAt,
        isUnderConstruction: nuclearReactorStateTable.isUnderConstruction,
        constructionCompleteAt: nuclearReactorStateTable.constructionCompleteAt,
        cityId: nuclearReactorStateTable.cityId,
      })
      .from(playerPropertiesTable)
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .leftJoin(nuclearReactorStateTable, eq(nuclearReactorStateTable.playerPropertyId, playerPropertiesTable.id))
      .where(and(eq(playerPropertiesTable.id, propId), eq(playerPropertiesTable.playerId, player.id)))
      .limit(1);

    if (!row || !row.isReactor || !row.lastPayoutAt) {
      return void res.status(404).json({ error: "Reactor not found" });
    }

    const payout = calcReactorPayout({
      energyUnits: row.energyUnits ?? 0,
      lastPayoutAt: row.lastPayoutAt,
    });

    return void res.json({
      id: row.id,
      nameEn: row.nameEn ?? "Nuclear Reactor",
      nameAr: row.nameAr ?? "مفاعل نووي",
      descriptionEn: row.descriptionEn ?? "",
      descriptionAr: row.descriptionAr ?? "",
      icon: row.icon ?? "atom",
      purchasedAt: row.purchasedAt.toISOString(),
      energyUnits: row.energyUnits ?? 0,
      energyCap: REACTOR.ENERGY_CAP,
      integrity: row.integrity ?? 100,
      isUnderConstruction: !!row.isUnderConstruction,
      constructionCompleteAt: row.constructionCompleteAt!.toISOString(),
      lastPayoutAt: row.lastPayoutAt.toISOString(),
      nextPayoutAt: row.isUnderConstruction
        ? row.constructionCompleteAt!.toISOString()
        : nextReactorPayoutAt(row.lastPayoutAt).toISOString(),
      energyPerHour: REACTOR.ENERGY_PER_HOUR,
      moneyPerEnergy: REACTOR.MONEY_PER_ENERGY,
      incomePerHour: row.isUnderConstruction ? 0 : reactorIncomePerHour(),
      pendingIncome: row.isUnderConstruction ? 0 : payout.money,
      pendingFullHours: payout.fullHours,
      cityId: row.cityId ?? 0,
    });
  } catch (err) {
    return void res.status(500).json({ error: "Failed to load reactor" });
  }
});

router.post("/properties/reactor/:id/collect", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const propId = parseInt(String(req.params.id));
    if (isNaN(propId)) return void res.status(400).json({ error: "Invalid reactor ID" });

    const [row] = await db
      .select({
        stateId: nuclearReactorStateTable.id,
        ppId: playerPropertiesTable.id,
        energyUnits: nuclearReactorStateTable.energyUnits,
        integrity: nuclearReactorStateTable.integrity,
        lastPayoutAt: nuclearReactorStateTable.lastPayoutAt,
        isUnderConstruction: nuclearReactorStateTable.isUnderConstruction,
        isReactor: propertyTypesTable.isReactor,
      })
      .from(playerPropertiesTable)
      .leftJoin(propertyTypesTable, eq(playerPropertiesTable.propertyTypeId, propertyTypesTable.id))
      .leftJoin(nuclearReactorStateTable, eq(nuclearReactorStateTable.playerPropertyId, playerPropertiesTable.id))
      .where(and(eq(playerPropertiesTable.id, propId), eq(playerPropertiesTable.playerId, player.id)))
      .limit(1);

    if (!row || !row.isReactor || !row.stateId || !row.lastPayoutAt) {
      return void res.status(404).json({ error: "Reactor not found" });
    }
    if (row.isUnderConstruction) {
      return void res.status(400).json({ error: "Reactor is still under construction" });
    }

    const payout = calcReactorPayout({
      energyUnits: row.energyUnits ?? 0,
      lastPayoutAt: row.lastPayoutAt,
    });

    // Always succeed — even if no full hour has elapsed and no stored energy,
    // we return $0 with the next payout time so the UI can show a countdown.
    if (payout.money <= 0) {
      return void res.json({
        success: true,
        money: 0,
        energyConverted: 0,
        hoursCollected: 0,
        nextPayoutAt: nextReactorPayoutAt(row.lastPayoutAt).toISOString(),
      });
    }

    const updated = await db.transaction(async (tx) => {
      const claimed = await tx.update(nuclearReactorStateTable)
        .set({
          energyUnits: 0,
          lastPayoutAt: payout.newLastPayoutAt,
        })
        .where(and(
          eq(nuclearReactorStateTable.id, row.stateId!),
          eq(nuclearReactorStateTable.lastPayoutAt, row.lastPayoutAt!),
        ))
        .returning({ id: nuclearReactorStateTable.id });
      if (claimed.length === 0) return false;
      await tx.update(playersTable)
        .set({ money: sql`${playersTable.money} + ${payout.money}`, updatedAt: new Date() })
        .where(eq(playersTable.id, player.id));
      return true;
    });

    if (!updated) {
      return void res.status(409).json({ error: "Reactor was just collected by another process. Try again." });
    }

    await logActivity(
      player.id,
      "reactor_collected",
      `Reactor sold ${payout.totalEnergy} energy units for $${payout.money.toLocaleString()}`,
    );

    return void res.json({
      success: true,
      money: payout.money,
      energyConverted: payout.totalEnergy,
      hoursCollected: payout.fullHours,
      nextPayoutAt: nextReactorPayoutAt(payout.newLastPayoutAt).toISOString(),
    });
  } catch (err) {
    return void res.status(500).json({ error: "Failed to collect reactor income" });
  }
});

export default router;
