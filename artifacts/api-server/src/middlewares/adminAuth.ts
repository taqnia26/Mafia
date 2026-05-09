import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "../lib/db";
import { playersTable } from "@workspace/db/schema";
import type { AdminRole } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreatePlayer } from "../lib/auth";

const ROLE_LEVELS: Record<AdminRole | "none", number> = {
  none: 0,
  reviewer: 1,
  moderator: 2,
  admin: 3,
  superadmin: 4,
};

export function isAtLeast(role: AdminRole | null | undefined, minRole: AdminRole): boolean {
  const current = role ? (ROLE_LEVELS[role] ?? 0) : 0;
  const required = ROLE_LEVELS[minRole];
  return current >= required;
}

export function requireAdminRole(minRole: AdminRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const player = await getOrCreatePlayer(userId);
      // Backward-compat: legacy isAdmin=true players are treated as "admin" when no role is set
      const effectiveRole: AdminRole | null = player.adminRole ?? (player.isAdmin ? "admin" : null);
      if (!isAtLeast(effectiveRole, minRole)) {
        res.status(403).json({ error: `Requires ${minRole} role or higher` });
        return;
      }
      next();
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  };
}

export async function logAdminAction(
  adminId: number,
  adminUsername: string,
  action: string,
  targetType: string,
  targetId: number | null,
  description: string,
) {
  try {
    const { adminActionsLogTable } = await import("@workspace/db/schema");
    await db.insert(adminActionsLogTable).values({
      adminId,
      adminUsername,
      action,
      targetType,
      targetId,
      description,
    });
  } catch (_e) {
  }
}
