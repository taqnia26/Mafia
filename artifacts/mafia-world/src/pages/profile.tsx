import { useGetMyProfile, usePurchaseAntiSpy, getGetMyProfileQueryKey, AntiSpyPurchaseDurationHours } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Shield, Crosshair, Skull, HeartPulse, MapPin, Award, ShieldCheck, ShieldOff, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface RankData {
  rankNumber: number;
  nameEn: string;
  nameAr: string;
  color: string;
}

interface RanksResponse {
  currentRank: number;
  currentRankData: RankData | null;
}

const ANTI_SPY_PLANS: Array<{ hours: 24 | 168 | 720; price: number; labelKey: string }> = [
  { hours: 24, price: 50_000, labelKey: "profile.antiSpyPlan24h" },
  { hours: 168, price: 250_000, labelKey: "profile.antiSpyPlan7d" },
  { hours: 720, price: 750_000, labelKey: "profile.antiSpyPlan30d" },
];

function formatRemaining(ms: number, t: (k: string) => string): string {
  if (ms <= 0) return "0" + t("common.secondsShort");
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}${t("common.daysShort")} ${hours}${t("common.hoursShort")} ${minutes}${t("common.minutesShort")}`;
  if (hours > 0) return `${hours}${t("common.hoursShort")} ${minutes}${t("common.minutesShort")} ${seconds}${t("common.secondsShort")}`;
  return `${minutes}${t("common.minutesShort")} ${seconds}${t("common.secondsShort")}`;
}

export default function Profile() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const { data: ranksData } = useQuery<RanksResponse>({
    queryKey: ["/api/ranks"],
    queryFn: async () => {
      const res = await fetch("/api/ranks", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<RanksResponse>;
    },
    staleTime: 60000,
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const purchaseAntiSpy = usePurchaseAntiSpy({
    mutation: {
      onSuccess: (updatedProfile) => {
        queryClient.setQueryData(getGetMyProfileQueryKey(), updatedProfile);
        const expiry = updatedProfile.antiSpyExpiresAt ? new Date(updatedProfile.antiSpyExpiresAt) : null;
        toast({
          title: t("profile.antiSpyPurchaseSuccess"),
          description: expiry
            ? `${t("profile.antiSpyActiveUntil")}: ${expiry.toLocaleString(language === "ar" ? "ar-EG" : undefined)}`
            : t("profile.antiSpyOn"),
        });
      },
      onError: (err) => {
        const code = (err as { data?: { code?: string } } | null)?.data?.code;
        toast({
          title: t("common.error"),
          description: code === "INSUFFICIENT_FUNDS" ? t("profile.antiSpyInsufficientFunds") : t("profile.antiSpyError"),
          variant: "destructive",
        });
      },
    },
  });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-48 w-full bg-card" /><Skeleton className="h-64 w-full bg-card" /></div>;
  }

  if (!profile) return null;

  const expiresAtMs = profile.antiSpyExpiresAt ? new Date(profile.antiSpyExpiresAt).getTime() : 0;
  const antiSpyActive = expiresAtMs > now;
  const remainingMs = Math.max(0, expiresAtMs - now);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.profile")}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 bg-card border-border">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-secondary border-2 border-primary flex items-center justify-center">
              <User className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-heading uppercase">{profile.username}</h2>
              {profile.isPermanentlyDead && (
                <Badge
                  variant="outline"
                  className="mt-2 border-red-700 bg-red-950/40 text-red-400 flex items-center gap-1"
                  data-testid="badge-dead"
                >
                  <Skull className="w-3 h-3" />
                  {t("dead.badge")}
                </Badge>
              )}
              <p className="text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <MapPin className="w-4 h-4" /> {profile.cityName}
              </p>
              {ranksData?.currentRankData && (
                <Link href="/ranks">
                  <Badge
                    variant="outline"
                    className="mt-2 cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                    style={{ borderColor: ranksData.currentRankData.color, color: ranksData.currentRankData.color }}
                  >
                    <Award className="w-3 h-3" />
                    {language === "ar" ? ranksData.currentRankData.nameAr : ranksData.currentRankData.nameEn}
                    <span className="text-xs opacity-60">#{ranksData.currentRank}</span>
                  </Badge>
                </Link>
              )}
            </div>

            <div className="w-full pt-4 border-t border-border/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{t("common.level")} {profile.level}</span>
                <span className="text-sm text-muted-foreground">{profile.xp.toLocaleString()} {t("dashboard.xp")}</span>
              </div>
              <Progress value={75} className="h-2 bg-secondary" indicatorClassName="bg-primary" />
            </div>

            {profile.gangName && (
              <div className="w-full pt-4 border-t border-border/50">
                <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                  <p className="text-muted-foreground">{t("profile.gangAffiliation")}</p>
                  <p className="font-bold text-primary">{profile.gangName}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{profile.gangRank}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <Crosshair className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">{t("profile.attackPower")}</p>
                  <p className="text-2xl font-mono font-bold">{profile.attackPower.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">{t("profile.defensePower")}</p>
                  <p className="text-2xl font-mono font-bold">{profile.defensePower.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <Skull className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">{t("common.kills")}</p>
                  <p className="text-2xl font-mono font-bold">{profile.killCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <HeartPulse className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">{t("common.deaths")}</p>
                  <p className="text-2xl font-mono font-bold">{profile.deathCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border" data-testid="card-anti-spy">
            <CardHeader>
              <CardTitle className="font-heading uppercase tracking-wider text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                {t("profile.antiSpyProtection")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border ${
                  antiSpyActive
                    ? "bg-emerald-950/30 border-emerald-800/50"
                    : "bg-secondary/30 border-border/50"
                }`}
                data-testid="status-anti-spy"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {antiSpyActive ? (
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ShieldOff className="w-8 h-8 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-bold uppercase tracking-wider text-sm">
                      {antiSpyActive ? t("profile.antiSpyStatusActive") : t("profile.antiSpyStatusInactive")}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("profile.antiSpyProtectionDesc")}</p>
                  </div>
                </div>
                {antiSpyActive && (
                  <div className="sm:text-right">
                    <p className="text-xs text-muted-foreground flex items-center sm:justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {t("profile.antiSpyTimeRemaining")}
                    </p>
                    <p className="font-mono text-lg font-bold text-emerald-400" data-testid="text-anti-spy-countdown">
                      {formatRemaining(remainingMs, t)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-3 uppercase tracking-wider text-muted-foreground">
                  {antiSpyActive ? t("profile.antiSpyExtend") : t("profile.antiSpyBuy")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {ANTI_SPY_PLANS.map((plan) => {
                    const canAfford = profile.money >= plan.price;
                    const isPending = purchaseAntiSpy.isPending && purchaseAntiSpy.variables?.data.durationHours === plan.hours;
                    return (
                      <button
                        key={plan.hours}
                        type="button"
                        disabled={!canAfford || purchaseAntiSpy.isPending}
                        onClick={() =>
                          purchaseAntiSpy.mutate({
                            data: { durationHours: plan.hours as AntiSpyPurchaseDurationHours },
                          })
                        }
                        data-testid={`button-anti-spy-${plan.hours}`}
                        className={`flex flex-col items-center justify-center gap-1 p-4 rounded-lg border transition-all ${
                          canAfford
                            ? "bg-secondary/50 border-border hover:border-primary hover:bg-secondary cursor-pointer"
                            : "bg-secondary/20 border-border/30 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <span className="text-base font-heading font-bold uppercase">{t(plan.labelKey)}</span>
                        <span className="text-lg font-mono font-bold text-primary">
                          ${plan.price.toLocaleString()}
                        </span>
                        {!canAfford && (
                          <span className="text-xs text-destructive">{t("properties.cannotAfford")}</span>
                        )}
                        {isPending && (
                          <span className="text-xs text-muted-foreground">{t("common.loading")}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
