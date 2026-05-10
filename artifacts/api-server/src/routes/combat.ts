import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, getOrCreatePlayer, getCurrentClerkId } from "../lib/auth";
import {
  playersTable, weaponsTable, armorItemsTable, playerAmmoTable, ammoTable, playerWeaponsTable,
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
    const guardCount = Math.max(0, Math.min(20, Math.floor(body.targetGuards ?? 0)));

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

    // Get attacker weapon (equipped, or fall back to strongest owned weapon)
    let weapon: typeof weaponsTable.$inferSelect | null = null;
    if (player.equippedWeaponId) {
      const [w] = await db.select().from(weaponsTable).where(eq(weaponsTable.id, player.equippedWeaponId)).limit(1);
      weapon = w ?? null;
    }
    if (!weapon) {
      const owned = await db.select({
        weapon: weaponsTable,
      })
        .from(playerWeaponsTable)
        .innerJoin(weaponsTable, eq(weaponsTable.id, playerWeaponsTable.weaponId))
        .where(eq(playerWeaponsTable.playerId, player.id));
      if (owned.length > 0) {
        owned.sort((a, b) => (b.weapon.attackPower ?? 0) - (a.weapon.attackPower ?? 0));
        weapon = owned[0].weapon;
        await db.update(playersTable)
          .set({ equippedWeaponId: weapon.id, updatedAt: new Date() })
          .where(eq(playersTable.id, player.id));
      }
    }
    if (!weapon) {
      return void res.status(400).json({
        error: "No weapon owned",
        errorAr: "لا تملك أي سلاح. توجّه إلى صفحة الأسلحة واشترِ سلاحاً أولاً.",
        code: "no_weapon",
      });
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

    // Base damage (no rank scaling) — used for guards & display
    const baseDamage = Math.max(attackerATK - targetDEF, 1);

    // Rank-based scaling: each rank diff doubles bullets needed (or halves them)
    const attackerRankNum = attackerRankRow?.rankNumber ?? 1;
    const rankDifference = targetRankNum - attackerRankNum;
    let rankMultiplier = 1.0;
    if (rankDifference > 0) {
      rankMultiplier = Math.max(Math.pow(0.5, rankDifference), 0.0001);
    } else if (rankDifference < 0) {
      rankMultiplier = Math.min(Math.pow(1.2, Math.abs(rankDifference)), 3.0);
    }

    // Effective damage on target (kept as float for accurate bullet count)
    const effectiveDamage = Math.max(baseDamage * rankMultiplier, 0.0001);
    const damagePerBullet = Math.max(Math.floor(effectiveDamage), 1); // display value
    const bulletsForTarget = Math.ceil(targetHP / effectiveDamage);

    // Guards: rank-neutral; use base damage (or floor 5 like before)
    const guardDamage = Math.max(baseDamage, 5);
    const bulletsPerGuard = guardCount > 0 ? Math.ceil(GUARD_HP / guardDamage) : 0;
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
        message: `Buy ${need.toLocaleString("en-US")} more ${weapon.ammoType} bullets`,
        messageAr: `اشترِ ${need.toLocaleString("en-US")} طلقة ${weapon.ammoType} إضافية`,
        cost: need * bulletPrice,
      });
    }
    if (rankDifference >= 5) {
      const suggestedRank = Math.max(attackerRankNum + 1, targetRankNum - 2);
      suggestions.push({
        type: "level_up",
        message: `Target is ${rankDifference} ranks higher — level up to rank ${suggestedRank} first to drastically reduce bullets needed.`,
        messageAr: `الهدف أعلى منك بـ ${rankDifference} رتب — ارفع رتبتك إلى ${suggestedRank} أولاً لتقليل عدد الرصاصات بشكل كبير.`,
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
        rankDifference,
        rankMultiplier: Number(rankMultiplier.toFixed(6)),
        effectiveDamage: Number(effectiveDamage.toFixed(4)),
        baseDamage,
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
