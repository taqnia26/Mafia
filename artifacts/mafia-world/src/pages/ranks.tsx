import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Lock,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Shield,
  Star,
  TrendingUp,
  Skull,
  DollarSign,
  Zap,
  Target,
  Hand,
  Hammer,
  Bird,
  Crown,
  Gem,
  Diamond,
  Flame,
  Swords,
  type LucideIcon,
} from "lucide-react";

const RANK_ICONS: Record<string, LucideIcon> = {
  rat: Target,
  fist: Hand,
  star: Star,
  hammer: Hammer,
  shield: Shield,
  eagle: Bird,
  crown: Crown,
  king: Crown,
  pasha: Gem,
  pasha2: Diamond,
  legend: Flame,
  emperor: Swords,
};

interface RankData {
  id: number;
  rankNumber: number;
  nameEn: string;
  nameAr: string;
  subtitleEn: string;
  subtitleAr: string;
  requiredLevel: number;
  requiredMoney: number;
  requiredXp: number;
  requiredKills: number;
  atkBonus: number;
  defBonus: number;
  color: string;
  icon: string;
  perksEn: string;
  perksAr: string;
  isCurrentRank: boolean;
  isNextRank: boolean;
  canUpgrade: boolean;
  missingRequirements: string[];
  unlocked: boolean;
}

interface RanksResponse {
  ranks: RankData[];
  currentRank: number;
  currentRankData: RankData | null;
  nextRank: RankData | null;
  player: {
    level: number;
    money: number;
    xp: number;
    killCount: number;
  };
}

async function fetchRanks(): Promise<RanksResponse> {
  const res = await fetch("/api/ranks", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch ranks");
  return res.json() as Promise<RanksResponse>;
}

async function upgradeRank(): Promise<{ success: boolean; newRankName: string; newRankNameAr: string; atkIncrease: number; defIncrease: number }> {
  const res = await fetch("/api/ranks/upgrade", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? "Upgrade failed");
  }
  return res.json() as Promise<{ success: boolean; newRankName: string; newRankNameAr: string; atkIncrease: number; defIncrease: number }>;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatXp(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function Ranks() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRank, setSelectedRank] = useState<RankData | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/ranks"],
    queryFn: fetchRanks,
    refetchInterval: 30000,
  });

  const upgradeMutation = useMutation({
    mutationFn: upgradeRank,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/ranks"] });
      const rankName = language === "ar" ? result.newRankNameAr : result.newRankName;
      toast({
        title: t("ranks.upgradeSuccess"),
        description: `${rankName} — +${result.atkIncrease} ATK, +${result.defIncrease} DEF`,
        className: "bg-green-900 border-green-500",
      });
    },
    onError: (err: Error) => {
      toast({ title: t("ranks.upgradeFailed"), description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full bg-card" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full bg-card" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { ranks, currentRank, currentRankData, nextRank, player } = data;
  const displayRank = selectedRank ?? currentRankData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-heading font-bold uppercase tracking-wider flex items-center gap-2">
            <Award className="w-8 h-8 text-primary" />
            {t("ranks.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("ranks.subtitle")}</p>
        </div>
        {currentRankData && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2">
            <span className="text-sm text-muted-foreground">{t("ranks.currentRank")}:</span>
            <span className="font-bold font-heading uppercase tracking-wide" style={{ color: currentRankData.color }}>
              {language === "ar" ? currentRankData.nameAr : currentRankData.nameEn}
            </span>
            <Badge variant="outline" className="text-xs" style={{ borderColor: currentRankData.color, color: currentRankData.color }}>
              #{currentRank}
            </Badge>
          </div>
        )}
      </div>

      {nextRank && (
        <Card className="bg-card border-border border-primary/30" style={{ borderColor: nextRank.color + "40" }}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="space-y-2 flex-1">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">{t("ranks.nextRank")}</p>
                <h2 className="text-2xl font-heading font-bold uppercase tracking-wide" style={{ color: nextRank.color }}>
                  {language === "ar" ? nextRank.nameAr : nextRank.nameEn}
                </h2>
                <p className="text-muted-foreground text-sm">{language === "ar" ? nextRank.subtitleAr : nextRank.subtitleEn}</p>
                <div className="space-y-2 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="w-3 h-3" /> {t("ranks.reqLevel")}</span>
                      <span className={player.level >= nextRank.requiredLevel ? "text-green-400" : "text-red-400"}>
                        {player.level} / {nextRank.requiredLevel}
                      </span>
                    </div>
                    <Progress value={Math.min(100, (player.level / nextRank.requiredLevel) * 100)} className="h-1.5 bg-secondary" indicatorClassName={player.level >= nextRank.requiredLevel ? "bg-green-500" : "bg-primary"} />
                  </div>
                  {nextRank.requiredMoney > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground"><DollarSign className="w-3 h-3" /> {t("ranks.reqMoney")}</span>
                        <span className={player.money >= nextRank.requiredMoney ? "text-green-400" : "text-red-400"}>
                          {formatMoney(player.money)} / {formatMoney(nextRank.requiredMoney)}
                        </span>
                      </div>
                      <Progress value={Math.min(100, (player.money / nextRank.requiredMoney) * 100)} className="h-1.5 bg-secondary" indicatorClassName={player.money >= nextRank.requiredMoney ? "bg-green-500" : "bg-yellow-500"} />
                    </div>
                  )}
                  {nextRank.requiredXp > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground"><Zap className="w-3 h-3" /> {t("ranks.reqXp")}</span>
                        <span className={player.xp >= nextRank.requiredXp ? "text-green-400" : "text-red-400"}>
                          {formatXp(player.xp)} / {formatXp(nextRank.requiredXp)}
                        </span>
                      </div>
                      <Progress value={Math.min(100, (player.xp / nextRank.requiredXp) * 100)} className="h-1.5 bg-secondary" indicatorClassName={player.xp >= nextRank.requiredXp ? "bg-green-500" : "bg-blue-500"} />
                    </div>
                  )}
                  {nextRank.requiredKills > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground"><Skull className="w-3 h-3" /> {t("ranks.reqKills")}</span>
                        <span className={player.killCount >= nextRank.requiredKills ? "text-green-400" : "text-red-400"}>
                          {player.killCount} / {nextRank.requiredKills}
                        </span>
                      </div>
                      <Progress value={Math.min(100, (player.killCount / nextRank.requiredKills) * 100)} className="h-1.5 bg-secondary" indicatorClassName={player.killCount >= nextRank.requiredKills ? "bg-green-500" : "bg-red-500"} />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="flex gap-4 text-center">
                  <div className="bg-secondary/50 rounded-lg px-4 py-2">
                    <p className="text-xs text-muted-foreground">{t("ranks.atkBonus")}</p>
                    <p className="text-xl font-mono font-bold text-orange-400">+{nextRank.atkBonus}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg px-4 py-2">
                    <p className="text-xs text-muted-foreground">{t("ranks.defBonus")}</p>
                    <p className="text-xl font-mono font-bold text-blue-400">+{nextRank.defBonus}</p>
                  </div>
                </div>
                <Button
                  className="w-full font-heading uppercase tracking-wider"
                  disabled={!nextRank.canUpgrade || upgradeMutation.isPending}
                  onClick={() => upgradeMutation.mutate()}
                  style={nextRank.canUpgrade ? { background: nextRank.color } : {}}
                >
                  {upgradeMutation.isPending ? t("ranks.upgrading") : t("ranks.upgrade")}
                  {!upgradeMutation.isPending && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
                {!nextRank.canUpgrade && nextRank.missingRequirements.length > 0 && (
                  <p className="text-xs text-red-400 text-center">{t("ranks.missing")}: {nextRank.missingRequirements[0]}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentRank >= 12 && (
        <Card className="bg-card border-primary/50">
          <CardContent className="p-6 text-center space-y-2">
            <Star className="w-12 h-12 text-yellow-400 mx-auto" />
            <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-yellow-400">{t("ranks.maxRank")}</h2>
            <p className="text-muted-foreground">{t("ranks.maxRankDesc")}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-heading font-bold uppercase tracking-wider mb-4">{t("ranks.allRanks")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ranks.map((rank) => {
            const isActive = rank.isCurrentRank;
            const isNext = rank.isNextRank;
            const isLocked = !rank.unlocked && !rank.isNextRank;

            return (
              <Card
                key={rank.rankNumber}
                className={`bg-card cursor-pointer transition-all border ${
                  isActive
                    ? "border-2"
                    : isNext
                    ? "border-dashed"
                    : isLocked
                    ? "border-border/40 opacity-60"
                    : "border-border hover:border-border/80"
                }`}
                style={{
                  borderColor: isActive || isNext ? rank.color : undefined,
                }}
                onClick={() => setSelectedRank(selectedRank?.rankNumber === rank.rankNumber ? null : rank)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const RankIcon = RANK_ICONS[rank.icon] ?? Award;
                        return (
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: isLocked ? "#374151" : rank.color + "30", color: isLocked ? "#6b7280" : rank.color }}
                          >
                            <RankIcon className="w-3.5 h-3.5" />
                          </span>
                        );
                      })()}
                      <span className="font-heading font-bold uppercase tracking-wide text-sm" style={{ color: isLocked ? undefined : rank.color }}>
                        {language === "ar" ? rank.nameAr : rank.nameEn}
                      </span>
                    </div>
                    {isActive ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : isLocked ? (
                      <Lock className="w-4 h-4 text-muted-foreground/50" />
                    ) : isNext ? (
                      <ChevronRight className="w-4 h-4" style={{ color: rank.color }} />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                    {language === "ar" ? rank.subtitleAr : rank.subtitleEn}
                  </p>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1 text-orange-400">
                      <Crosshair className="w-3 h-3" /> +{rank.atkBonus}
                    </span>
                    <span className="flex items-center gap-1 text-blue-400">
                      <Shield className="w-3 h-3" /> +{rank.defBonus}
                    </span>
                    {rank.requiredMoney > 0 && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="w-3 h-3" /> {formatMoney(rank.requiredMoney)}
                      </span>
                    )}
                  </div>

                  {selectedRank?.rankNumber === rank.rankNumber && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("ranks.requirements")}</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("ranks.reqLevel")}</span>
                          <span className={player.level >= rank.requiredLevel ? "text-green-400" : "text-red-400"}>{rank.requiredLevel}</span>
                        </div>
                        {rank.requiredMoney > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("ranks.reqMoney")}</span>
                            <span className={player.money >= rank.requiredMoney ? "text-green-400" : "text-red-400"}>{formatMoney(rank.requiredMoney)}</span>
                          </div>
                        )}
                        {rank.requiredXp > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("ranks.reqXp")}</span>
                            <span className={player.xp >= rank.requiredXp ? "text-green-400" : "text-red-400"}>{formatXp(rank.requiredXp)}</span>
                          </div>
                        )}
                        {rank.requiredKills > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("ranks.reqKills")}</span>
                            <span className={player.killCount >= rank.requiredKills ? "text-green-400" : "text-red-400"}>{rank.requiredKills}</span>
                          </div>
                        )}
                        {rank.requiredMoney === 0 && rank.requiredXp === 0 && rank.requiredKills === 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("ranks.reqMoney")}</span>
                            <span className="text-green-400">{t("ranks.free")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
