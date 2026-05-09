import { pgTable, serial, text, integer, bigint, jsonb, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const playerRanksTable = pgTable("player_ranks", {
  id: serial("id").primaryKey(),
  rankNumber: integer("rank_number").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  subtitleEn: text("subtitle_en").notNull().default(""),
  subtitleAr: text("subtitle_ar").notNull().default(""),
  requiredLevel: integer("required_level").notNull(),
  requiredMoney: bigint("required_money", { mode: "number" }).notNull().default(0),
  requiredXp: bigint("required_xp", { mode: "number" }).notNull().default(0),
  requiredKills: integer("required_kills").notNull().default(0),
  atkBonus: integer("atk_bonus").notNull().default(0),
  defBonus: integer("def_bonus").notNull().default(0),
  maxNpcGuards: integer("max_npc_guards").notNull().default(0),
  maxPlayerGuards: integer("max_player_guards").notNull().default(0),
  maxProperties: integer("max_properties").notNull().default(0),
  color: text("color").notNull().default("#6b7280"),
  icon: text("icon").notNull().default("shield"),
  perksEn: text("perks_en").notNull().default(""),
  perksAr: text("perks_ar").notNull().default(""),
});

export const playerRankProgressTable = pgTable("player_rank_progress", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }).unique(),
  currentRank: integer("current_rank").notNull().default(1),
  upgradedAt: timestamp("upgraded_at").notNull().defaultNow(),
});

export type PlayerRank = typeof playerRanksTable.$inferSelect;
export type PlayerRankProgress = typeof playerRankProgressTable.$inferSelect;
