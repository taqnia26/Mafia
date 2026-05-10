import { db } from "./db";
import {
  chatRateLimitsTable,
  chatRestrictionsTable,
  type ChatChannel,
  type ChatRestrictionScope,
} from "@workspace/db/schema";
import { and, eq, gt, gte, isNull, or, sql } from "drizzle-orm";

export const CHAT_MAX_MESSAGE_LENGTH = 500;
export const CHAT_RATE_LIMIT_PER_MINUTE = 10;
export const CHAT_HISTORY_LIMIT_GLOBAL_GANG = 200;
export const CHAT_HISTORY_LIMIT_CITY_PRIVATE = 100;
export const CHAT_RETENTION_DAYS = 7;
export const CHAT_RATE_LIMIT_RETENTION_HOURS = 1;

export type ChatRestrictionCheck = {
  blocked: boolean;
  reason?: string;
  expiresAt?: Date | null;
};

/**
 * Returns the current restriction (if any) for the given player on the given channel.
 * A restriction with `channel = 'all'` blocks every channel. Expired restrictions are ignored.
 */
export async function checkChatRestriction(
  playerId: number,
  channel: ChatChannel,
): Promise<ChatRestrictionCheck> {
  const now = new Date();
  const rows = await db
    .select()
    .from(chatRestrictionsTable)
    .where(and(
      eq(chatRestrictionsTable.playerId, playerId),
      or(
        eq(chatRestrictionsTable.channel, channel as ChatRestrictionScope),
        eq(chatRestrictionsTable.channel, "all"),
      ),
      or(
        isNull(chatRestrictionsTable.expiresAt),
        gt(chatRestrictionsTable.expiresAt, now),
      ),
    ))
    .limit(1);
  const r = rows[0];
  if (!r) return { blocked: false };
  return { blocked: true, reason: r.reason ?? undefined, expiresAt: r.expiresAt };
}

/**
 * Records a send attempt and enforces a rolling 1-minute window.
 * Returns false if the player has already sent the maximum allowed messages.
 */
export async function consumeRateLimit(playerId: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000);
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(chatRateLimitsTable)
    .where(and(
      eq(chatRateLimitsTable.playerId, playerId),
      gte(chatRateLimitsTable.sentAt, windowStart),
    ));
  const recent = rows[0]?.c ?? 0;
  if (recent >= CHAT_RATE_LIMIT_PER_MINUTE) return false;
  await db.insert(chatRateLimitsTable).values({ playerId });
  return true;
}

export function sanitizeBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > CHAT_MAX_MESSAGE_LENGTH) return null;
  return trimmed;
}
