import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireAlive, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  chatMessagesTable,
  playersTable,
  type ChatChannel,
} from "@workspace/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import {
  CHAT_HISTORY_LIMIT_CITY_PRIVATE,
  CHAT_HISTORY_LIMIT_GLOBAL_GANG,
  checkChatRestriction,
  consumeRateLimit,
  sanitizeBody,
} from "../lib/chat";
import { createNotification } from "../lib/notifications";

const router = Router();

type SerializedMessage = {
  id: number;
  channel: ChatChannel;
  body: string;
  senderId: number;
  senderUsername: string;
  senderLevel: number;
  senderGangId: number | null;
  senderGangName: string | null;
  senderGangRank: string | null;
  recipientId: number | null;
  recipientUsername: string | null;
  createdAt: string;
};

async function loadMessages(rows: { id: number; channel: ChatChannel; body: string; senderId: number; recipientId: number | null; createdAt: Date }[]): Promise<SerializedMessage[]> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set([
    ...rows.map(r => r.senderId),
    ...rows.map(r => r.recipientId).filter((x): x is number => x !== null),
  ]));
  const players = await db
    .select({ id: playersTable.id, username: playersTable.username, level: playersTable.level, gangId: playersTable.gangId, gangRank: playersTable.gangRank })
    .from(playersTable)
    .where(or(...ids.map(id => eq(playersTable.id, id))));
  const pmap = new Map(players.map(p => [p.id, p]));
  const gangIds = Array.from(new Set(players.map(p => p.gangId).filter((x): x is number => !!x)));
  const gangNameMap = new Map<number, string>();
  if (gangIds.length > 0) {
    // Reuse the gangs table via the players join is overkill — small lookup.
    const { gangsTable } = await import("@workspace/db/schema");
    const gangs = await db.select({ id: gangsTable.id, name: gangsTable.name })
      .from(gangsTable)
      .where(or(...gangIds.map(id => eq(gangsTable.id, id))));
    gangs.forEach(g => gangNameMap.set(g.id, g.name));
  }

  return rows.map(r => {
    const sender = pmap.get(r.senderId);
    const recipient = r.recipientId ? pmap.get(r.recipientId) : undefined;
    return {
      id: r.id,
      channel: r.channel,
      body: r.body,
      senderId: r.senderId,
      senderUsername: sender?.username ?? "Unknown",
      senderLevel: sender?.level ?? 1,
      senderGangId: sender?.gangId ?? null,
      senderGangName: sender?.gangId ? (gangNameMap.get(sender.gangId) ?? null) : null,
      senderGangRank: sender?.gangRank ?? null,
      recipientId: r.recipientId,
      recipientUsername: recipient?.username ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

// ── GLOBAL ────────────────────────────────────────────────────────────────────
router.get("/chat/global", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select({
      id: chatMessagesTable.id, channel: chatMessagesTable.channel, body: chatMessagesTable.body,
      senderId: chatMessagesTable.senderId, recipientId: chatMessagesTable.recipientId,
      createdAt: chatMessagesTable.createdAt,
    })
      .from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.channel, "global"), eq(chatMessagesTable.deleted, false)))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(CHAT_HISTORY_LIMIT_GLOBAL_GANG);
    const messages = (await loadMessages(rows)).reverse();
    return void res.json({ messages });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

router.post("/chat/global", requireAuth, requireAlive, async (req, res) => {
  try {
    const player = await getOrCreatePlayer(getCurrentClerkId(req));
    const body = sanitizeBody((req.body as { body?: unknown })?.body);
    if (!body) return void res.status(400).json({ error: "Message must be 1-500 characters." });
    const r = await checkChatRestriction(player.id, "global");
    if (r.blocked) return void res.status(403).json({ error: r.reason ?? "You are restricted from this channel.", code: "RESTRICTED" });
    if (!await consumeRateLimit(player.id)) return void res.status(429).json({ error: "You are sending messages too fast. Slow down.", code: "RATE_LIMIT" });
    const [created] = await db.insert(chatMessagesTable).values({
      channel: "global", senderId: player.id, body,
    }).returning();
    await db.update(playersTable).set({ lastMessageAt: new Date() }).where(eq(playersTable.id, player.id));
    return void res.status(201).json({ id: created.id });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

// ── GANG ──────────────────────────────────────────────────────────────────────
router.get("/chat/gang", requireAuth, async (req, res) => {
  try {
    const player = await getOrCreatePlayer(getCurrentClerkId(req));
    if (!player.gangId) return void res.json({ messages: [] });
    const rows = await db.select({
      id: chatMessagesTable.id, channel: chatMessagesTable.channel, body: chatMessagesTable.body,
      senderId: chatMessagesTable.senderId, recipientId: chatMessagesTable.recipientId,
      createdAt: chatMessagesTable.createdAt,
    })
      .from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.channel, "gang"),
        eq(chatMessagesTable.gangId, player.gangId),
        eq(chatMessagesTable.deleted, false),
      ))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(CHAT_HISTORY_LIMIT_GLOBAL_GANG);
    const messages = (await loadMessages(rows)).reverse();
    return void res.json({ messages });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

router.post("/chat/gang", requireAuth, requireAlive, async (req, res) => {
  try {
    const player = await getOrCreatePlayer(getCurrentClerkId(req));
    if (!player.gangId) return void res.status(403).json({ error: "You must be in a gang to use gang chat.", code: "NO_GANG" });
    const body = sanitizeBody((req.body as { body?: unknown })?.body);
    if (!body) return void res.status(400).json({ error: "Message must be 1-500 characters." });
    const r = await checkChatRestriction(player.id, "gang");
    if (r.blocked) return void res.status(403).json({ error: r.reason ?? "You are restricted from this channel.", code: "RESTRICTED" });
    if (!await consumeRateLimit(player.id)) return void res.status(429).json({ error: "You are sending messages too fast. Slow down.", code: "RATE_LIMIT" });
    const [created] = await db.insert(chatMessagesTable).values({
      channel: "gang", senderId: player.id, gangId: player.gangId, body,
    }).returning();
    await db.update(playersTable).set({ lastMessageAt: new Date() }).where(eq(playersTable.id, player.id));
    return void res.status(201).json({ id: created.id });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

// ── CITY ──────────────────────────────────────────────────────────────────────
router.get("/chat/city", requireAuth, async (req, res) => {
  try {
    const player = await getOrCreatePlayer(getCurrentClerkId(req));
    const rows = await db.select({
      id: chatMessagesTable.id, channel: chatMessagesTable.channel, body: chatMessagesTable.body,
      senderId: chatMessagesTable.senderId, recipientId: chatMessagesTable.recipientId,
      createdAt: chatMessagesTable.createdAt,
    })
      .from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.channel, "city"),
        eq(chatMessagesTable.cityId, player.cityId),
        eq(chatMessagesTable.deleted, false),
      ))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(CHAT_HISTORY_LIMIT_CITY_PRIVATE);
    const messages = (await loadMessages(rows)).reverse();
    return void res.json({ messages });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

router.post("/chat/city", requireAuth, requireAlive, async (req, res) => {
  try {
    const player = await getOrCreatePlayer(getCurrentClerkId(req));
    const body = sanitizeBody((req.body as { body?: unknown })?.body);
    if (!body) return void res.status(400).json({ error: "Message must be 1-500 characters." });
    const r = await checkChatRestriction(player.id, "city");
    if (r.blocked) return void res.status(403).json({ error: r.reason ?? "You are restricted from this channel.", code: "RESTRICTED" });
    if (!await consumeRateLimit(player.id)) return void res.status(429).json({ error: "You are sending messages too fast. Slow down.", code: "RATE_LIMIT" });
    const [created] = await db.insert(chatMessagesTable).values({
      channel: "city", senderId: player.id, cityId: player.cityId, body,
    }).returning();
    await db.update(playersTable).set({ lastMessageAt: new Date() }).where(eq(playersTable.id, player.id));
    return void res.status(201).json({ id: created.id });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

// ── PRIVATE ───────────────────────────────────────────────────────────────────
router.get("/chat/private/:playerId", requireAuth, async (req, res) => {
  try {
    const viewer = await getOrCreatePlayer(getCurrentClerkId(req));
    const otherId = parseInt(String(req.params.playerId));
    if (!Number.isFinite(otherId) || otherId === viewer.id) {
      return void res.status(400).json({ error: "Invalid player id" });
    }
    const rows = await db.select({
      id: chatMessagesTable.id, channel: chatMessagesTable.channel, body: chatMessagesTable.body,
      senderId: chatMessagesTable.senderId, recipientId: chatMessagesTable.recipientId,
      createdAt: chatMessagesTable.createdAt,
    })
      .from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.channel, "private"),
        eq(chatMessagesTable.deleted, false),
        or(
          and(eq(chatMessagesTable.senderId, viewer.id), eq(chatMessagesTable.recipientId, otherId)),
          and(eq(chatMessagesTable.senderId, otherId), eq(chatMessagesTable.recipientId, viewer.id)),
        ),
      ))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(CHAT_HISTORY_LIMIT_CITY_PRIVATE);
    const messages = (await loadMessages(rows)).reverse();
    const otherRows = await db.select({ id: playersTable.id, username: playersTable.username })
      .from(playersTable).where(eq(playersTable.id, otherId)).limit(1);
    return void res.json({ messages, partner: otherRows[0] ?? null });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

router.post("/chat/private/:playerId", requireAuth, requireAlive, async (req, res) => {
  try {
    const sender = await getOrCreatePlayer(getCurrentClerkId(req));
    const recipientId = parseInt(String(req.params.playerId));
    if (!Number.isFinite(recipientId) || recipientId === sender.id) {
      return void res.status(400).json({ error: "Invalid recipient" });
    }
    const recipientRows = await db.select({ id: playersTable.id, username: playersTable.username })
      .from(playersTable).where(eq(playersTable.id, recipientId)).limit(1);
    if (!recipientRows[0]) return void res.status(404).json({ error: "Recipient not found" });

    const body = sanitizeBody((req.body as { body?: unknown })?.body);
    if (!body) return void res.status(400).json({ error: "Message must be 1-500 characters." });
    const r = await checkChatRestriction(sender.id, "private");
    if (r.blocked) return void res.status(403).json({ error: r.reason ?? "You are restricted from this channel.", code: "RESTRICTED" });
    if (!await consumeRateLimit(sender.id)) return void res.status(429).json({ error: "You are sending messages too fast. Slow down.", code: "RATE_LIMIT" });

    const [created] = await db.insert(chatMessagesTable).values({
      channel: "private", senderId: sender.id, recipientId, body,
    }).returning();
    await db.update(playersTable).set({ lastMessageAt: new Date() }).where(eq(playersTable.id, sender.id));

    await createNotification(
      recipientId,
      "private_message",
      `💬 New message from ${sender.username}`,
      `/chat/private/${sender.id}`,
    );

    return void res.status(201).json({ id: created.id });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

// ── DELETE (sender or super-admin via separate route) ─────────────────────────
router.delete("/chat/:messageId", requireAuth, async (req, res) => {
  try {
    const viewer = await getOrCreatePlayer(getCurrentClerkId(req));
    const messageId = parseInt(String(req.params.messageId));
    if (!Number.isFinite(messageId)) return void res.status(400).json({ error: "Invalid message id" });
    const result = await db.update(chatMessagesTable)
      .set({ deleted: true })
      .where(and(
        eq(chatMessagesTable.id, messageId),
        eq(chatMessagesTable.senderId, viewer.id),
        eq(chatMessagesTable.deleted, false),
      ))
      .returning({ id: chatMessagesTable.id });
    if (result.length === 0) return void res.status(403).json({ error: "You can only delete your own messages." });
    return void res.json({ ok: true });
  } catch (e) { return void res.status(500).json({ error: String(e) }); }
});

export default router;
