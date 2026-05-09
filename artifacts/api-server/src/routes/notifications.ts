import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

const router = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const [notifications, unreadResult] = await Promise.all([
      db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.playerId, player.id))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(30),
      db.select({ count: count() })
        .from(notificationsTable)
        .where(and(
          eq(notificationsTable.playerId, player.id),
          eq(notificationsTable.read, false),
        )),
    ]);

    const unreadCount = unreadResult[0]?.count ?? 0;

    res.json({
      unreadCount,
      notifications: notifications.map(n => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/notifications/mark-read", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    await db.update(notificationsTable)
      .set({ read: true })
      .where(and(
        eq(notificationsTable.playerId, player.id),
        eq(notificationsTable.read, false),
      ));

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const notifId = parseInt(String(req.params.id));

    if (isNaN(notifId)) {
      return void res.status(400).json({ error: "Invalid notification ID" });
    }

    await db.update(notificationsTable)
      .set({ read: true })
      .where(and(
        eq(notificationsTable.id, notifId),
        eq(notificationsTable.playerId, player.id),
      ));

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
