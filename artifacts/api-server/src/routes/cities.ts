import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireNotInPrison, requireAlive, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { citiesTable, playersTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router = Router();

router.get("/cities", requireAuth, async (req, res) => {
  try {
    const cities = await db.select().from(citiesTable);
    const result = await Promise.all(cities.map(async (city) => {
      const players = await db.select({ count: count() }).from(playersTable).where(eq(playersTable.cityId, city.id));
      return {
        ...city,
        playerCount: players[0]?.count ?? 0,
      };
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/cities/travel", requireAuth, requireAlive, requireNotInPrison, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const { targetCityId } = req.body as { targetCityId: number };

    if (player.isInPrison) return void res.status(400).json({ error: "Cannot travel while in prison" });
    if (player.isTraveling) return void res.status(400).json({ error: "Already traveling" });
    if (player.cityId === targetCityId) return void res.status(400).json({ error: "Already in that city" });

    const fromCity = await db.select().from(citiesTable).where(eq(citiesTable.id, player.cityId)).limit(1);
    const toCity = await db.select().from(citiesTable).where(eq(citiesTable.id, targetCityId)).limit(1);
    if (!toCity[0]) return void res.status(404).json({ error: "City not found" });

    // Travel time is distance-based using both cities' travelHoursBase — fully deterministic, no random
    const fromBase = fromCity[0]?.travelHoursBase ?? 4;
    const toBase = toCity[0]?.travelHoursBase ?? 4;
    const travelHours = Math.round(((fromBase + toBase) / 2) * 10) / 10;
    const arrivalAt = new Date(Date.now() + travelHours * 3600 * 1000);

    await db.update(playersTable).set({
      isTraveling: true,
      travelToCityId: targetCityId,
      travelArrivalAt: arrivalAt,
      updatedAt: new Date(),
    }).where(eq(playersTable.id, player.id));

    await logActivity(player.id, "traveled", `Traveling to ${toCity[0].name} — arriving in ${travelHours.toFixed(1)}h`);

    res.json({
      travelTimeHours: travelHours,
      arrivalAt: arrivalAt.toISOString(),
      fromCityName: fromCity[0]?.name ?? "",
      toCityName: toCity[0].name,
      message: `Traveling to ${toCity[0].name}. Estimated arrival: ${arrivalAt.toLocaleTimeString()}`,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
