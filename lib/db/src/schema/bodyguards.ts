import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const guardTierEnum = ["basic", "advanced", "elite"] as const;
export const requestStatusEnum = ["pending", "accepted", "rejected", "cancelled"] as const;

export const npcBodyguardsTable = pgTable("npc_bodyguards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").$type<typeof guardTierEnum[number]>().notNull(),
  defensePower: integer("defense_power").notNull(),
  hirePrice: integer("hire_price").notNull(),
  dailyCost: integer("daily_cost").notNull(),
  description: text("description").notNull().default(""),
});

export const playerNpcGuardsTable = pgTable("player_npc_guards", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  npcGuardId: integer("npc_guard_id").notNull().references(() => npcBodyguardsTable.id),
  hiredAt: timestamp("hired_at").notNull().defaultNow(),
});

export const bodyguardRequestsTable = pgTable("bodyguard_requests", {
  id: serial("id").primaryKey(),
  fromPlayerId: integer("from_player_id").notNull().references(() => playersTable.id),
  toPlayerId: integer("to_player_id").notNull().references(() => playersTable.id),
  offeredMoney: integer("offered_money").notNull().default(0),
  status: text("status").$type<typeof requestStatusEnum[number]>().notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerGuardsTable = pgTable("player_guards", {
  id: serial("id").primaryKey(),
  protectedPlayerId: integer("protected_player_id").notNull().references(() => playersTable.id),
  guardPlayerId: integer("guard_player_id").notNull().references(() => playersTable.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
});

export const insertNpcBodyguardSchema = createInsertSchema(npcBodyguardsTable).omit({ id: true });
export type InsertNpcBodyguard = z.infer<typeof insertNpcBodyguardSchema>;
export type NpcBodyguard = typeof npcBodyguardsTable.$inferSelect;
