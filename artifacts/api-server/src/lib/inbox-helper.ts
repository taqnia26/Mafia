import { db } from "./db";
import {
  inboxMessagesTable, inboxStatsTable, playersTable,
  type InboxCategory, type InboxPriority,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

export interface SendInboxMessageInput {
  playerId: number;
  category: InboxCategory;
  priority?: InboxPriority;
  subjectEn: string;
  subjectAr: string;
  bodyEn: string;
  bodyAr: string;
  metadata?: Record<string, unknown>;
  actionLink?: string | null;
  actionLabelEn?: string | null;
  actionLabelAr?: string | null;
}

/**
 * Insert one inbox message and atomically:
 *   - bump players.unread_inbox_count (the fast badge counter)
 *   - upsert inbox_stats (totalReceived, lastMessageAt)
 *
 * The unread counter is the source of truth for the header badge — never
 * recompute it lazily. Every read/delete/insert path must keep it in sync.
 */
export async function sendInboxMessage(input: SendInboxMessageInput): Promise<{ id: number }> {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(inboxMessagesTable).values({
      playerId: input.playerId,
      category: input.category,
      priority: input.priority ?? "normal",
      subjectEn: input.subjectEn,
      subjectAr: input.subjectAr,
      bodyEn: input.bodyEn,
      bodyAr: input.bodyAr,
      metadata: input.metadata ?? {},
      actionLink: input.actionLink ?? null,
      actionLabelEn: input.actionLabelEn ?? null,
      actionLabelAr: input.actionLabelAr ?? null,
    }).returning({ id: inboxMessagesTable.id });

    await tx.update(playersTable)
      .set({
        unreadInboxCount: sql`${playersTable.unreadInboxCount} + 1`,
        updatedAt: now,
      })
      .where(eq(playersTable.id, input.playerId));

    await tx.insert(inboxStatsTable).values({
      playerId: input.playerId,
      totalReceived: 1,
      lastMessageAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: inboxStatsTable.playerId,
      set: {
        totalReceived: sql`${inboxStatsTable.totalReceived} + 1`,
        lastMessageAt: now,
        updatedAt: now,
      },
    });

    return { id: row.id };
  });
}
