import { db } from "./db";
import {
  playersTable, playerRanksTable, playerRankProgressTable,
  propertyTypesTable, playerPropertiesTable, cityPropertyCountsTable,
  adminWalletTable,
} from "@workspace/db/schema";
import { eq, and, count, sql } from "drizzle-orm";

export const SAFE_HOUSE = {
  OWNER_CUT: 0.35,
  ADMIN_CUT: 0.65,
  MIN_RENT: 10000,
  MAX_DAYS: 7,
  COOLDOWN_HOURS: 24,
};

export const BLACKJACK = {
  COMMISSION: 0.15,
  MIN_BET: 5000,
  MAX_BET: 50000,
  PAYOUT_MULTIPLIER: 1.8,
  DAILY_LIMIT: 20,
};

export async function getCurrentRank(playerId: number): Promise<number> {
  const rows = await db.select().from(playerRankProgressTable)
    .where(eq(playerRankProgressTable.playerId, playerId)).limit(1);
  return rows[0]?.currentRank ?? 1;
}

export async function getRankRow(rankNumber: number) {
  const rows = await db.select().from(playerRanksTable)
    .where(eq(playerRanksTable.rankNumber, rankNumber)).limit(1);
  return rows[0];
}

export async function countRank12Holders(): Promise<number> {
  const rows = await db
    .select({ playerId: playerRankProgressTable.playerId })
    .from(playerRankProgressTable)
    .where(eq(playerRankProgressTable.currentRank, 12));
  return rows.length;
}

export async function getRank12Holders() {
  const rows = await db
    .select({
      id: playersTable.id,
      username: playersTable.username,
      level: playersTable.level,
      cityId: playersTable.cityId,
    })
    .from(playerRankProgressTable)
    .innerJoin(playersTable, eq(playersTable.id, playerRankProgressTable.playerId))
    .where(eq(playerRankProgressTable.currentRank, 12));
  return rows;
}

export async function recordAdminRevenue(source: string, amount: number, description: string) {
  if (amount <= 0) return;
  await db.insert(adminWalletTable).values({ source, amount, description });
}

export type CanBuildResult =
  | { canBuild: true }
  | { canBuild: false; reason: string; reasonAr: string; currentOwners?: { id: number; username: string }[] };

export async function canBuildPropertyAt(
  playerId: number,
  cityId: number,
  propertyTypeId: number,
): Promise<CanBuildResult> {
  const [pt] = await db.select().from(propertyTypesTable)
    .where(eq(propertyTypesTable.id, propertyTypeId)).limit(1);
  if (!pt) return { canBuild: false, reason: "Invalid property type", reasonAr: "نوع عقار غير صالح" };

  if (pt.minRank != null) {
    const rank = await getCurrentRank(playerId);
    if (rank < pt.minRank) {
      return {
        canBuild: false,
        reason: `Requires rank ${pt.minRank}+`,
        reasonAr: `يتطلب رتبة ${pt.minRank} أو أعلى`,
      };
    }
  }

  if (pt.maxPerCity !== -1) {
    const [counter] = await db.select().from(cityPropertyCountsTable)
      .where(and(
        eq(cityPropertyCountsTable.cityId, cityId),
        eq(cityPropertyCountsTable.propertyTypeId, pt.id),
      )).limit(1);

    if (counter && counter.currentCount >= counter.maxCount) {
      const owners = await db
        .select({ id: playersTable.id, username: playersTable.username })
        .from(playerPropertiesTable)
        .innerJoin(playersTable, eq(playersTable.id, playerPropertiesTable.playerId))
        .where(and(
          eq(playerPropertiesTable.propertyTypeId, pt.id),
          eq(playersTable.cityId, cityId),
        ));
      return {
        canBuild: false,
        reason: `Maximum ${counter.maxCount} ${pt.nameEn} per city. All slots taken!`,
        reasonAr: `الحد الأقصى ${counter.maxCount} ${pt.nameAr} في المدينة. كل الأماكن مأخوذة!`,
        currentOwners: owners,
      };
    }
  }

  return { canBuild: true };
}

/**
 * Atomically reserve a slot in the city property counter.
 * Uses INSERT ... ON CONFLICT DO UPDATE so it never overshoots maxCount even
 * under concurrent purchases. Returns true if reserved, false if maxed out.
 * Caller MUST run this inside the same transaction as the property INSERT and
 * roll back if it returns false.
 */
export async function tryReserveCitySlot(
  tx: typeof db,
  cityId: number,
  propertyTypeId: number,
): Promise<boolean> {
  const [pt] = await tx.select().from(propertyTypesTable)
    .where(eq(propertyTypesTable.id, propertyTypeId)).limit(1);
  if (!pt) return false;
  if (pt.maxPerCity === -1) return true;

  const result = await tx.execute(sql`
    INSERT INTO city_property_counts (city_id, property_type_id, current_count, max_count)
    VALUES (${cityId}, ${propertyTypeId}, 1, ${pt.maxPerCity})
    ON CONFLICT (city_id, property_type_id)
    DO UPDATE SET current_count = city_property_counts.current_count + 1
    WHERE city_property_counts.current_count < city_property_counts.max_count
    RETURNING current_count
  `);
  // pg returns rows on the result object
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
  return Array.isArray(rows) && rows.length > 0;
}

export function getRankBadgeTier(rank: number): "bronze" | "silver" | "gold" | "platinum" {
  if (rank <= 3) return "bronze";
  if (rank <= 6) return "silver";
  if (rank <= 9) return "gold";
  return "platinum";
}
