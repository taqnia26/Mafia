import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gangsTable = pgTable("gangs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  treasury: integer("treasury").notNull().default(0),
  bossId: integer("boss_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGangSchema = createInsertSchema(gangsTable).omit({ id: true, createdAt: true });
export type InsertGang = z.infer<typeof insertGangSchema>;
export type Gang = typeof gangsTable.$inferSelect;
