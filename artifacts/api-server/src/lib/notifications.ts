import { db } from "./db";
import { notificationsTable } from "@workspace/db/schema";

export type NotificationType =
  | "incoming_attack"
  | "attack_resolved"
  | "crime_completed"
  | "bodyguard_request"
  | "reactor_built"
  | "reactor_meltdown"
  | "reactor_damaged";

export async function createNotification(
  playerId: number,
  type: NotificationType,
  message: string,
  link: string,
): Promise<void> {
  await db.insert(notificationsTable).values({ playerId, type, message, link });
}
