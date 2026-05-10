import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Crosshair, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { AnimatePresence, motion } from "framer-motion";

interface Calc {
  attacker: { username: string; rank: number; weaponName: string; weaponAtk: number; totalAtk: number; ammoType: string };
  target: { username: string | null; rank: number; armorName: string | null; armorDef: number; totalDef: number; hp: number };
  calculation: {
    damagePerBullet: number;
    bulletsForGuards: number;
    bulletsForTarget: number;
    totalBullets: number;
    bulletType: string;
    bulletPrice: number;
    totalCost: number;
  };
  availability: {
    hasEnoughAmmo: boolean; hasEnoughMoney: boolean;
    availableAmmo: number; neededAmmo: number; neededMoney: number;
  };
  canAttack: boolean;
  suggestions: { type: string; message: string; messageAr: string; cost?: number }[];
}

interface ArmorItem {
  id: number;
  name: string;
  defenseBonus: number;
  type: string;
}

interface RankInfo {
  rankNumber: number;
  nameEn: string;
  nameAr: string;
}

interface RanksResponse {
  ranks: RankInfo[];
}

// Armor English → Arabic translation map (DB stores English only)
const ARMOR_NAME_AR: Record<string, string> = {
  "Bulletproof Vest": "سترة واقية من الرصاص",
  "Armored Sedan": "سيارة سيدان مصفحة",
  "Armored SUV": "سيارة دفع رباعي مصفحة",
  "Combat Helicopter": "هليكوبتر قتالية",
  "Reinforced Bunker": "مخبأ محصن",
};

const MAX_BODYGUARDS = 20;

export default function KillCalculatorPage() {
  const { t, language } = useI18n();
  const [targetRank, setTargetRank] = useState("1");
  const [armorId, setArmorId] = useState("0");
  const [guards, setGuards] = useState("0");
  const [result, setResult] = useState<Calc | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const isAr = language === "ar";

  useEffect(() => {
    if (!alertMsg) return;
    const t = setTimeout(() => setAlertMsg(null), 3000);
    return () => clearTimeout(t);
  }, [alertMsg]);

  const armorQuery = useQuery<ArmorItem[]>({
    queryKey: ["/api/armor"],
    queryFn: async () => {
      const r = await fetch("/api/armor", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load armor");
      return r.json();
    },
  });

  const ranksQuery = useQuery<RanksResponse>({
    queryKey: ["/api/ranks"],
    queryFn: async () => {
      const r = await fetch("/api/ranks", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load ranks");
      return r.json();
    },
  });

  const calc = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        targetRank: Number(targetRank),
        targetGuards: Number(guards),
      };
      if (armorId && armorId !== "0") body.targetArmorId = Number(armorId);
      const r = await fetch("/api/combat/calculate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        const msg = isAr && data.errorAr ? data.errorAr : (data.error ?? "Failed");
        const err = new Error(msg) as Error & { code?: string };
        err.code = data.code;
        throw err;
      }
      return data as Calc;
    },
    onSuccess: (d) => {
      setAlertMsg(null);
      setResult(d);
    },
    onError: (e: Error) => {
      setResult(null);
      setAlertMsg(e.message);
    },
  });

  const selectClass =
    "w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

  const armorLabel = (a: ArmorItem) => {
    const name = isAr ? (ARMOR_NAME_AR[a.name] ?? a.name) : a.name;
    return `${name} (${isAr ? "دفاع" : "DEF"} +${a.defenseBonus})`;
  };

  const rankLabel = (r: RankInfo) =>
    `${r.rankNumber}. ${isAr ? r.nameAr : r.nameEn}`;

  const dirStyle: React.CSSProperties = { direction: isAr ? "rtl" : "ltr" };
  // Force LTR layout for select option lists so dropdown numerals stay Western,
  // but keep text-align matching the page direction so labels read naturally.
  const selectStyle: React.CSSProperties = { direction: "ltr", textAlign: isAr ? "right" : "left" };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="kill-calculator-page">
      <div className="flex items-center gap-3" style={dirStyle}>
        <Crosshair className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-heading font-bold">{t("killCalc.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("killCalc.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle style={dirStyle}>{t("killCalc.target")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3" style={dirStyle}>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("killCalc.targetRank")}</label>
              <select
                value={targetRank}
                onChange={(e) => setTargetRank(e.target.value)}
                className={selectClass}
                data-testid="select-target-rank"
                disabled={ranksQuery.isLoading}
                style={selectStyle}
              >
                {(ranksQuery.data?.ranks ?? Array.from({ length: 12 }, (_, i) => ({
                  rankNumber: i + 1,
                  nameEn: `Rank ${i + 1}`,
                  nameAr: `رتبة ${i + 1}`,
                }))).map((r) => (
                  <option key={r.rankNumber} value={String(r.rankNumber)}>{rankLabel(r)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("killCalc.targetArmor")}</label>
              <select
                value={armorId}
                onChange={(e) => setArmorId(e.target.value)}
                className={selectClass}
                data-testid="select-target-armor"
                disabled={armorQuery.isLoading}
                style={selectStyle}
              >
                <option value="0">{t("killCalc.noArmor")}</option>
                {(armorQuery.data ?? []).map((a) => (
                  <option key={a.id} value={String(a.id)}>{armorLabel(a)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("killCalc.bodyguards")}</label>
              <select
                value={guards}
                onChange={(e) => setGuards(e.target.value)}
                className={selectClass}
                data-testid="select-bodyguards"
                style={selectStyle}
              >
                {Array.from({ length: MAX_BODYGUARDS + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={String(n)}>
                    {n === 0 ? t("killCalc.noGuards") : `${n} ${isAr ? "حارس" : n === 1 ? "guard" : "guards"}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={dirStyle}>
            <Button onClick={() => calc.mutate()} disabled={calc.isPending} data-testid="button-calculate">
              {calc.isPending ? t("common.loading") : t("killCalc.calculate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Center-screen auto-dismiss alert */}
      <AnimatePresence>
        {alertMsg && (
          <motion.div
            key="kc-alert"
            initial={{ opacity: 0, scale: 0.85, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4"
            style={dirStyle}
          >
            <div className="pointer-events-auto bg-red-950/90 backdrop-blur-md border-2 border-red-500/70 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] px-6 py-5 flex items-center gap-3 max-w-md">
              <AlertTriangle className="w-7 h-7 text-red-300 shrink-0" />
              <div className="text-red-50 font-semibold text-base leading-snug">{alertMsg}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {result && (
        <Card data-testid="kill-calculator-result" style={dirStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.canAttack
                ? <Badge className="bg-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" />{t("killCalc.ready")}</Badge>
                : <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{t("killCalc.notReady")}</Badge>}
              <span>{t("killCalc.requirements")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{t("killCalc.attacker")}</div>
                <div>{result.attacker.username} • #{result.attacker.rank}</div>
                <div className="text-muted-foreground">{result.attacker.weaponName} • ATK {result.attacker.totalAtk}</div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{t("killCalc.targetSummary")}</div>
                <div>
                  {result.target.username
                    ?? `${isAr ? "رتبة" : "Rank"} #${result.target.rank}`} • HP {result.target.hp}
                </div>
                <div className="text-muted-foreground">
                  DEF {result.target.totalDef}
                  {result.target.armorName
                    ? ` (${isAr ? (ARMOR_NAME_AR[result.target.armorName] ?? result.target.armorName) : result.target.armorName})`
                    : ""}
                </div>
              </div>
            </div>
            <div className="border-t border-border pt-4 grid gap-2 md:grid-cols-2 text-sm">
              <div>{t("killCalc.damagePerBullet")}: <span className="font-bold text-emerald-300">{result.calculation.damagePerBullet}</span></div>
              <div>{t("killCalc.totalBullets")}: <span className="font-bold">{result.calculation.totalBullets}</span> ({result.calculation.bulletType})</div>
              {result.calculation.bulletsForGuards > 0 && (
                <div>{t("killCalc.bulletsForGuards")}: <span className="font-bold text-amber-300">{result.calculation.bulletsForGuards}</span></div>
              )}
              <div>{t("killCalc.totalCost")}: <span className="font-bold">{formatMoney(result.calculation.totalCost)}</span></div>
              <div>{t("killCalc.youHave")}: <span className="font-bold">{result.availability.availableAmmo}</span></div>
            </div>
            {result.suggestions.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                <div className="text-xs font-semibold text-amber-400">{t("killCalc.suggestions")}</div>
                {result.suggestions.map((s, i) => (
                  <div key={i} className="text-sm flex items-center justify-between bg-amber-900/20 border border-amber-800/50 rounded px-3 py-2">
                    <span>{isAr ? s.messageAr : s.message}</span>
                    {s.cost ? <span className="font-mono text-amber-300">{formatMoney(s.cost)}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
