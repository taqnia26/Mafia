import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    superAdminId?: number;
    superAdminUsername?: string;
  }
}

export function requireSuperAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.superAdminId) {
    res.status(401).json({ error: "Unauthorized. Super-admin login required." });
    return;
  }
  next();
}
