import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { crimeTypesTable, crimeRecordsTable, playersTable } from "@workspace/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router = Router();

router.get("/crimes", requireAuth, async (req, res) => {
  try {
    const crimes = await db.select().from(crimeTypesTable);
    res.json(crimes);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/crimes/attempt", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    if (player.isInPrison) return res.status(400).json({ error: "Cannot commit crimes while in prison" });

    const { crimeTypeId } = req.body;
    const crime = await db.select().from(crimeTypesTable).where(eq(crimeTypesTable.id, crimeTypeId)).limit(1);
    if (!crime[0]) return res.status(404).json({ error: "Crime not found" });

    if (player.level < crime[0].requiredLevel) {
      return res.status(400).json({ error: `Requires level ${crime[0].requiredLevel}` });
    }

    const cooldownStart = new Date(Date.now() - crime[0].cooldownMinutes * 60 * 1000);
    const recentAttempt = await db.select().from(crimeRecordsTable)
      .where(and(
        eq(crimeRecordsTable.playerId, player.id),
        eq(crimeRecordsTable.crimeTypeId, crimeTypeId),
        gte(crimeRecordsTable.attemptedAt, cooldownStart),
      ))
      .limit(1);

    if (recentAttempt[0]) {
      const nextAvailable = new Date(recentAttempt[0].attemptedAt.getTime() + crime[0].cooldownMinutes * 60 * 1000);
      const minutesLeft = Math.ceil((nextAvailable.getTime() - Date.now()) / 60000);
      return res.status(400).json({ error: `On cooldown. Try again in ${minutesLeft} minutes.` });
    }

    const roll = Math.random();
    const success = roll < crime[0].successRate;
    const caught = !success && roll > crime[0].successRate + 0.3;

    let moneyEarned = 0;
    let xpEarned = 0;
    let prisonReleaseAt: string | null = null;
    let prisonTimeHours: number | null = null;
    let message = "";

    if (success) {
      moneyEarned = Math.floor(crime[0].minReward + Math.random() * (crime[0].maxReward - crime[0].minReward));
      xpEarned = crime[0].xpReward;
      message = `Crime successful! You earned $${moneyEarned}.`;

      const newXp = player.xp + xpEarned;
      const newLevel = Math.floor(newXp / 1000) + 1;
      await db.update(playersTable).set({
        money: player.money + moneyEarned,
        xp: newXp,
        level: newLevel,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, player.id));

      await logActivity(player.id, "crime_success", message);
    } else if (caught) {
      prisonTimeHours = crime[0].prisonTimeHours;
      const releaseAt = new Date(Date.now() + prisonTimeHours * 3600 * 1000);
      prisonReleaseAt = releaseAt.toISOString();
      message = `You were caught! Sentenced to ${prisonTimeHours} hours in prison.`;

      await db.update(playersTable).set({
        isInPrison: true,
        prisonReleaseAt: releaseAt,
        prisonCrime: crime[0].name,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, player.id));

      await logActivity(player.id, "jailed", `Caught committing "${crime[0].name}" — ${prisonTimeHours}h sentence`);
    } else {
      message = "The crime failed but you escaped.";
      await logActivity(player.id, "crime_failed", `Failed "${crime[0].name}" but escaped`);
    }

    await db.insert(crimeRecordsTable).values({
      playerId: player.id,
      crimeTypeId,
      crimeName: crime[0].name,
      success,
      caught,
      moneyEarned,
      xpEarned,
    });

    res.json({ success, caught, moneyEarned, xpEarned, prisonTimeHours, message, prisonReleaseAt });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/crimes/history", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const records = await db.select().from(crimeRecordsTable)
      .where(eq(crimeRecordsTable.playerId, player.id))
      .orderBy(desc(crimeRecordsTable.attemptedAt))
      .limit(30);

    res.json(records.map(r => ({ ...r, attemptedAt: r.attemptedAt.toISOString() })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/prison/status", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    if (player.isInPrison && player.prisonReleaseAt && player.prisonReleaseAt <= new Date()) {
      await db.update(playersTable).set({
        isInPrison: false,
        prisonReleaseAt: null,
        prisonCrime: null,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, player.id));

      await logActivity(player.id, "released", "Released from prison");

      return res.json({ isInPrison: false, releaseAt: null, crimeCommitted: null, hoursRemaining: null });
    }

    const hoursRemaining = player.isInPrison && player.prisonReleaseAt
      ? (player.prisonReleaseAt.getTime() - Date.now()) / 3600000
      : null;

    res.json({
      isInPrison: player.isInPrison,
      releaseAt: player.prisonReleaseAt?.toISOString() ?? null,
      crimeCommitted: player.prisonCrime ?? null,
      hoursRemaining,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/prison/jailbreak/:targetPlayerId", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const targetId = parseInt(req.params.targetPlayerId);
    const { method } = req.body;

    if (player.isInPrison) return res.status(400).json({ error: "Cannot jailbreak while in prison" });

    const target = await db.select().from(playersTable).where(eq(playersTable.id, targetId)).limit(1);
    if (!target[0]) return res.status(404).json({ error: "Target not found" });
    if (!target[0].isInPrison) return res.status(400).json({ error: "Target is not in prison" });

    const bribeCost = 5000;
    const raidSuccessRate = 0.4;

    let success = false;
    let moneyCost = 0;
    let message = "";

    if (method === "bribe") {
      if (player.money < bribeCost) return res.status(400).json({ error: `Bribe costs $${bribeCost}` });
      success = true;
      moneyCost = bribeCost;
      message = "Bribe successful. Your ally is free.";
    } else {
      success = Math.random() < raidSuccessRate;
      message = success ? "Raid successful! Your ally escaped." : "Raid failed. Guards repelled the attempt.";
    }

    if (success) {
      if (moneyCost > 0) {
        await db.update(playersTable).set({ money: player.money - moneyCost, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
      }
      await db.update(playersTable).set({
        isInPrison: false,
        prisonReleaseAt: null,
        prisonCrime: null,
        updatedAt: new Date(),
      }).where(eq(playersTable.id, target[0].id));
      await logActivity(target[0].id, "released", `Broken out of prison by ${player.username}`);
    }

    res.json({ success, moneyCost, message });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
