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
  | "black_market_listed"
  | "black_market_sale"
  | "black_market_purchase"
  | "traveled"
  | "arrived"
  | "attack_won"
  | "attack_lost"
  | "attack_repelled"
  | "attack_defended";

export async function logActivity(playerId: number, type: ActivityType, description: string) {
  await db.insert(activityLogTable).values({ playerId, type, description });
}
