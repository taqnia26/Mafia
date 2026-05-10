import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  inboxMessagesTable, playersTable,
  inboxCategoryEnum, type InboxCategory, type InboxMessage,
} from "@workspace/db/schema";
import { and, desc, eq, ilike, or, sql, count } from "drizzle-orm";

const router = Router();

const VALID_CATEGORIES = new Set<InboxCategory>(inboxCategoryEnum);

function serialize(m: InboxMessage) {
  return {
    id: m.id,
    category: m.category,
    priority: m.priority,
    subjectEn: m.subjectEn,
    subjectAr: m.subjectAr,
    bodyEn: m.bodyEn,
    bodyAr: m.bodyAr,
    metadata: m.metadata ?? {},
    actionLink: m.actionLink ?? null,
    actionLabelEn: m.actionLabelEn ?? null,
    actionLabelAr: m.actionLabelAr ?? null,
    isRead: m.isRead,
    isArchived: m.isArchived,
    readAt: m.readAt?.toISOString() ?? null,
    archivedAt: m.archivedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

// GET /inbox — list messages with filters + per-category counts
router.get("/inbox", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const { category, unreadOnly, search, archived, page = "1", limit = "30" } = req.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 30));
    const offset = (pageNum - 1) * limitNum;

    const conds = [
      eq(inboxMessagesTable.playerId, player.id),
      eq(inboxMessagesTable.isDeleted, false),
    ];

    if (archived === "true") {
      conds.push(eq(inboxMessagesTable.isArchived, true));
    } else if (archived === "false" || archived === undefined) {
      conds.push(eq(inboxMessagesTable.isArchived, false));
    }

    if (category && VALID_CATEGORIES.has(category as InboxCategory)) {
      conds.push(eq(inboxMessagesTable.category, category as InboxCategory));
    }
    if (unreadOnly === "true") {
      conds.push(eq(inboxMessagesTable.isRead, false));
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conds.push(or(
        ilike(inboxMessagesTable.subjectEn, q),
        ilike(inboxMessagesTable.subjectAr, q),
        ilike(inboxMessagesTable.bodyEn, q),
        ilike(inboxMessagesTable.bodyAr, q),
      )!);
    }

    const where = and(...conds);

    const [rows, totalRow, perCategory, [pInfo]] = await Promise.all([
      db.select().from(inboxMessagesTable).where(where)
        .orderBy(desc(inboxMessagesTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ c: count() }).from(inboxMessagesTable).where(where),
      db.select({
        category: inboxMessagesTable.category,
        total: count(),
        unread: sql<number>`SUM(CASE WHEN ${inboxMessagesTable.isRead} = false THEN 1 ELSE 0 END)`,
      })
        .from(inboxMessagesTable)
        .where(and(
          eq(inboxMessagesTable.playerId, player.id),
          eq(inboxMessagesTable.isDeleted, false),
          eq(inboxMessagesTable.isArchived, false),
        ))
        .groupBy(inboxMessagesTable.category),
      db.select({ unreadInboxCount: playersTable.unreadInboxCount }).from(playersTable).where(eq(playersTable.id, player.id)),
    ]);

    const counts: Record<string, { total: number; unread: number }> = {};
    for (const c of inboxCategoryEnum) counts[c] = { total: 0, unread: 0 };
    for (const r of perCategory) {
      counts[r.category] = { total: Number(r.total) || 0, unread: Number(r.unread) || 0 };
    }

    res.json({
      messages: rows.map(serialize),
      total: Number(totalRow[0]?.c ?? 0),
      page: pageNum,
      limit: limitNum,
      unreadCount: Number(pInfo?.unreadInboxCount ?? 0),
      categoryCounts: counts,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /inbox/:id — full detail; auto-mark as read
router.get("/inbox/:id", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid id" });

    const msg = await db.transaction(async (tx) => {
      const [m] = await tx.select().from(inboxMessagesTable).where(and(
        eq(inboxMessagesTable.id, id),
        eq(inboxMessagesTable.playerId, player.id),
        eq(inboxMessagesTable.isDeleted, false),
      )).limit(1);
      if (!m) return null;
      // Conditional update: only one concurrent request can flip is_read=false → true.
      const flipped = await tx.update(inboxMessagesTable)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(inboxMessagesTable.id, m.id),
          eq(inboxMessagesTable.isRead, false),
        ))
        .returning({ id: inboxMessagesTable.id });
      if (flipped.length > 0) {
        await tx.update(playersTable)
          .set({ unreadInboxCount: sql`GREATEST(0, ${playersTable.unreadInboxCount} - 1)`, updatedAt: new Date() })
          .where(eq(playersTable.id, player.id));
        m.isRead = true;
        m.readAt = new Date();
      }
      return m;
    });

    if (!msg) return void res.status(404).json({ error: "Not found" });
    res.json(serialize(msg));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /inbox/:id/read — explicit mark-as-read
router.post("/inbox/:id/read", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid id" });

    await db.transaction(async (tx) => {
      const flipped = await tx.update(inboxMessagesTable)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(inboxMessagesTable.id, id),
          eq(inboxMessagesTable.playerId, player.id),
          eq(inboxMessagesTable.isDeleted, false),
          eq(inboxMessagesTable.isRead, false),
        ))
        .returning({ id: inboxMessagesTable.id });
      if (flipped.length > 0) {
        await tx.update(playersTable)
          .set({ unreadInboxCount: sql`GREATEST(0, ${playersTable.unreadInboxCount} - 1)`, updatedAt: new Date() })
          .where(eq(playersTable.id, player.id));
      }
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /inbox/mark-all-read
router.post("/inbox/mark-all-read", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    await db.transaction(async (tx) => {
      // Decrement only by the exact number of rows we flipped here. Any concurrent
      // insert (which atomically increments the counter inside sendInboxMessage)
      // will not be zeroed out by this path.
      const flipped = await tx.update(inboxMessagesTable)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(inboxMessagesTable.playerId, player.id),
          eq(inboxMessagesTable.isRead, false),
          eq(inboxMessagesTable.isDeleted, false),
        ))
        .returning({ id: inboxMessagesTable.id });
      if (flipped.length > 0) {
        await tx.update(playersTable)
          .set({
            unreadInboxCount: sql`GREATEST(0, ${playersTable.unreadInboxCount} - ${flipped.length})`,
            updatedAt: new Date(),
          })
          .where(eq(playersTable.id, player.id));
      }
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /inbox/:id/archive — toggle archive
router.post("/inbox/:id/archive", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid id" });

    await db.transaction(async (tx) => {
      const [m] = await tx.select().from(inboxMessagesTable).where(and(
        eq(inboxMessagesTable.id, id),
        eq(inboxMessagesTable.playerId, player.id),
        eq(inboxMessagesTable.isDeleted, false),
      )).limit(1);
      if (!m) return;
      const willArchive = !m.isArchived;
      if (willArchive) {
        // Two-step atomic flip:
        //   1) Try archiving an UNREAD message — wins decrement only if a row was flipped
        //      from is_read=false to is_read=true in the same UPDATE.
        //   2) Otherwise (already read), archive without touching the counter.
        const now = new Date();
        const flippedUnread = await tx.update(inboxMessagesTable)
          .set({ isArchived: true, archivedAt: now, isRead: true, readAt: now })
          .where(and(
            eq(inboxMessagesTable.id, id),
            eq(inboxMessagesTable.isArchived, false),
            eq(inboxMessagesTable.isDeleted, false),
            eq(inboxMessagesTable.isRead, false),
          ))
          .returning({ id: inboxMessagesTable.id });
        if (flippedUnread.length > 0) {
          await tx.update(playersTable)
            .set({ unreadInboxCount: sql`GREATEST(0, ${playersTable.unreadInboxCount} - 1)`, updatedAt: new Date() })
            .where(eq(playersTable.id, player.id));
        } else {
          await tx.update(inboxMessagesTable)
            .set({ isArchived: true, archivedAt: now })
            .where(and(
              eq(inboxMessagesTable.id, id),
              eq(inboxMessagesTable.isArchived, false),
              eq(inboxMessagesTable.isDeleted, false),
            ));
        }
      } else {
        await tx.update(inboxMessagesTable)
          .set({ isArchived: false, archivedAt: null })
          .where(and(
            eq(inboxMessagesTable.id, id),
            eq(inboxMessagesTable.isArchived, true),
          ));
      }
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// DELETE /inbox/:id — soft delete
router.delete("/inbox/:id", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid id" });

    await db.transaction(async (tx) => {
      // Atomic soft-delete; only the request that wins the flip decrements the counter.
      const deleted = await tx.update(inboxMessagesTable)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(and(
          eq(inboxMessagesTable.id, id),
          eq(inboxMessagesTable.playerId, player.id),
          eq(inboxMessagesTable.isDeleted, false),
        ))
        .returning({ wasUnread: inboxMessagesTable.isRead });
      if (deleted.length > 0 && deleted[0].wasUnread === false) {
        await tx.update(playersTable)
          .set({ unreadInboxCount: sql`GREATEST(0, ${playersTable.unreadInboxCount} - 1)`, updatedAt: new Date() })
          .where(eq(playersTable.id, player.id));
      }
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
