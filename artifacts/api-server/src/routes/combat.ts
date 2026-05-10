import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, weaponsTable, armorItemsTable, playerAmmoTable, ammoTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentRank, getRankRow } from "../lib/phase1";

const router = Router();

const BULLET_PRICE_DEFAULT = 300;

// POST /combat/calculate
// body: { targetRank?: number, targetPlayerId?: number, targetArmorId?: number|null, guards?: { typeId:number, count:number }[] }
router.post("/combat/calculate", requireAuth, async (req, res) => {
  try {
    const clerkId = getCurrentClerkId(req);
    const player = await getOrCreatePlayer(clerkId);

    const body = req.body as {
      targetRank?: number;
      targetPlayerId?: number;
      targetArmorId?: number | null;
      targetGuards?: number;
      guards?: { typeId: number; count: number }[];
    };
    const GUARD_HP = 60;
    const guardCount = Math.max(0, Math.min(10, Math.floor(body.targetGuards ?? 0)));

    // Resolve target rank
    let targetRankNum = body.targetRank ?? 1;
    let targetUsername: string | null = null;
    if (body.targetPlayerId) {
      const [target] = await db.select({
        id: playersTable.id, username: playersTable.username,
      }).from(playersTable).where(eq(playersTable.id, body.targetPlayerId)).limit(1);
      if (!target) return void res.status(404).json({ error: "Target not found" });
      targetUsername = target.username;
      targetRankNum = await getCurrentRank(target.id);
    }

    // Get attacker weapon
    let weapon: typeof weaponsTable.$inferSelect | null = null;
    if (player.equippedWeaponId) {
      const [w] = await db.select().from(weaponsTable).where(eq(weaponsTable.id, player.equippedWeaponId)).limit(1);
      weapon = w ?? null;
    }
    if (!weapon) {
      return void res.status(400).json({ error: "No weapon equipped" });
    }

    const attackerRankRow = await getRankRow(await getCurrentRank(player.id));
    const attackerATK = (weapon.attackPower ?? 0) + (attackerRankRow?.atkBonus ?? 0);

    const targetRankRow = await getRankRow(targetRankNum);
    if (!targetRankRow) return void res.status(400).json({ error: "Invalid target rank" });

    let armorDef = 0;
    let armorName: string | null = null;
    if (body.targetArmorId) {
      const [a] = await db.select().from(armorItemsTable).where(eq(armorItemsTable.id, body.targetArmorId)).limit(1);
      armorDef = a?.defenseBonus ?? 0;
      armorName = a?.name ?? null;
    }

    const targetDEF = (targetRankRow.defBonus ?? 0) + armorDef;
    const targetHP = targetRankRow.maxHp;
    const damagePerBullet = Math.max(attackerATK - targetDEF, 5);
    const bulletsForTarget = Math.ceil(targetHP / damagePerBullet);

    // Guards: simple model — each bodyguard has GUARD_HP and takes
    // ceil(GUARD_HP / damagePerBullet) bullets to neutralize before reaching target.
    const bulletsPerGuard = guardCount > 0 ? Math.ceil(GUARD_HP / damagePerBullet) : 0;
    const totalBulletsForGuards = bulletsPerGuard * guardCount;
    const guardDetails: {
      type: string; count: number; bulletsPerGuard: number; totalBullets: number;
    }[] = guardCount > 0
      ? [{ type: "bodyguard", count: guardCount, bulletsPerGuard, totalBullets: totalBulletsForGuards }]
      : [];

    const totalBullets = totalBulletsForGuards + bulletsForTarget;

    // Available ammo of weapon's ammo type
    const ammoMatch = await db.select({
      qty: playerAmmoTable.quantity,
      price: ammoTable.price,
    })
      .from(playerAmmoTable)
      .innerJoin(ammoTable, eq(ammoTable.id, playerAmmoTable.ammoId))
      .where(and(
        eq(playerAmmoTable.playerId, player.id),
        eq(ammoTable.type, weapon.ammoType),
      ));
    const availableAmmo = ammoMatch.reduce((s, r) => s + (r.qty ?? 0), 0);
    const bulletPrice = ammoMatch[0]?.price ?? BULLET_PRICE_DEFAULT;
    const totalCost = totalBullets * bulletPrice;

    const hasEnoughAmmo = availableAmmo >= totalBullets;
    const hasEnoughMoney = player.money >= totalCost;

    const suggestions: { type: string; message: string; messageAr: string; cost?: number }[] = [];
    if (!hasEnoughAmmo) {
      const need = totalBullets - availableAmmo;
      suggestions.push({
        type: "buy_ammo",
        message: `Buy ${need} more ${weapon.ammoType} bullets`,
        messageAr: `اشترِ ${need} طلقة ${weapon.ammoType} إضافية`,
        cost: need * bulletPrice,
      });
    }

    return void res.json({
      attacker: {
        username: player.username, rank: attackerRankRow?.rankNumber ?? 1,
        weaponName: weapon.name, weaponAtk: weapon.attackPower, totalAtk: attackerATK,
        ammoType: weapon.ammoType,
      },
      target: {
        username: targetUsername, rank: targetRankNum,
        armorName, armorDef, totalDef: targetDEF, hp: targetHP,
      },
      calculation: {
        damagePerBullet, bulletsForGuards: totalBulletsForGuards, bulletsForTarget,
        totalBullets, bulletType: weapon.ammoType, bulletPrice, totalCost,
        guards: guardDetails,
      },
      availability: {
        hasEnoughAmmo, hasEnoughMoney, availableAmmo,
        neededAmmo: Math.max(0, totalBullets - availableAmmo),
        neededMoney: Math.max(0, totalCost - player.money),
      },
      canAttack: hasEnoughAmmo && hasEnoughMoney,
      suggestions,
    });
  } catch {
    return void res.status(500).json({ error: "Failed to calculate" });
  }
});

export default router;
