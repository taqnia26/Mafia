import { pgTable, serial, integer, bigint, text, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { playersTable } from "./players";
import { playerPropertiesTable } from "./properties";

export type BlackjackHand = number[]; // card ranks 1..13

export type BlackjackGameData = {
  playerHand: BlackjackHand;
  dealerHand: BlackjackHand;
  playerTotal: number;
  dealerTotal: number;
  outcome: "win" | "lose" | "push" | "blackjack" | "bust";
};

export const casinoGamesTable = pgTable("casino_games", {
  id: serial("id").primaryKey(),
  casinoPropertyId: integer("casino_property_id").references(() => playerPropertiesTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  gameType: text("game_type").notNull(),
  betAmount: bigint("bet_amount", { mode: "number" }).notNull(),
  commission: bigint("commission", { mode: "number" }).notNull(),
  effectiveBet: bigint("effective_bet", { mode: "number" }).notNull(),
  result: text("result").notNull(),
  payout: bigint("payout", { mode: "number" }).notNull().default(0),
  netProfit: bigint("net_profit", { mode: "number" }).notNull(),
  gameData: jsonb("game_data").$type<BlackjackGameData | Record<string, unknown>>(),
  playedAt: timestamp("played_at").defaultNow(),
  playerIp: text("player_ip"),
});

export const casinoDailyLimitsTable = pgTable("casino_daily_limits", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  gameType: text("game_type").notNull(),
  gamesPlayed: integer("games_played").notNull().default(0),
  totalBet: bigint("total_bet", { mode: "number" }).notNull().default(0),
  date: date("date").notNull().defaultNow(),
});

export const blackjackSessionsTable = pgTable("blackjack_sessions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().unique().references(() => playersTable.id),
  casinoPropertyId: integer("casino_property_id").references(() => playerPropertiesTable.id),
  betAmount: bigint("bet_amount", { mode: "number" }).notNull(),
  commission: bigint("commission", { mode: "number" }).notNull(),
  effectiveBet: bigint("effective_bet", { mode: "number" }).notNull(),
  playerHand: jsonb("player_hand").$type<BlackjackHand>().notNull(),
  dealerHand: jsonb("dealer_hand").$type<BlackjackHand>().notNull(),
  deckSeed: text("deck_seed").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CasinoGame = typeof casinoGamesTable.$inferSelect;
export type CasinoDailyLimit = typeof casinoDailyLimitsTable.$inferSelect;
export type BlackjackSession = typeof blackjackSessionsTable.$inferSelect;
