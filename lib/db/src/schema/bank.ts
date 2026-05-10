import { pgTable, serial, integer, text, bigint, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const bankLoanStatusEnum = ["active", "repaid", "defaulted"] as const;
export type BankLoanStatus = typeof bankLoanStatusEnum[number];

export const bankLoansTable = pgTable("bank_loans", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  principal: bigint("principal", { mode: "number" }).notNull(),
  remaining: bigint("remaining", { mode: "number" }).notNull(),
  interestRate: integer("interest_rate").notNull(),
  takenAt: timestamp("taken_at").notNull().defaultNow(),
  dueAt: timestamp("due_at").notNull(),
  status: text("status").$type<BankLoanStatus>().notNull().default("active"),
});

export const bankTransactionTypeEnum = [
  "deposit",
  "withdraw",
  "interest",
  "loan_taken",
  "loan_repaid",
  "loan_garnished",
  "loan_default_seize",
] as const;
export type BankTransactionType = typeof bankTransactionTypeEnum[number];

export const bankTransactionsTable = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  type: text("type").$type<BankTransactionType>().notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BankLoan = typeof bankLoansTable.$inferSelect;
export type BankTransaction = typeof bankTransactionsTable.$inferSelect;
