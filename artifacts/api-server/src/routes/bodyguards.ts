import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  npcBodyguardsTable, playerNpcGuardsTable, bodyguardRequestsTable,
  playerGuardsTable, playersTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";
type BodyguardRequest = typeof import("@workspace/db/schema").bodyguardRequestsTable.$inferSelect;

const router = Router();

async function formatRequest(r: BodyguardRequest) {
  const from = await db.select({ username: playersTable.username })
    .from(playersTable)
    .where(eq(playersTable.id, r.fromPlayerId))
    .limit(1);
  const to = await db.select({ username: playersTable.username })
    .from(playersTable)
    .where(eq(playersTable.id, r.toPlayerId))
    .limit(1);
  return {
    ...r,
    fromUsername: from[0]?.username ?? "Unknown",
    toUsername: to[0]?.username ?? "Unknown",
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/bodyguards/npc", requireAuth, async (req, res) => {
  try {
    const guards = await db.select().from(npcBodyguardsTable);
    res.json(guards);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/bodyguards/npc/:guardId/hire", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const guardId = parseInt(String(req.params.guardId));

    const guard = await db.select().from(npcBodyguardsTable).where(eq(npcBodyguardsTable.id, guardId)).limit(1);
    if (!guard[0]) return void res.status(404).json({ error: "Guard not found" });

    if (player.money < guard[0].hirePrice) return void res.status(400).json({ error: "Insufficient funds" });

    await db.transaction(async (tx) => {
      await tx.update(playersTable)
        .set({
          money: sql`${playersTable.money} - ${guard[0].hirePrice}`,
          defensePower: sql`${playersTable.defensePower} + ${guard[0].defensePower}`,
          updatedAt: new Date(),
        })
        .where(eq(playersTable.id, player.id));
      await tx.insert(playerNpcGuardsTable).values({ playerId: player.id, npcGuardId: guardId });
    });

    await logActivity(player.id, "bodyguard_hired", `Hired NPC guard "${guard[0].name}"`);

    res.json({ message: `Hired ${guard[0].name} successfully` });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/bodyguards/requests", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const [sent, received] = await Promise.all([
      db.select().from(bodyguardRequestsTable).where(eq(bodyguardRequestsTable.fromPlayerId, player.id)),
      db.select().from(bodyguardRequestsTable).where(eq(bodyguardRequestsTable.toPlayerId, player.id)),
    ]);

    const [sentFormatted, receivedFormatted] = await Promise.all([
      Promise.all(sent.map(formatRequest)),
      Promise.all(received.map(formatRequest)),
    ]);

    res.json({ sent: sentFormatted, received: receivedFormatted });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/bodyguards/request", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const { targetPlayerId, offeredMoney } = req.body as { targetPlayerId: number; offeredMoney?: number };

    const [request] = await db.insert(bodyguardRequestsTable).values({
      fromPlayerId: player.id,
      toPlayerId: targetPlayerId,
      offeredMoney: offeredMoney ?? 0,
      status: "pending",
    }).returning();

    const [from, to] = await Promise.all([
      db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, player.id)).limit(1),
      db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, targetPlayerId)).limit(1),
    ]);

    res.status(201).json({
      ...request,
      fromUsername: from[0]?.username ?? "Unknown",
      toUsername: to[0]?.username ?? "Unknown",
      createdAt: request.createdAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/bodyguards/requests/:requestId/respond", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const requestId = parseInt(String(req.params.requestId));
    const { accept } = req.body as { accept: boolean };

    const request = await db.select().from(bodyguardRequestsTable).where(eq(bodyguardRequestsTable.id, requestId)).limit(1);
    if (!request[0]) return void res.status(404).json({ error: "Request not found" });
    if (request[0].toPlayerId !== player.id) return void res.status(403).json({ error: "Not your request" });

    const status = accept ? "accepted" : "rejected";
    await db.update(bodyguardRequestsTable).set({ status }).where(eq(bodyguardRequestsTable.id, requestId));

    if (accept) {
      await db.insert(playerGuardsTable).values({
        protectedPlayerId: request[0].fromPlayerId,
        guardPlayerId: player.id,
      });
      if (request[0].offeredMoney > 0) {
        const requester = await db.select().from(playersTable).where(eq(playersTable.id, request[0].fromPlayerId)).limit(1);
        if (requester[0] && requester[0].money >= request[0].offeredMoney) {
          await db.transaction(async (tx) => {
            await tx.update(playersTable)
              .set({ money: sql`${playersTable.money} - ${request[0].offeredMoney}`, updatedAt: new Date() })
              .where(eq(playersTable.id, requester[0].id));
            await tx.update(playersTable)
              .set({ money: sql`${playersTable.money} + ${request[0].offeredMoney}`, updatedAt: new Date() })
              .where(eq(playersTable.id, player.id));
          });
        }
      }
    }

    res.json({ message: accept ? "Accepted bodyguard request" : "Rejected bodyguard request" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/bodyguards/my", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const [npcGuards, playerGuards] = await Promise.all([
      db.select({
        id: playerNpcGuardsTable.id,
        npcGuardId: playerNpcGuardsTable.npcGuardId,
        hiredAt: playerNpcGuardsTable.hiredAt,
        npcName: npcBodyguardsTable.name,
        tier: npcBodyguardsTable.tier,
        defensePower: npcBodyguardsTable.defensePower,
      })
        .from(playerNpcGuardsTable)
        .leftJoin(npcBodyguardsTable, eq(playerNpcGuardsTable.npcGuardId, npcBodyguardsTable.id))
        .where(eq(playerNpcGuardsTable.playerId, player.id)),
      db.select({
        id: playerGuardsTable.id,
        guardPlayerId: playerGuardsTable.guardPlayerId,
        startedAt: playerGuardsTable.startedAt,
        guardUsername: playersTable.username,
        level: playersTable.level,
        defensePower: playersTable.defensePower,
      })
        .from(playerGuardsTable)
        .leftJoin(playersTable, eq(playerGuardsTable.guardPlayerId, playersTable.id))
        .where(eq(playerGuardsTable.protectedPlayerId, player.id)),
    ]);

    res.json({
      npcGuards: npcGuards.map(g => ({
        id: g.id,
        npcName: g.npcName ?? "Unknown",
        tier: g.tier ?? "basic",
        defensePower: g.defensePower ?? 0,
        hiredAt: g.hiredAt?.toISOString() ?? new Date().toISOString(),
      })),
      playerGuards: playerGuards.map(g => ({
        id: g.id,
        guardPlayerId: g.guardPlayerId ?? 0,
        guardUsername: g.guardUsername ?? "Unknown",
        level: g.level ?? 1,
        defensePower: g.defensePower ?? 0,
        startedAt: g.startedAt?.toISOString() ?? new Date().toISOString(),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/bodyguards/:bodyguardId/dismiss", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const bodyguardId = parseInt(String(req.params.bodyguardId));

    const npcGuard = await db.select().from(playerNpcGuardsTable)
      .where(and(eq(playerNpcGuardsTable.id, bodyguardId), eq(playerNpcGuardsTable.playerId, player.id)))
      .limit(1);

    if (npcGuard[0]) {
      const guard = await db.select().from(npcBodyguardsTable).where(eq(npcBodyguardsTable.id, npcGuard[0].npcGuardId)).limit(1);
      await db.delete(playerNpcGuardsTable).where(eq(playerNpcGuardsTable.id, bodyguardId));
      if (guard[0]) {
        await db.update(playersTable)
          .set({
            defensePower: sql`GREATEST(10, ${playersTable.defensePower} - ${guard[0].defensePower})`,
            updatedAt: new Date(),
          })
          .where(eq(playersTable.id, player.id));
      }
      return void res.json({ message: "Guard dismissed" });
    }

    const playerGuard = await db.select().from(playerGuardsTable)
      .where(and(eq(playerGuardsTable.id, bodyguardId), eq(playerGuardsTable.protectedPlayerId, player.id)))
      .limit(1);

    if (playerGuard[0]) {
      await db.delete(playerGuardsTable).where(eq(playerGuardsTable.id, bodyguardId));
      return void res.json({ message: "Guard dismissed" });
    }

    res.status(404).json({ error: "Guard not found" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
