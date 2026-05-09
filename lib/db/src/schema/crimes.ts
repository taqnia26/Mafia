import { pgTable, serial, text, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const crimeTypesTable = pgTable("crime_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  minReward: integer("min_reward").notNull(),
  maxReward: integer("max_reward").notNull(),
  xpReward: integer("xp_reward").notNull(),
  successRate: real("success_rate").notNull(),
  prisonTimeHours: integer("prison_time_hours").notNull(),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(30),
  requiredLevel: integer("required_level").notNull().default(1),
});

export const crimeRecordsTable = pgTable("crime_records", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  crimeTypeId: integer("crime_type_id").notNull().references(() => crimeTypesTable.id),
  crimeName: text("crime_name").notNull(),
  success: boolean("success").notNull(),
  caught: boolean("caught").notNull(),
  moneyEarned: integer("money_earned").notNull().default(0),
  xpEarned: integer("xp_earned").notNull().default(0),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
});

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrimeTypeSchema = createInsertSchema(crimeTypesTable).omit({ id: true });
export type InsertCrimeType = z.infer<typeof insertCrimeTypeSchema>;
export type CrimeType = typeof crimeTypesTable.$inferSelect;
