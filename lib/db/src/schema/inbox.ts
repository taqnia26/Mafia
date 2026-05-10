import { pgTable, serial, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const inboxCategoryEnum = ["attack", "property", "gang", "personal", "financial", "system"] as const;
export type InboxCategory = typeof inboxCategoryEnum[number];

export const inboxPriorityEnum = ["urgent", "high", "normal", "low"] as const;
export type InboxPriority = typeof inboxPriorityEnum[number];

export const inboxMessagesTable = pgTable("inbox_messages", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  category: text("category").$type<InboxCategory>().notNull(),
  priority: text("priority").$type<InboxPriority>().notNull().default("normal"),
  subjectEn: text("subject_en").notNull(),
  subjectAr: text("subject_ar").notNull(),
  bodyEn: text("body_en").notNull(),
  bodyAr: text("body_ar").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  actionLink: text("action_link"),
  actionLabelEn: text("action_label_en"),
  actionLabelAr: text("action_label_ar"),
  isRead: boolean("is_read").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  readAt: timestamp("read_at"),
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  byPlayer: index("idx_inbox_player_created").on(t.playerId, t.createdAt),
  byPlayerUnread: index("idx_inbox_player_unread").on(t.playerId, t.isRead, t.isDeleted),
  byPlayerCategory: index("idx_inbox_player_category").on(t.playerId, t.category, t.isDeleted),
}));

export const inboxStatsTable = pgTable("inbox_stats", {
  playerId: integer("player_id").primaryKey().references(() => playersTable.id, { onDelete: "cascade" }),
  totalReceived: integer("total_received").notNull().default(0),
  lastMessageAt: timestamp("last_message_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InboxMessage = typeof inboxMessagesTable.$inferSelect;
export type InboxStats = typeof inboxStatsTable.$inferSelect;
