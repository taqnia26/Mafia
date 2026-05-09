import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const armorTypeEnum = ["armored_car", "armored_helicopter", "bulletproof_vest", "reinforced_bunker"] as const;

export const armorItemsTable = pgTable("armor_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").$type<typeof armorTypeEnum[number]>().notNull(),
  defenseBonus: integer("defense_bonus").notNull(),
  price: integer("price").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
});

export const playerArmorTable = pgTable("player_armor", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  armorId: integer("armor_id").notNull().references(() => armorItemsTable.id),
  quantity: integer("quantity").notNull().default(1),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
});

export const insertArmorItemSchema = createInsertSchema(armorItemsTable).omit({ id: true });
export type InsertArmorItem = z.infer<typeof insertArmorItemSchema>;
export type ArmorItem = typeof armorItemsTable.$inferSelect;
