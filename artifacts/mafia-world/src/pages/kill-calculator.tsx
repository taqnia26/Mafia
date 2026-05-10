import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Crosshair, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

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

export default function KillCalculatorPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [targetRank, setTargetRank] = useState("1");
  const [armorId, setArmorId] = useState("0");
  const [guards, setGuards] = useState("0");
  const [result, setResult] = useState<Calc | null>(null);

  const armorQuery = useQuery<ArmorItem[]>({
    queryKey: ["/api/armor"],
    queryFn: async () => {
      const r = await fetch("/api/armor", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load armor");
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
      if (!r.ok) throw new Error(data.error ?? "Failed");
      return data as Calc;
    },
    onSuccess: setResult,
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const selectClass =
    "w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="kill-calculator-page" style={{ direction: "ltr" }}>
      <div className="flex items-center gap-3" style={{ direction: language === "ar" ? "rtl" : "ltr" }}>
        <Crosshair className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-heading font-bold">{t("killCalc.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("killCalc.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle style={{ direction: language === "ar" ? "rtl" : "ltr" }}>{t("killCalc.target")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3" style={{ direction: language === "ar" ? "rtl" : "ltr" }}>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t("killCalc.targetRank")}</label>
              <select
                value={targetRank}
                onChange={(e) => setTargetRank(e.target.value)}
                className={selectClass}
                data-testid="select-target-rank"
                style={{ direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={String(r)}>{`${t("killCalc.rank")} ${r}`}</option>
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
                style={{ direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
              >
                <option value="0">{t("killCalc.noArmor")}</option>
                {(armorQuery.data ?? []).map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {`${a.name} (DEF +${a.defenseBonus})`}
                  </option>
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
                style={{ direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}
              >
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ direction: language === "ar" ? "rtl" : "ltr" }}>
            <Button onClick={() => calc.mutate()} disabled={calc.isPending} data-testid="button-calculate">
              {calc.isPending ? t("common.loading") : t("killCalc.calculate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid="kill-calculator-result" style={{ direction: language === "ar" ? "rtl" : "ltr" }}>
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
                <div>{result.target.username ?? `Rank #${result.target.rank}`} • HP {result.target.hp}</div>
                <div className="text-muted-foreground">DEF {result.target.totalDef} {result.target.armorName ? `(${result.target.armorName})` : ""}</div>
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
                    <span>{language === "ar" ? s.messageAr : s.message}</span>
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
