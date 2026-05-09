import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";
import { weaponsTable } from "./weapons";
import { citiesTable } from "./cities";

export const attackStatusEnum = ["traveling", "completed", "cancelled", "failed"] as const;

export const attacksTable = pgTable("attacks", {
  id: serial("id").primaryKey(),
  attackerId: integer("attacker_id").notNull().references(() => playersTable.id),
  targetId: integer("target_id").notNull().references(() => playersTable.id),
  weaponId: integer("weapon_id").notNull().references(() => weaponsTable.id),
  ammoUsed: integer("ammo_used").notNull(),
  fromCityId: integer("from_city_id").notNull().references(() => citiesTable.id),
  toCityId: integer("to_city_id").notNull().references(() => citiesTable.id),
  status: text("status").$type<typeof attackStatusEnum[number]>().notNull().default("traveling"),
  travelArrivalAt: timestamp("travel_arrival_at"),
  damageDealt: integer("damage_dealt"),
  targetSurvived: boolean("target_survived"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAttackSchema = createInsertSchema(attacksTable).omit({ id: true, createdAt: true });
export type InsertAttack = z.infer<typeof insertAttackSchema>;
export type Attack = typeof attacksTable.$inferSelect;
