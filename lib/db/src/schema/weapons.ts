import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const weaponTypeEnum = ["pistol", "shotgun", "rifle", "submachine_gun", "sniper", "rpg"] as const;

export const weaponsTable = pgTable("weapons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").$type<typeof weaponTypeEnum[number]>().notNull(),
  attackPower: integer("attack_power").notNull(),
  price: integer("price").notNull(),
  ammoType: text("ammo_type").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
});

export const playerWeaponsTable = pgTable("player_weapons", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  weaponId: integer("weapon_id").notNull().references(() => weaponsTable.id),
  quantity: integer("quantity").notNull().default(1),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
});

export const ammoTable = pgTable("ammo", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  damageBonus: integer("damage_bonus").notNull().default(0),
  price: integer("price").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
});

export const playerAmmoTable = pgTable("player_ammo", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  ammoId: integer("ammo_id").notNull().references(() => ammoTable.id),
  quantity: integer("quantity").notNull().default(0),
});

export const insertWeaponSchema = createInsertSchema(weaponsTable).omit({ id: true });
export type InsertWeapon = z.infer<typeof insertWeaponSchema>;
export type Weapon = typeof weaponsTable.$inferSelect;

export const insertPlayerWeaponSchema = createInsertSchema(playerWeaponsTable).omit({ id: true, acquiredAt: true });
export type InsertPlayerWeapon = z.infer<typeof insertPlayerWeaponSchema>;
export type PlayerWeapon = typeof playerWeaponsTable.$inferSelect;
