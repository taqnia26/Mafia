import { pgTable, serial, text, integer, boolean, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { citiesTable } from "./cities";

export const gangRankEnum = ["Soldier", "Capo", "Underboss", "Consigliere", "Boss"] as const;
export const adminRoleEnum = ["reviewer", "moderator", "admin", "superadmin"] as const;

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
  antiSpyExpiresAt: timestamp("anti_spy_expires_at"),
  isInPrison: boolean("is_in_prison").notNull().default(false),
  prisonReleaseAt: timestamp("prison_release_at"),
  prisonCrime: text("prison_crime"),
  isTraveling: boolean("is_traveling").notNull().default(false),
  travelToCityId: integer("travel_to_city_id"),
  travelArrivalAt: timestamp("travel_arrival_at"),
  health: integer("health").notNull().default(100),
  maxHealth: integer("max_health").notNull().default(100),
  isPermanentlyDead: boolean("is_permanently_dead").notNull().default(false),
  diedAt: timestamp("died_at"),
  killedByPlayerId: integer("killed_by_player_id"),
  deathCause: text("death_cause"),
  bankBalance: bigint("bank_balance", { mode: "number" }).notNull().default(0),
  lastBankInterestAt: timestamp("last_bank_interest_at"),
  inSafeHouse: boolean("in_safe_house").notNull().default(false),
  safeHouseExpiresAt: timestamp("safe_house_expires_at"),
  ipAddress: text("ip_address"),
  equippedWeaponId: integer("equipped_weapon_id"),
  isAdmin: boolean("is_admin").notNull().default(false),
  adminRole: text("admin_role").$type<typeof adminRoleEnum[number]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const adminActionsLogTable = pgTable("admin_actions_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  adminUsername: text("admin_username").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
export type AdminRole = typeof adminRoleEnum[number];
