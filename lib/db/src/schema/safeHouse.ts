import { pgTable, serial, integer, bigint, text, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";
import { playerPropertiesTable } from "./properties";

export const safeHouseRentalsTable = pgTable("safe_house_rentals", {
  id: serial("id").primaryKey(),
  playerPropertyId: integer("player_property_id").notNull().references(() => playerPropertiesTable.id),
  renterId: integer("renter_id").notNull().references(() => playersTable.id),
  ownerId: integer("owner_id").notNull().references(() => playersTable.id),
  rentAmount: bigint("rent_amount", { mode: "number" }).notNull(),
  ownerRevenue: bigint("owner_revenue", { mode: "number" }).notNull(),
  adminRevenue: bigint("admin_revenue", { mode: "number" }).notNull(),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("active"),
  renterIp: text("renter_ip"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SafeHouseRental = typeof safeHouseRentalsTable.$inferSelect;
