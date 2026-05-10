import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireAlive, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, bankLoansTable, bankTransactionsTable, playerPropertiesTable,
} from "@workspace/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";
import { BANK_CONFIG, loanTotalDue, applyHourlyInterest } from "../lib/bank";

const router = Router();

async function computeCreditLimit(playerId: number, playerLevel: number): Promise<number> {
  const [propCount] = await db.select({ cnt: count() })
    .from(playerPropertiesTable)
    .where(eq(playerPropertiesTable.playerId, playerId));
  const properties = Number(propCount?.cnt ?? 0);
  const raw = playerLevel * BANK_CONFIG.CREDIT_LEVEL_MULT + properties * BANK_CONFIG.CREDIT_PROPERTY_MULT;
  return Math.max(BANK_CONFIG.CREDIT_MINIMUM, raw);
}

async function getOutstandingLoanTotal(playerId: number): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(${bankLoansTable.remaining}), 0)` })
    .from(bankLoansTable)
    .where(and(eq(bankLoansTable.playerId, playerId), eq(bankLoansTable.status, "active")));
  return Number(rows[0]?.total ?? 0);
}

router.get("/bank/me", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const loans = await db.select().from(bankLoansTable)
      .where(and(eq(bankLoansTable.playerId, player.id), eq(bankLoansTable.status, "active")))
      .orderBy(desc(bankLoansTable.takenAt));

    const creditLimit = await computeCreditLimit(player.id, player.level);
    const outstanding = await getOutstandingLoanTotal(player.id);
    const availableCredit = Math.max(0, creditLimit - outstanding);

    // Preview accrued-but-not-yet-applied interest since last worker tick.
    const last = player.lastBankInterestAt;
    const elapsedMs = last ? Date.now() - last.getTime() : 0;
    const fullHours = Math.min(BANK_CONFIG.MAX_INTEREST_CATCHUP_HOURS, Math.floor(elapsedMs / 3600000));
    const accruedInterest = fullHours > 0
      ? applyHourlyInterest(player.bankBalance, fullHours).interest
      : 0;
    const nextInterestAt = last
      ? new Date(last.getTime() + 3600000).toISOString()
      : null;

    return void res.json({
      bankBalance: player.bankBalance,
      cash: player.money,
      interestRatePerHour: 0.1,
      accruedInterest,
      nextInterestAt,
      loans: loans.map(l => ({
        id: l.id,
        principal: l.principal,
        remaining: l.remaining,
        interestRate: l.interestRate,
        takenAt: l.takenAt.toISOString(),
        dueAt: l.dueAt.toISOString(),
        status: l.status,
        isOverdue: l.dueAt.getTime() <= Date.now(),
      })),
      creditLimit,
      outstandingLoanTotal: outstanding,
      availableCredit,
      loanTermDays: BANK_CONFIG.LOAN_TERM_DAYS,
      loanInterestPercent: BANK_CONFIG.LOAN_INTEREST_PERCENT,
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/bank/deposit", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const amount = Math.floor(Number((req.body as { amount?: unknown })?.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return void res.status(400).json({ error: "Amount must be a positive integer." });
    }
    if (player.money < amount) {
      return void res.status(400).json({ error: "Insufficient cash." });
    }

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(playersTable).set({
        money: sql`${playersTable.money} - ${amount}`,
        bankBalance: sql`${playersTable.bankBalance} + ${amount}`,
        updatedAt: new Date(),
      }).where(and(eq(playersTable.id, player.id), sql`${playersTable.money} >= ${amount}`))
        .returning({ money: playersTable.money, bankBalance: playersTable.bankBalance });
      if (!updated) throw new Error("INSUFFICIENT_FUNDS");
      await tx.insert(bankTransactionsTable).values({
        playerId: player.id, type: "deposit", amount, balanceAfter: updated.bankBalance,
      });
      return updated;
    });

    await logActivity(player.id, "bank_deposit", `Deposited $${amount.toLocaleString()} into the bank`);
    return void res.json({ success: true, cash: result.money, bankBalance: result.bankBalance });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "INSUFFICIENT_FUNDS") return void res.status(400).json({ error: "Insufficient cash." });
    return void res.status(500).json({ error: msg });
  }
});

router.post("/bank/withdraw", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const amount = Math.floor(Number((req.body as { amount?: unknown })?.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return void res.status(400).json({ error: "Amount must be a positive integer." });
    }
    if (player.bankBalance < amount) {
      return void res.status(400).json({ error: "Insufficient bank balance." });
    }

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(playersTable).set({
        money: sql`${playersTable.money} + ${amount}`,
        bankBalance: sql`${playersTable.bankBalance} - ${amount}`,
        updatedAt: new Date(),
      }).where(and(eq(playersTable.id, player.id), sql`${playersTable.bankBalance} >= ${amount}`))
        .returning({ money: playersTable.money, bankBalance: playersTable.bankBalance });
      if (!updated) throw new Error("INSUFFICIENT_BANK");
      await tx.insert(bankTransactionsTable).values({
        playerId: player.id, type: "withdraw", amount, balanceAfter: updated.bankBalance,
      });
      return updated;
    });

    await logActivity(player.id, "bank_withdraw", `Withdrew $${amount.toLocaleString()} from the bank`);
    return void res.json({ success: true, cash: result.money, bankBalance: result.bankBalance });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "INSUFFICIENT_BANK") return void res.status(400).json({ error: "Insufficient bank balance." });
    return void res.status(500).json({ error: msg });
  }
});

router.post("/bank/loan/request", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const principal = Math.floor(Number((req.body as { amount?: unknown })?.amount));
    if (!Number.isFinite(principal) || principal <= 0) {
      return void res.status(400).json({ error: "Loan amount must be a positive integer." });
    }

    // Pre-check (cheap fast-fail outside the tx) — re-validated atomically below.
    {
      const preLimit = await computeCreditLimit(player.id, player.level);
      const preOutstanding = await getOutstandingLoanTotal(player.id);
      if (principal > preLimit - preOutstanding) {
        return void res.status(400).json({
          error: `Loan exceeds available credit ($${(preLimit - preOutstanding).toLocaleString()}).`,
        });
      }
    }

    const remaining = loanTotalDue(principal);
    const now = new Date();
    const dueAt = new Date(now.getTime() + BANK_CONFIG.LOAN_TERM_DAYS * 24 * 3600 * 1000);

    let creditError: string | null = null;
    const loan = await db.transaction(async (tx) => {
      // Lock the player row to serialize loan issuance for this player.
      const [locked] = await tx.select({
        id: playersTable.id,
        level: playersTable.level,
      }).from(playersTable).where(eq(playersTable.id, player.id)).for("update");
      if (!locked) throw new Error("PLAYER_NOT_FOUND");

      // Re-read credit limit + outstanding inside the lock so concurrent
      // requests cannot collectively exceed the cap.
      const limit = await computeCreditLimit(locked.id, locked.level);
      const [{ total: outstandingNow }] = await tx
        .select({ total: sql<number>`COALESCE(SUM(${bankLoansTable.remaining}), 0)::int` })
        .from(bankLoansTable)
        .where(and(eq(bankLoansTable.playerId, locked.id), eq(bankLoansTable.status, "active")));
      const availableNow = limit - Number(outstandingNow ?? 0);
      if (principal > availableNow) {
        creditError = `Loan exceeds available credit ($${availableNow.toLocaleString()}).`;
        throw new Error("CREDIT_EXCEEDED");
      }

      const [updated] = await tx.update(playersTable).set({
        money: sql`${playersTable.money} + ${principal}`,
        updatedAt: now,
      }).where(eq(playersTable.id, player.id))
        .returning({ money: playersTable.money, bankBalance: playersTable.bankBalance });
      const [inserted] = await tx.insert(bankLoansTable).values({
        playerId: player.id,
        principal,
        remaining,
        interestRate: BANK_CONFIG.LOAN_INTEREST_PERCENT,
        takenAt: now,
        dueAt,
        status: "active",
      }).returning();
      await tx.insert(bankTransactionsTable).values({
        playerId: player.id, type: "loan_taken", amount: principal, balanceAfter: updated.bankBalance,
      });
      return inserted;
    }).catch((e) => {
      if (creditError) return null;
      throw e;
    });

    if (!loan) {
      return void res.status(400).json({ error: creditError ?? "Loan request failed." });
    }

    await logActivity(player.id, "bank_loan_taken",
      `Took out a $${principal.toLocaleString()} loan — repay $${remaining.toLocaleString()} by ${dueAt.toISOString().slice(0, 10)}`);

    return void res.json({
      success: true,
      loan: {
        id: loan.id,
        principal: loan.principal,
        remaining: loan.remaining,
        interestRate: loan.interestRate,
        takenAt: loan.takenAt.toISOString(),
        dueAt: loan.dueAt.toISOString(),
        status: loan.status,
        isOverdue: loan.dueAt.getTime() <= Date.now(),
      },
    });
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

router.post("/bank/loan/:id/repay", requireAuth, requireAlive, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const loanId = parseInt(String(req.params.id));
    if (isNaN(loanId)) return void res.status(400).json({ error: "Invalid loan ID." });

    const [loan] = await db.select().from(bankLoansTable)
      .where(and(eq(bankLoansTable.id, loanId), eq(bankLoansTable.playerId, player.id)))
      .limit(1);
    if (!loan) return void res.status(404).json({ error: "Loan not found." });
    if (loan.status !== "active") {
      return void res.status(400).json({ error: "Loan is not active." });
    }
    if (player.money < loan.remaining) {
      return void res.status(400).json({
        error: `Insufficient cash. You need $${loan.remaining.toLocaleString()} to repay this loan.`,
      });
    }

    const amountPaid = loan.remaining;
    await db.transaction(async (tx) => {
      // Claim the loan first — only the winner of this CAS gets to deduct cash.
      const claimed = await tx.update(bankLoansTable)
        .set({ remaining: 0, status: "repaid" })
        .where(and(eq(bankLoansTable.id, loanId), eq(bankLoansTable.status, "active")))
        .returning({ id: bankLoansTable.id });
      if (claimed.length === 0) throw new Error("LOAN_NOT_ACTIVE");

      const [updated] = await tx.update(playersTable).set({
        money: sql`${playersTable.money} - ${amountPaid}`,
        updatedAt: new Date(),
      }).where(and(eq(playersTable.id, player.id), sql`${playersTable.money} >= ${amountPaid}`))
        .returning({ bankBalance: playersTable.bankBalance });
      if (!updated) throw new Error("INSUFFICIENT_FUNDS");

      await tx.insert(bankTransactionsTable).values({
        playerId: player.id, type: "loan_repaid", amount: amountPaid, balanceAfter: updated.bankBalance,
      });
    });

    await logActivity(player.id, "bank_loan_repaid",
      `Repaid loan #${loan.id} — paid $${amountPaid.toLocaleString()}`);
    return void res.json({ success: true, amountPaid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "INSUFFICIENT_FUNDS") return void res.status(400).json({ error: "Insufficient cash to repay loan." });
    if (msg === "LOAN_NOT_ACTIVE") return void res.status(409).json({ error: "Loan is no longer active." });
    return void res.status(500).json({ error: msg });
  }
});

router.get("/bank/transactions", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"))));

    const rows = await db.select().from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.playerId, player.id))
      .orderBy(desc(bankTransactionsTable.createdAt))
      .limit(limit);

    return void res.json(rows.map(r => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (e) {
    return void res.status(500).json({ error: String(e) });
  }
});

export default router;
