import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { citiesTable } from "./cities";

export const gangRankEnum = ["Soldier", "Capo", "Underboss", "Consigliere", "Boss"] as const;

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  username: text("username").notNull().unique(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  money: integer("money").notNull().default(5000),
  attackPower: integer("attack_power").notNull().default(10),
  defensePower: integer("defense_power").notNull().default(10),
  killCount: integer("kill_count").notNull().default(0),
  deathCount: integer("death_count").notNull().default(0),
  cityId: integer("city_id").notNull().references(() => citiesTable.id),
  gangId: integer("gang_id"),
  gangRank: text("gang_rank").$type<typeof gangRankEnum[number]>(),
  antiSpyEnabled: boolean("anti_spy_enabled").notNull().default(false),
  isInPrison: boolean("is_in_prison").notNull().default(false),
  prisonReleaseAt: timestamp("prison_release_at"),
  prisonCrime: text("prison_crime"),
  isTraveling: boolean("is_traveling").notNull().default(false),
  travelToCityId: integer("travel_to_city_id"),
  travelArrivalAt: timestamp("travel_arrival_at"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
