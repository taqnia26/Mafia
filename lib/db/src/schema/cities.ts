import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const citiesTable = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  country: text("country").notNull(),
  description: text("description").notNull().default(""),
  travelHoursBase: integer("travel_hours_base").notNull().default(4),
  imageUrl: text("image_url"),
});

export const insertCitySchema = createInsertSchema(citiesTable).omit({ id: true });
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof citiesTable.$inferSelect;
