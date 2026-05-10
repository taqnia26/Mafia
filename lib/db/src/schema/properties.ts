import { pgTable, serial, text, integer, bigint, timestamp, boolean } from "drizzle-orm/pg-core";
import { playersTable } from "./players";
import { citiesTable } from "./cities";

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
  isReactor: boolean("is_reactor").notNull().default(false),
  maxPerCity: integer("max_per_city").notNull().default(-1),
  minRank: integer("min_rank"),
  slug: text("slug"),
  isSupremeFortress: boolean("is_supreme_fortress").notNull().default(false),
});

export const cityPropertyCountsTable = pgTable("city_property_counts", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => citiesTable.id),
  propertyTypeId: integer("property_type_id").notNull().references(() => propertyTypesTable.id),
  currentCount: integer("current_count").notNull().default(0),
  maxCount: integer("max_count").notNull(),
});

export type CityPropertyCount = typeof cityPropertyCountsTable.$inferSelect;

export const playerPropertiesTable = pgTable("player_properties", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  propertyTypeId: integer("property_type_id").notNull().references(() => propertyTypesTable.id),
  level: integer("level").notNull().default(1),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  lastIncomeCollectedAt: timestamp("last_income_collected_at").notNull().defaultNow(),
});

export const nuclearReactorStateTable = pgTable("nuclear_reactor_state", {
  id: serial("id").primaryKey(),
  playerPropertyId: integer("player_property_id").notNull().unique()
    .references(() => playerPropertiesTable.id, { onDelete: "cascade" }),
  cityId: integer("city_id").notNull().references(() => citiesTable.id),
  energyUnits: integer("energy_units").notNull().default(0),
  integrity: integer("integrity").notNull().default(100),
  lastPayoutAt: timestamp("last_payout_at").notNull().defaultNow(),
  isUnderConstruction: boolean("is_under_construction").notNull().default(true),
  constructionCompleteAt: timestamp("construction_complete_at").notNull(),
});

export type PropertyType = typeof propertyTypesTable.$inferSelect;
export type PlayerProperty = typeof playerPropertiesTable.$inferSelect;
export type NuclearReactorState = typeof nuclearReactorStateTable.$inferSelect;
