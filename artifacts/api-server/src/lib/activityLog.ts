import { db } from "./db";
import { activityLogTable } from "@workspace/db/schema";

export type ActivityType =
  | "attack_sent"
  | "attack_received"
  | "crime_success"
  | "crime_failed"
  | "jailed"
  | "released"
  | "joined_gang"
  | "left_gang"
  | "bodyguard_hired"
  | "black_market_sale"
  | "black_market_purchase"
  | "traveled";

export async function logActivity(playerId: number, type: ActivityType, description: string) {
  await db.insert(activityLogTable).values({ playerId, type, description });
}
