import { pgTable, serial, text, bigint, timestamp } from "drizzle-orm/pg-core";

export const adminWalletTable = pgTable("admin_wallet", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AdminWalletEntry = typeof adminWalletTable.$inferSelect;
