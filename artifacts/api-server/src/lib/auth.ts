import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "./db";
import { playersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export async function requireNotInPrison(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const player = await getOrCreatePlayer(userId);
    if (player.isInPrison) {
      res.status(400).json({ error: "You cannot perform this action while in prison" });
      return;
    }
    next();
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

export async function getOrCreatePlayer(clerkId: string, username?: string) {
  const existing = await db.select().from(playersTable).where(eq(playersTable.clerkId, clerkId)).limit(1);
  if (existing.length > 0) return existing[0];

  const name = username || `Player_${clerkId.slice(-6)}`;
  const [player] = await db.insert(playersTable).values({
    clerkId,
    username: name,
    cityId: 1,
    level: 1,
    xp: 0,
    money: 5000,
    attackPower: 10,
    defensePower: 10,
  }).returning();
  return player;
}

export function getCurrentClerkId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}
