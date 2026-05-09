import { pgTable, serial, text, integer, bigint, timestamp, boolean } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const propertyTypesTable = pgTable("property_types", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en").notNull().default(""),
  descriptionAr: text("description_ar").notNull().default(""),
  price: bigint("price", { mode: "number" }).notNull(),
  baseIncomePerHour: bigint("base_income_per_hour", { mode: "number" }).notNull(),
  requiredLevel: integer("required_level").notNull().default(1),
  maxLevel: integer("max_level").notNull().default(4),
  icon: text("icon").notNull().default("building"),
  imageUrl: text("image_url").notNull().default(""),
  perksEn: text("perks_en").notNull().default(""),
  perksAr: text("perks_ar").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
});

export const playerPropertiesTable = pgTable("player_properties", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  propertyTypeId: integer("property_type_id").notNull().references(() => propertyTypesTable.id),
  level: integer("level").notNull().default(1),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  lastIncomeCollectedAt: timestamp("last_income_collected_at").notNull().defaultNow(),
});

export type PropertyType = typeof propertyTypesTable.$inferSelect;
export type PlayerProperty = typeof playerPropertiesTable.$inferSelect;
