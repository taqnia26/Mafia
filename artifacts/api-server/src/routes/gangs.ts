import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import { gangsTable, playersTable } from "@workspace/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router = Router();

router.get("/gangs", requireAuth, async (req, res) => {
  try {
    const gangs = await db.select().from(gangsTable).orderBy(desc(gangsTable.treasury));
    const result = await Promise.all(gangs.map(async (gang) => {
      const members = await db.select({ count: count() }).from(playersTable).where(eq(playersTable.gangId, gang.id));
      const boss = await db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, gang.bossId)).limit(1);
      return {
        ...gang,
        memberCount: members[0]?.count ?? 0,
        bossName: boss[0]?.username ?? "Unknown",
        createdAt: gang.createdAt.toISOString(),
      };
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/gangs", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    if (player.gangId) return res.status(400).json({ error: "Already in a gang" });

    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const [gang] = await db.insert(gangsTable).values({
      name,
      description: description ?? "",
      bossId: player.id,
      treasury: 0,
    }).returning();

    await db.update(playersTable)
      .set({ gangId: gang.id, gangRank: "Boss", updatedAt: new Date() })
      .where(eq(playersTable.id, player.id));

    await logActivity(player.id, "joined_gang", `Created gang "${name}"`);

    const boss = await db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, gang.bossId)).limit(1);
    res.status(201).json({
      ...gang,
      memberCount: 1,
      bossName: boss[0]?.username ?? player.username,
      createdAt: gang.createdAt.toISOString(),
    });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(400).json({ error: "Gang name already taken" });
    res.status(500).json({ error: String(e) });
  }
});

router.get("/gangs/:gangId", requireAuth, async (req, res) => {
  try {
    const gangId = parseInt(req.params.gangId);
    const gangs = await db.select().from(gangsTable).where(eq(gangsTable.id, gangId)).limit(1);
    if (!gangs[0]) return res.status(404).json({ error: "Gang not found" });
    const gang = gangs[0];
    const [members, boss] = await Promise.all([
      db.select({ count: count() }).from(playersTable).where(eq(playersTable.gangId, gangId)),
      db.select({ username: playersTable.username }).from(playersTable).where(eq(playersTable.id, gang.bossId)).limit(1),
    ]);
    res.json({
      ...gang,
      memberCount: members[0]?.count ?? 0,
      bossName: boss[0]?.username ?? "Unknown",
      createdAt: gang.createdAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/gangs/:gangId/join", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    if (player.gangId) return res.status(400).json({ error: "Already in a gang" });

    const gangId = parseInt(req.params.gangId);
    const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, gangId)).limit(1);
    if (!gang[0]) return res.status(404).json({ error: "Gang not found" });

    await db.update(playersTable).set({ gangId, gangRank: "Soldier", updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    await logActivity(player.id, "joined_gang", `Joined gang "${gang[0].name}"`);

    res.json({ id: player.id, playerId: player.id, username: player.username, level: player.level, rank: "Soldier", joinedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/gangs/me/leave", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    if (!player.gangId) return res.status(400).json({ error: "Not in a gang" });
    if (player.gangRank === "Boss") return res.status(400).json({ error: "Boss cannot leave. Promote someone first." });

    const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, player.gangId)).limit(1);
    await db.update(playersTable).set({ gangId: null, gangRank: null, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    await logActivity(player.id, "left_gang", `Left gang "${gang[0]?.name ?? ""}"`);

    res.json({ message: "Left gang successfully" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/gangs/:gangId/members", requireAuth, async (req, res) => {
  try {
    const gangId = parseInt(req.params.gangId);
    const members = await db.select({
      id: playersTable.id,
      playerId: playersTable.id,
      username: playersTable.username,
      level: playersTable.level,
      rank: playersTable.gangRank,
      joinedAt: playersTable.updatedAt,
    })
      .from(playersTable)
      .where(eq(playersTable.gangId, gangId));

    res.json(members.map(m => ({
      ...m,
      rank: m.rank ?? "Soldier",
      joinedAt: m.joinedAt.toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/gangs/:gangId/members/:memberId/promote", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const gangId = parseInt(req.params.gangId);
    const memberId = parseInt(req.params.memberId);

    if (player.gangId !== gangId) return res.status(403).json({ error: "Not in this gang" });
    if (!["Boss", "Consigliere", "Underboss"].includes(player.gangRank ?? "")) {
      return res.status(403).json({ error: "Insufficient rank to promote" });
    }

    const { rank } = req.body;
    const validRanks = ["Soldier", "Capo", "Underboss", "Consigliere", "Boss"];
    if (!validRanks.includes(rank)) return res.status(400).json({ error: "Invalid rank" });

    const [member] = await db.update(playersTable)
      .set({ gangRank: rank as any, updatedAt: new Date() })
      .where(eq(playersTable.id, memberId))
      .returning();

    if (!member) return res.status(404).json({ error: "Member not found" });

    res.json({
      id: member.id,
      playerId: member.id,
      username: member.username,
      level: member.level,
      rank: member.gangRank ?? "Soldier",
      joinedAt: member.updatedAt.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/gangs/:gangId/deposit", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const gangId = parseInt(req.params.gangId);
    const { amount } = req.body;

    if (player.gangId !== gangId) return res.status(403).json({ error: "Not in this gang" });
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (player.money < amount) return res.status(400).json({ error: "Insufficient funds" });

    await db.update(playersTable).set({ money: player.money - amount, updatedAt: new Date() }).where(eq(playersTable.id, player.id));
    const gang = await db.select().from(gangsTable).where(eq(gangsTable.id, gangId)).limit(1);
    await db.update(gangsTable).set({ treasury: (gang[0]?.treasury ?? 0) + amount }).where(eq(gangsTable.id, gangId));

    res.json({ message: `Deposited $${amount} to treasury` });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
