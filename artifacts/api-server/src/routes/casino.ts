import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireAlive, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, blackjackSessionsTable, casinoGamesTable, casinoDailyLimitsTable,
  type BlackjackHand, type BlackjackGameData,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";
import { BLACKJACK, recordAdminRevenue } from "../lib/phase1";
import crypto from "crypto";

const router = Router();

function dealCard(): number { return Math.floor(Math.random() * 13) + 1; }

function handValue(hand: BlackjackHand): number {
  let total = 0; let aces = 0;
  for (const c of hand) {
    if (c === 1) { aces++; total += 11; }
    else if (c >= 10) total += 10;
    else total += c;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

async function getDailyLimit(playerId: number, gameType: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db.select().from(casinoDailyLimitsTable)
    .where(and(
      eq(casinoDailyLimitsTable.playerId, playerId),
      eq(casinoDailyLimitsTable.gameType, gameType),
      sql`${casinoDailyLimitsTable.date} = ${today}::date`,
    )).limit(1);
  return row ?? null;
}

async function bumpDailyLimit(playerId: number, gameType: string, betAmount: number) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await getDailyLimit(playerId, gameType);
  if (existing) {
    await db.update(casinoDailyLimitsTable)
      .set({
        gamesPlayed: existing.gamesPlayed + 1,
        totalBet: existing.totalBet + betAmount,
      })
      .where(eq(casinoDailyLimitsTable.id, existing.id));
  } else {
    await db.insert(casinoDailyLimitsTable).values({
      playerId, gameType, gamesPlayed: 1, totalBet: betAmount, date: today,
    });
  }
}

router.get("/casino/blackjack/state", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const [session] = await db.select().from(blackjackSessionsTable)
      .where(eq(blackjackSessionsTable.playerId, player.id)).limit(1);

    const today = await getDailyLimit(player.id, "blackjack");
    const playedToday = today?.gamesPlayed ?? 0;

    return void res.json({
      session: session ? {
        id: session.id,
        betAmount: session.betAmount,
        commission: session.commission,
        effectiveBet: session.effectiveBet,
        playerHand: session.playerHand,
        playerTotal: handValue(session.playerHand),
        dealerVisible: [session.dealerHand[0]],
        status: session.status,
      } : null,
      limits: {
        dailyLimit: BLACKJACK.DAILY_LIMIT,
        playedToday,
        remaining: Math.max(0, BLACKJACK.DAILY_LIMIT - playedToday),
        minBet: BLACKJACK.MIN_BET,
        maxBet: BLACKJACK.MAX_BET,
        commissionPct: BLACKJACK.COMMISSION,
        payoutMultiplier: BLACKJACK.PAYOUT_MULTIPLIER,
      },
      cash: player.money,
    });
  } catch {
    return void res.status(500).json({ error: "Failed to load blackjack state" });
  }
});

router.post("/casino/blackjack/start", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const { betAmount } = req.body as { betAmount?: number };
    if (!betAmount) return void res.status(400).json({ error: "betAmount required" });
    if (betAmount < BLACKJACK.MIN_BET || betAmount > BLACKJACK.MAX_BET) {
      return void res.status(400).json({
        error: `Bet must be between $${BLACKJACK.MIN_BET.toLocaleString()} and $${BLACKJACK.MAX_BET.toLocaleString()}`,
      });
    }
    if (player.money < betAmount) return void res.status(400).json({ error: "Insufficient funds" });

    const today = await getDailyLimit(player.id, "blackjack");
    if ((today?.gamesPlayed ?? 0) >= BLACKJACK.DAILY_LIMIT) {
      return void res.status(429).json({
        error: `Daily limit reached (${BLACKJACK.DAILY_LIMIT} games)`,
      });
    }

    const existing = await db.select({ id: blackjackSessionsTable.id })
      .from(blackjackSessionsTable)
      .where(eq(blackjackSessionsTable.playerId, player.id)).limit(1);
    if (existing.length > 0) {
      return void res.status(409).json({ error: "Finish your current hand first" });
    }

    const commission = Math.floor(betAmount * BLACKJACK.COMMISSION);
    const effectiveBet = betAmount - commission;
    const playerHand: BlackjackHand = [dealCard(), dealCard()];
    const dealerHand: BlackjackHand = [dealCard(), dealCard()];
    const seed = crypto.randomBytes(16).toString("hex");
    const playerTotal = handValue(playerHand);
    const dealerTotal = handValue(dealerHand);
    const naturalPlayer = playerTotal === 21;
    const naturalDealer = dealerTotal === 21;

    // Auto-resolve natural blackjacks on deal.
    if (naturalPlayer || naturalDealer) {
      let outcome: BlackjackGameData["outcome"];
      let payout = 0;
      if (naturalPlayer && !naturalDealer) {
        outcome = "blackjack";
        payout = Math.floor(betAmount * BLACKJACK.PAYOUT_MULTIPLIER * 1.25);
      } else {
        outcome = "lose"; // dealer 21 (push counts as loss per house rules)
      }
      const netProfit = payout - betAmount;
      const data: BlackjackGameData = {
        playerHand, dealerHand, playerTotal, dealerTotal, outcome,
      };
      await db.transaction(async (tx) => {
        const deducted = await tx.update(playersTable)
          .set({ money: sql`${playersTable.money} - ${betAmount}`, updatedAt: new Date() })
          .where(and(eq(playersTable.id, player.id), sql`${playersTable.money} >= ${betAmount}`))
          .returning({ id: playersTable.id });
        if (deducted.length === 0) throw new Error("INSUFFICIENT_FUNDS");
        if (payout > 0) {
          await tx.update(playersTable)
            .set({ money: sql`${playersTable.money} + ${payout}`, updatedAt: new Date() })
            .where(eq(playersTable.id, player.id));
        }
        await tx.insert(casinoGamesTable).values({
          playerId: player.id, gameType: "blackjack",
          betAmount, commission, effectiveBet,
          result: payout > 0 ? "win" : "lose",
          payout, netProfit, gameData: data, playerIp: req.ip ?? null,
        });
      });
      await bumpDailyLimit(player.id, "blackjack", betAmount);
      await recordAdminRevenue("casino_blackjack_commission", commission,
        `Commission from ${player.username} on $${betAmount} natural`);
      await logActivity(player.id, payout > 0 ? "casino_win" : "casino_lose",
        `Blackjack natural ${outcome.toUpperCase()} — ${netProfit >= 0 ? "+" : ""}$${netProfit.toLocaleString()}`);
      return void res.json({
        sessionId: null, betAmount, commission, effectiveBet,
        playerHand, playerTotal, dealerHand, dealerTotal,
        outcome, payout, netProfit, status: "resolved",
      });
    }

    let session: typeof blackjackSessionsTable.$inferSelect | undefined;
    await db.transaction(async (tx) => {
      const deducted = await tx.update(playersTable)
        .set({ money: sql`${playersTable.money} - ${betAmount}`, updatedAt: new Date() })
        .where(and(eq(playersTable.id, player.id), sql`${playersTable.money} >= ${betAmount}`))
        .returning({ id: playersTable.id });
      if (deducted.length === 0) throw new Error("INSUFFICIENT_FUNDS");

      const [s] = await tx.insert(blackjackSessionsTable).values({
        playerId: player.id, betAmount, commission, effectiveBet,
        playerHand, dealerHand, deckSeed: seed, status: "active",
      }).returning();
      session = s;
    });

    await recordAdminRevenue("casino_blackjack_commission", commission,
      `Commission from ${player.username} on $${betAmount} bet`);

    return void res.json({
      sessionId: session!.id,
      betAmount, commission, effectiveBet,
      playerHand, playerTotal,
      dealerVisible: [dealerHand[0]],
      status: "active",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INSUFFICIENT_FUNDS") return void res.status(400).json({ error: "Insufficient funds" });
    return void res.status(500).json({ error: "Failed to start blackjack" });
  }
});

router.post("/casino/blackjack/hit", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    // Lock the session row to serialize concurrent hit/stand calls.
    const result = await db.transaction(async (tx) => {
      const locked = await tx.select().from(blackjackSessionsTable)
        .where(eq(blackjackSessionsTable.playerId, player.id))
        .for("update").limit(1);
      const session = locked[0];
      if (!session) return { kind: "no-session" as const };

      const newHand: BlackjackHand = [...session.playerHand, dealCard()];
      const total = handValue(newHand);

      if (total > 21) {
        const data: BlackjackGameData = {
          playerHand: newHand, dealerHand: session.dealerHand,
          playerTotal: total, dealerTotal: handValue(session.dealerHand),
          outcome: "bust",
        };
        await tx.delete(blackjackSessionsTable).where(eq(blackjackSessionsTable.id, session.id));
        await tx.insert(casinoGamesTable).values({
          playerId: player.id, gameType: "blackjack",
          betAmount: session.betAmount, commission: session.commission, effectiveBet: session.effectiveBet,
          result: "lose", payout: 0, netProfit: -session.betAmount,
          gameData: data, playerIp: req.ip ?? null,
        });
        return { kind: "bust" as const, session, newHand, total };
      }

      await tx.update(blackjackSessionsTable)
        .set({ playerHand: newHand })
        .where(eq(blackjackSessionsTable.id, session.id));
      return { kind: "continue" as const, session, newHand, total };
    });

    if (result.kind === "no-session") {
      return void res.status(404).json({ error: "No active session" });
    }
    if (result.kind === "bust") {
      await bumpDailyLimit(player.id, "blackjack", result.session.betAmount);
      await logActivity(player.id, "casino_lose",
        `Blackjack BUST at ${result.total} — lost $${result.session.betAmount.toLocaleString()}`);
      return void res.json({
        playerHand: result.newHand, playerTotal: result.total,
        dealerHand: result.session.dealerHand,
        dealerTotal: handValue(result.session.dealerHand),
        outcome: "bust", payout: 0,
        netProfit: -result.session.betAmount,
      });
    }
    return void res.json({
      playerHand: result.newHand, playerTotal: result.total,
      dealerVisible: [result.session.dealerHand[0]], status: "active",
    });
  } catch {
    return void res.status(500).json({ error: "Failed to hit" });
  }
});

router.post("/casino/blackjack/stand", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const result = await db.transaction(async (tx) => {
      const locked = await tx.select().from(blackjackSessionsTable)
        .where(eq(blackjackSessionsTable.playerId, player.id))
        .for("update").limit(1);
      const session = locked[0];
      if (!session) return null;

      const dealer: BlackjackHand = [...session.dealerHand];
      while (handValue(dealer) < 17) dealer.push(dealCard());

      const playerTotal = handValue(session.playerHand);
      const dealerTotal = handValue(dealer);

      let outcome: BlackjackGameData["outcome"];
      let payout = 0;
      if (dealerTotal > 21) {
        outcome = "win"; payout = Math.floor(session.betAmount * BLACKJACK.PAYOUT_MULTIPLIER);
      } else if (playerTotal > dealerTotal) {
        outcome = "win"; payout = Math.floor(session.betAmount * BLACKJACK.PAYOUT_MULTIPLIER);
      } else if (playerTotal === 21 && session.playerHand.length === 2) {
        outcome = "blackjack"; payout = Math.floor(session.betAmount * BLACKJACK.PAYOUT_MULTIPLIER * 1.25);
      } else {
        outcome = "lose"; payout = 0; // tie = dealer wins (per spec)
      }

      const netProfit = payout - session.betAmount;
      const data: BlackjackGameData = {
        playerHand: session.playerHand, dealerHand: dealer,
        playerTotal, dealerTotal, outcome,
      };

      await tx.delete(blackjackSessionsTable).where(eq(blackjackSessionsTable.id, session.id));
      if (payout > 0) {
        await tx.update(playersTable)
          .set({ money: sql`${playersTable.money} + ${payout}`, updatedAt: new Date() })
          .where(eq(playersTable.id, player.id));
      }
      await tx.insert(casinoGamesTable).values({
        playerId: player.id, gameType: "blackjack",
        betAmount: session.betAmount, commission: session.commission, effectiveBet: session.effectiveBet,
        result: payout > 0 ? "win" : "lose",
        payout, netProfit, gameData: data, playerIp: req.ip ?? null,
      });
      return { session, dealer, playerTotal, dealerTotal, outcome, payout, netProfit };
    });

    if (!result) return void res.status(404).json({ error: "No active session" });
    await bumpDailyLimit(player.id, "blackjack", result.session.betAmount);
    await logActivity(player.id,
      result.netProfit > 0 ? "casino_win" : "casino_lose",
      `Blackjack ${result.outcome.toUpperCase()} (${result.playerTotal} vs ${result.dealerTotal}) — ${result.netProfit >= 0 ? "+" : ""}$${result.netProfit.toLocaleString()}`,
    );
    return void res.json({
      playerHand: result.session.playerHand, playerTotal: result.playerTotal,
      dealerHand: result.dealer, dealerTotal: result.dealerTotal,
      outcome: result.outcome, payout: result.payout, netProfit: result.netProfit,
    });
  } catch {
    return void res.status(500).json({ error: "Failed to stand" });
  }
});

export default router;
