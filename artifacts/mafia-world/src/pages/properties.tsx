import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiError } from "@/lib/apiError";
import {
  Building2, Home, Wrench, Music, FlaskConical, Zap, Shield,
  Dice6, Cross, Landmark, TrendingUp, DollarSign, Lock, ArrowUp,
  Coins, Atom, AlertTriangle, Hammer,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PropertyType {
  id: number;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: number;
  baseIncomePerHour: number;
  requiredLevel: number;
  maxLevel: number;
  icon: string;
  perksEn: string;
  perksAr: string;
  ownedCount: number;
  canAfford: boolean;
  levelMet: boolean;
  rankSlotAvailable: boolean;
  maxProperties: number;
  totalOwned: number;
  isReactor: boolean;
}

interface ReactorState {
  energyUnits: number;
  energyCap: number;
  integrity: number;
  isUnderConstruction: boolean;
  constructionCompleteAt: string;
  lastPayoutAt: string;
  energyPerHour: number;
  moneyPerEnergy: number;
  cityId: number;
  nextPayoutAt: string;
}

interface PlayerProperty {
  id: number;
  level: number;
  purchasedAt: string;
  lastIncomeCollectedAt: string;
  typeId: number | null;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  perksEn: string;
  perksAr: string;
  incomePerHour: number;
  nextLevelIncome: number | null;
  upgradePrice: number | null;
  maxLevel: number;
  pendingIncome: number;
  canCollect: boolean;
  isReactor: boolean;
  reactor: ReactorState | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  wrench: Wrench,
  music: Music,
  "flask-conical": FlaskConical,
  zap: Zap,
  shield: Shield,
  "dice-6": Dice6,
  cross: Cross,
  landmark: Landmark,
  building: Building2,
  atom: Atom,
};

function formatCountdown(targetIso: string): string {
  const ms = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function PropertyIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = ICON_MAP[icon] ?? Building2;
  return <IconComponent className={className} />;
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function Properties() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [upgradingId, setUpgradingId] = useState<number | null>(null);

  const { data: types, isLoading: typesLoading } = useQuery<PropertyType[]>({
    queryKey: ["property-types"],
    queryFn: async () => {
      const res = await fetch("/api/properties/types", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<PropertyType[]>;
    },
  });

  const { data: myProps, isLoading: myLoading } = useQuery<PlayerProperty[]>({
    queryKey: ["my-properties"],
    queryFn: async () => {
      const res = await fetch("/api/properties/my", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<PlayerProperty[]>;
    },
    refetchInterval: 60000,
  });

  const buyMutation = useMutation({
    mutationFn: async (propertyTypeId: number) => {
      const res = await fetch("/api/properties/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyTypeId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-types"] });
      queryClient.invalidateQueries({ queryKey: ["my-properties"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: t("properties.buySuccess"), description: t("properties.buySuccessDesc") });
      setBuyingId(null);
    },
    onError: (err: Error) => {
      toast({ title: t("properties.buyFailed"), description: err.message, variant: "destructive" });
      setBuyingId(null);
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      const res = await fetch(`/api/properties/${propertyId}/upgrade`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-properties"] });
      queryClient.invalidateQueries({ queryKey: ["property-types"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: t("properties.upgradeSuccess"), description: t("properties.upgradeSuccessDesc") });
      setUpgradingId(null);
    },
    onError: (err: Error) => {
      toast({ title: t("properties.upgradeFailed"), description: err.message, variant: "destructive" });
      setUpgradingId(null);
    },
  });

  const reactorCollectMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      const res = await fetch(`/api/properties/reactor/${propertyId}/collect`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      return res.json() as Promise<{ success: boolean; money: number; energyConverted: number; hoursCollected: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-properties"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["layout-player-rank"] });
      toast({
        title: t("properties.reactor.collectSuccess"),
        description: `+${formatMoney(data.money)} (${data.energyConverted} energy units)`,
      });
    },
    onError: (err: Error) => {
      toast({ title: t("properties.collectFailed"), description: err.message, variant: "destructive" });
    },
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/properties/collect", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      return res.json() as Promise<{ success: boolean; totalIncome: number; propertiesCount: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-properties"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["layout-player-rank"] });
      toast({
        title: t("properties.collectSuccess"),
        description: `+${formatMoney(data.totalIncome)} from ${data.propertiesCount} properties`,
      });
    },
    onError: (err: Error) => {
      toast({ title: t("properties.collectFailed"), description: err.message, variant: "destructive" });
    },
  });

  // Summary cards / "Collect All" exclude reactors — reactors have their own dedicated card.
  const nonReactorProps = myProps?.filter(p => !p.isReactor) ?? [];
  const reactorProps = myProps?.filter(p => p.isReactor && p.reactor) ?? [];
  const totalPending = nonReactorProps.reduce((sum, p) => sum + p.pendingIncome, 0);
  const totalPerHour = nonReactorProps.reduce((sum, p) => sum + p.incomePerHour, 0);
  const firstType = types?.[0];
  const maxProperties = firstType?.maxProperties ?? 0;
  const totalOwned = firstType?.totalOwned ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          {t("properties.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("properties.subtitle")}</p>
      </div>

      {reactorProps.length > 0 && (
        <div className="space-y-3">
          {reactorProps.map(p => {
            const r = p.reactor!;
            const integrityColor = r.integrity > 60 ? "text-green-400"
              : r.integrity > 30 ? "text-yellow-400" : "text-red-400";
            const energyPct = Math.min(100, Math.round((r.energyUnits / r.energyCap) * 100));
            const isCollecting = reactorCollectMutation.isPending && reactorCollectMutation.variables === p.id;
            return (
              <Card key={`reactor-${p.id}`}
                className="bg-gradient-to-br from-yellow-500/10 via-card to-card border-yellow-500/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <Atom className="w-7 h-7 text-yellow-400 animate-pulse" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-heading flex items-center gap-2">
                          {language === "ar" ? p.nameAr : p.nameEn}
                          {r.isUnderConstruction ? (
                            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40">
                              <Hammer className="w-3 h-3 mr-1" />
                              {t("properties.reactor.constructing")}
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-300 border-green-500/40">
                              {t("properties.reactor.constructionDone")}
                            </Badge>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("properties.reactor.subtitle")}
                        </p>
                      </div>
                    </div>
                    {!r.isUnderConstruction && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{t("properties.pendingIncome")}</div>
                        <div className="text-yellow-400 font-bold text-lg">{formatMoney(p.pendingIncome)}</div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-2">
                  {r.isUnderConstruction ? (
                    <div className="flex items-center justify-between p-3 rounded bg-orange-500/10 border border-orange-500/30">
                      <span className="text-sm text-orange-300 flex items-center gap-2">
                        <Hammer className="w-4 h-4" />
                        {t("properties.reactor.constructionEta")}
                      </span>
                      <span className="font-mono font-bold text-orange-200">
                        {formatCountdown(r.constructionCompleteAt)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 text-yellow-400" />
                            {t("properties.reactor.energy")}
                          </span>
                          <span className="font-mono">{r.energyUnits} / {r.energyCap}</span>
                        </div>
                        <Progress value={energyPct} className="h-2" />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-yellow-500/5 border border-yellow-500/20 text-xs">
                        <span className="text-yellow-300/80 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          {t("properties.reactor.nextPayout")}
                        </span>
                        <span className="font-mono font-bold text-yellow-200">
                          {formatCountdown(r.nextPayoutAt)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        {t("properties.reactor.integrity")}
                      </span>
                      <span className={`font-mono font-bold ${integrityColor}`}>{r.integrity}%</span>
                    </div>
                    <Progress value={r.integrity} className="h-2" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <div>{t("properties.reactor.energyPerHour")}</div>
                      <div className="text-foreground font-medium">{r.energyPerHour}</div>
                    </div>
                    <div>
                      <div>{t("properties.reactor.pricePerEnergy")}</div>
                      <div className="text-foreground font-medium">{formatMoney(r.moneyPerEnergy)}</div>
                    </div>
                    <div>
                      <div>{t("properties.reactor.cap")}</div>
                      <div className="text-foreground font-medium">{r.energyCap}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{t("properties.reactor.meltdownWarning")}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                    disabled={r.isUnderConstruction || p.pendingIncome <= 0 || isCollecting}
                    onClick={() => reactorCollectMutation.mutate(p.id)}
                  >
                    <Coins className="w-4 h-4 mr-1" />
                    {isCollecting
                      ? t("properties.reactor.collecting")
                      : `${t("properties.reactor.collect")} — ${formatMoney(p.pendingIncome)}`}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {myProps && myProps.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{t("properties.owned")}</div>
              <div className="text-2xl font-bold text-foreground">{totalOwned}</div>
              <div className="text-xs text-muted-foreground">/ {maxProperties} {t("properties.slots")}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{t("common.money")}{t("properties.incomePerHour")}</div>
              <div className="text-2xl font-bold text-green-400">{formatMoney(totalPerHour)}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{t("properties.pendingIncome")}</div>
              <div className="text-2xl font-bold text-yellow-400">{formatMoney(totalPending)}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="text-xs text-muted-foreground mb-2">{t("properties.collectAll")}</div>
              <Button
                size="sm"
                disabled={totalPending === 0 || collectMutation.isPending}
                onClick={() => collectMutation.mutate()}
                className="w-full"
              >
                <Coins className="w-4 h-4 mr-1" />
                {collectMutation.isPending ? t("properties.collecting") : t("properties.collect")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="shop">
        <TabsList>
          <TabsTrigger value="shop">{t("properties.shop")}</TabsTrigger>
          <TabsTrigger value="my">
            {t("properties.myProperties")}
            {myProps && myProps.length > 0 && (
              <Badge variant="secondary" className="ml-2">{myProps.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="mt-4">
          {maxProperties === 0 && !typesLoading && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
              <Lock className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-300">{t("properties.rankLimit")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("properties.rankLimitDesc")}</p>
              </div>
            </div>
          )}

          {typesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {types?.map(pt => {
                const isBuying = buyingId === pt.id && buyMutation.isPending;
                const locked = !pt.levelMet;
                const noSlots = !pt.rankSlotAvailable;
                const cantAfford = !pt.canAfford;

                let disabledReason = "";
                if (locked) disabledReason = `${t("properties.requiredLevel")} ${pt.requiredLevel}`;
                else if (noSlots) disabledReason = t("properties.noSlots");
                else if (cantAfford) disabledReason = t("properties.cannotAfford");

                return (
                  <Card
                    key={pt.id}
                    className={`bg-card border-border transition-all ${locked ? "opacity-60" : "hover:border-primary/40"}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                            <PropertyIcon icon={pt.icon} className="w-5 h-5 text-primary" />
                          </div>
                          <CardTitle className="text-sm font-heading">
                            {language === "ar" ? pt.nameAr : pt.nameEn}
                          </CardTitle>
                        </div>
                        {pt.ownedCount > 0 && (
                          <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                            {pt.ownedCount}x {t("properties.owned")}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-2 pb-2">
                      <p>{language === "ar" ? pt.descriptionAr : pt.descriptionEn}</p>
                      <div className="grid grid-cols-2 gap-1 pt-1">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-green-400 font-medium">
                            {formatMoney(pt.baseIncomePerHour)}{t("properties.incomePerHour")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-yellow-400 font-medium">{formatMoney(pt.price)}</span>
                        </div>
                      </div>
                      <div className="text-muted-foreground/70">
                        {t("properties.requiredLevel")}: {pt.requiredLevel} &bull; Max Lv.{pt.maxLevel}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                      {disabledReason ? (
                        <div className="w-full text-center text-xs text-muted-foreground py-1 px-2 rounded bg-secondary/30">
                          {locked && <Lock className="w-3 h-3 inline mr-1" />}
                          {disabledReason}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={isBuying}
                          onClick={() => {
                            setBuyingId(pt.id);
                            buyMutation.mutate(pt.id);
                          }}
                        >
                          {isBuying ? t("properties.buying") : `${t("properties.buy")} — ${formatMoney(pt.price)}`}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="mt-4">
          {myLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : nonReactorProps.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t("properties.noProperties")}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {nonReactorProps.map(prop => {
                const isUpgrading = upgradingId === prop.id && upgradeMutation.isPending;
                const maxed = prop.level >= prop.maxLevel;

                return (
                  <Card key={prop.id} className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                            <PropertyIcon icon={prop.icon} className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-heading">
                              {language === "ar" ? prop.nameAr : prop.nameEn}
                            </CardTitle>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="outline"
                                className={`text-xs ${maxed ? "border-yellow-500/50 text-yellow-400" : "border-primary/40 text-primary"}`}
                              >
                                {t("properties.level")} {prop.level}
                                {maxed && ` (${t("properties.maxLevel")})`}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">{t("properties.incomePerHour")}</div>
                          <div className="text-green-400 font-bold text-sm">{formatMoney(prop.incomePerHour)}</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2 space-y-2">
                      {prop.pendingIncome > 0 && (
                        <div className="flex items-center justify-between text-xs bg-yellow-500/10 border border-yellow-500/20 rounded px-2.5 py-1.5">
                          <span className="text-yellow-300 flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5" />
                            {t("properties.pendingIncome")}
                          </span>
                          <span className="font-bold text-yellow-400">{formatMoney(prop.pendingIncome)}</span>
                        </div>
                      )}
                      {!maxed && prop.upgradePrice !== null && (
                        <div className="text-xs text-muted-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <ArrowUp className="w-3 h-3" />
                            {t("properties.nextLevel")}: {formatMoney(prop.nextLevelIncome ?? 0)}{t("properties.incomePerHour")}
                          </span>
                          <span className="text-muted-foreground">
                            {t("properties.upgradeCost")}: {formatMoney(prop.upgradePrice)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="pt-0 flex gap-2">
                      {!maxed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-primary/30 text-primary hover:bg-primary/10"
                          disabled={isUpgrading}
                          onClick={() => {
                            setUpgradingId(prop.id);
                            upgradeMutation.mutate(prop.id);
                          }}
                        >
                          <ArrowUp className="w-3.5 h-3.5 mr-1" />
                          {isUpgrading ? t("properties.upgrading") : `${t("properties.upgrade")} — ${formatMoney(prop.upgradePrice ?? 0)}`}
                        </Button>
                      )}
                      {maxed && (
                        <div className="flex-1 text-center text-xs text-yellow-400 py-1.5 font-medium">
                          ✓ {t("properties.maxLevel")}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
