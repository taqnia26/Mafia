import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const chatChannelEnum = ["global", "gang", "city", "private"] as const;
export type ChatChannel = typeof chatChannelEnum[number];

export const chatRestrictionScopeEnum = ["global", "gang", "city", "private", "all"] as const;
export type ChatRestrictionScope = typeof chatRestrictionScopeEnum[number];

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  channel: text("channel").$type<ChatChannel>().notNull(),
  senderId: integer("sender_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").references(() => playersTable.id, { onDelete: "cascade" }),
  gangId: integer("gang_id"),
  cityId: integer("city_id"),
  body: text("body").notNull(),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatRateLimitsTable = pgTable("chat_rate_limits", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const chatRestrictionsTable = pgTable("chat_restrictions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  channel: text("channel").$type<ChatRestrictionScope>().notNull(),
  reason: text("reason"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type ChatRestriction = typeof chatRestrictionsTable.$inferSelect;
