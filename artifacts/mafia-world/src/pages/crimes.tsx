import { useListCrimes, useAttemptCrime, useGetCrimeHistory, getListCrimesQueryKey, getGetCrimeHistoryQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Briefcase, DollarSign, Clock, ShieldAlert, Lock, Star, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { getApiError } from "@/lib/apiError";
import { PageBanner } from "@/components/PageBanner";
import { useEffect, useRef, useState } from "react";

function CooldownTimer({ endsAt, t, onExpire }: { endsAt: string; t: (key: string) => string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(endsAt).getTime() - Date.now()));
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const interval = setInterval(() => {
      const left = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hs = t("common.hoursShort");
  const ms = t("common.minutesShort");
  const ss = t("common.secondsShort");

  let timeStr: string;
  if (hours > 0) timeStr = `${hours}${hs} ${minutes}${ms}`;
  else if (minutes > 0) timeStr = `${minutes}${ms} ${seconds}${ss}`;
  else timeStr = `${seconds}${ss}`;

  return <span className="font-mono">{timeStr} {t("crimes.remaining")}</span>;
}

function SuccessRateBar({ rate, t }: { rate: number; t: (key: string) => string }) {
  const color =
    rate >= 70 ? "bg-green-500" :
    rate >= 50 ? "bg-yellow-500" :
    rate >= 35 ? "bg-orange-500" :
    "bg-red-500";

  const textColor =
    rate >= 70 ? "text-green-400" :
    rate >= 50 ? "text-yellow-400" :
    rate >= 35 ? "text-orange-400" :
    "text-red-400";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t("crimes.successRateLabel")}</span>
        <span className={`font-mono font-bold ${textColor}`}>{rate}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

export default function Crimes() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: crimes, isLoading, refetch: refetchCrimes } = useListCrimes({ query: { queryKey: getListCrimesQueryKey() } });
  const { data: history, isLoading: isHistoryLoading } = useGetCrimeHistory({ query: { queryKey: getGetCrimeHistoryQueryKey() } });

  const playerLevel = crimes?.find(c => c.playerLevel !== undefined)?.playerLevel ?? 1;

  const attemptCrime = useAttemptCrime({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListCrimesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCrimeHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });

        if (result.success) {
          toast({
            title: t("crimes.crimeSuccess"),
            description: `+$${(result.moneyEarned ?? 0).toLocaleString()} | +${result.xpEarned ?? 0} ${t("common.xpAbbr")}`,
            className: "bg-green-900 border-green-500 text-white",
          });

          if (result.leveledUp && result.newLevel) {
            const unlocked = result.unlockedCrimes ?? [];
            const unlockedText = unlocked.length > 0
              ? `${t("crimes.unlockedPrefix")} ${unlocked.join(", ")}`
              : t("crimes.levelUpDesc");

            setTimeout(() => {
              toast({
                title: `${t("crimes.levelUp")} ${t("common.level")} ${result.newLevel}`,
                description: unlockedText,
                className: "bg-yellow-900 border-yellow-500 text-white",
              });
            }, 600);
          }
        } else if (result.caught) {
          toast({
            title: t("crimes.busted"),
            description: result.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: t("crimes.youEscaped"),
            description: t("crimes.escapedDesc"),
            variant: "destructive",
          });
        }
      },
      onError: (err: unknown) => {
        toast({
          title: t("crimes.cannotAttempt"),
          description: getApiError(err),
          variant: "destructive",
        });
      },
    },
  });

  return (
    <div className="space-y-8">
      <PageBanner image="/images/banners/crimes.png" title={t("nav.crimes")} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading uppercase text-muted-foreground">{t("crimes.available")}</h2>
            <Badge variant="outline" className="font-mono text-xs">
              {t("common.level")} {playerLevel}
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full bg-card" />
              <Skeleton className="h-40 w-full bg-card" />
              <Skeleton className="h-40 w-full bg-card" />
            </div>
          ) : crimes?.map((crime) => {
            const isLocked = crime.locked;
            const isOnCooldown = crime.onCooldown;
            const canAttempt = !isLocked && !isOnCooldown && !attemptCrime.isPending;

            return (
              <div key={crime.id} className="relative">
                <Card className={`bg-card border-border overflow-hidden transition-all ${
                  isLocked ? "opacity-60 border-border/30" : "hover:border-primary/50"
                }`}>
                  {isLocked && (
                    <div className="absolute inset-0 z-10 backdrop-blur-[2px] bg-background/40 flex items-center justify-center rounded-lg">
                      <div className="flex flex-col items-center gap-2 text-center px-4">
                        <div className="bg-secondary/80 rounded-full p-3">
                          <Lock className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {t("crimes.requiresLevel")} {crime.requiredLevel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {crime.requiredLevel - playerLevel} {t("crimes.morelevelsNeeded")}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row">
                    <div className="p-5 flex-1 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-bold font-heading uppercase break-words">{crime.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("common.level")} {crime.requiredLevel} {t("crimes.levelRequired")}
                          </p>
                        </div>
                        {!isLocked && (
                          <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary/80 shrink-0">
                            {t("crimes.lvlBadge")} {crime.requiredLevel}+
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">{crime.description}</p>

                      <SuccessRateBar rate={crime.successRate} t={t} />

                      <div className="flex flex-wrap gap-3 text-sm pt-1">
                        <div className="flex items-center gap-1.5 text-green-400">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span className="font-mono text-xs">${crime.minReward.toLocaleString()} – ${crime.maxReward.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-blue-400">
                          <Star className="w-3.5 h-3.5" />
                          <span className="font-mono text-xs">+{crime.xpReward} {t("common.xpAbbr")}</span>
                        </div>
                        {crime.prisonTimeHours > 0 && (
                          <div className="flex items-center gap-1.5 text-destructive/80">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span className="font-mono text-xs">{crime.prisonTimeHours}{t("common.hoursShort")} {t("crimes.prisonRiskLabel")}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-secondary/20 p-4 sm:p-5 flex flex-col justify-center items-center border-t sm:border-t-0 sm:border-l border-border/50 sm:w-44 gap-3">
                      {isLocked ? (
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Lock className="w-5 h-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {t("common.level")} {crime.requiredLevel}
                          </span>
                        </div>
                      ) : isOnCooldown && crime.cooldownEndsAt ? (
                        <div className="flex flex-col items-center gap-2 text-center w-full">
                          <Clock className="w-5 h-5 text-primary/60" />
                          <p className="text-xs text-muted-foreground">
                            <CooldownTimer
                              endsAt={crime.cooldownEndsAt}
                              t={t}
                              onExpire={() => {
                                queryClient.invalidateQueries({ queryKey: getListCrimesQueryKey() });
                                refetchCrimes();
                              }}
                            />
                          </p>
                          <Button className="w-full font-heading tracking-widest uppercase text-xs" disabled size="sm">
                            {t("crimes.onCooldown")}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            className="w-full font-heading tracking-widest uppercase"
                            onClick={() => attemptCrime.mutate({ data: { crimeTypeId: crime.id } })}
                            disabled={!canAttempt}
                          >
                            {t("crimes.attempt")}
                          </Button>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {crime.cooldownMinutes}{t("common.minutesShort")} {t("crimes.cooldownLabel")}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>

        <div>
          <Card className="bg-card border-border sticky top-4">
            <CardHeader>
              <CardTitle className="font-heading uppercase tracking-wider text-lg flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                {t("crimes.rapSheet")}
              </CardTitle>
              <CardDescription>{t("crimes.rapSheetDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isHistoryLoading ? (
                <div className="p-4 space-y-4">
                  <Skeleton className="h-16 w-full bg-secondary" />
                  <Skeleton className="h-16 w-full bg-secondary" />
                </div>
              ) : history && history.length > 0 ? (
                <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
                  {history.map((record) => (
                    <div key={record.id} className="p-4 flex gap-3">
                      <div className={`mt-0.5 p-2 rounded-full h-fit shrink-0 ${
                        record.success
                          ? "bg-green-500/10 text-green-500"
                          : record.caught
                          ? "bg-destructive/10 text-destructive"
                          : "bg-orange-500/10 text-orange-500"
                      }`}>
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{record.crimeName}</p>
                        {record.success ? (
                          <p className="text-xs text-green-400 mt-1 font-mono">
                            +${(record.moneyEarned ?? 0).toLocaleString()} &bull; +{record.xpEarned ?? 0} {t("common.xpAbbr")}
                          </p>
                        ) : record.caught ? (
                          <p className="text-xs text-destructive mt-1">{t("crimes.caughtByCops")}</p>
                        ) : (
                          <p className="text-xs text-orange-400 mt-1">{t("crimes.failedEscaped")}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(record.attemptedAt), { addSuffix: true, locale: language === "ar" ? arLocale : undefined })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  {t("crimes.cleanRecord")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
