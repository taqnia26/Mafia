import {
  useGetPrisonStatus,
  useSelfBribeEscape,
  getGetPrisonStatusQueryKey,
  getGetMyProfileQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Lock, Clock, ShieldAlert, DollarSign, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/apiError";
import { PageBanner } from "@/components/PageBanner";

function PrisonTimer({ releaseAt, onExpired }: { releaseAt: string; onExpired: () => void }) {
  const { t } = useI18n();
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const target = new Date(releaseAt).getTime();
      const now = Date.now();
      const diff = target - now;

      const hs = t("common.hoursShort");
      const ms = t("common.minutesShort");
      const ss = t("common.secondsShort");

      if (diff <= 0) {
        setTimeLeft(`00${hs} 00${ms} 00${ss}`);
        onExpired();
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}${hs} ${String(m).padStart(2, "0")}${ms} ${String(s).padStart(2, "0")}${ss}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [releaseAt, onExpired, t]);

  return <span className="font-mono text-4xl font-bold text-destructive tracking-widest">{timeLeft}</span>;
}

export default function Prison() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useGetPrisonStatus({ query: { queryKey: getGetPrisonStatusQueryKey() } });

  const bribeEscape = useSelfBribeEscape({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetPrisonStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({
          title: t("prison.bribeSuccess"),
          description: result.message,
          className: "bg-green-900 border-green-500 text-white",
        });
      },
      onError: (err: unknown) => {
        toast({
          title: t("prison.bribeFailed"),
          description: getApiError(err),
          variant: "destructive",
        });
      },
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetPrisonStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <PageBanner image="/images/banners/prison.png" title={t("nav.prison")} />

      {isLoading ? (
        <Skeleton className="h-64 w-full bg-card" />
      ) : status?.isInPrison ? (
        <div className="space-y-6">
          <Card className="bg-card border-destructive overflow-hidden relative">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 40px, #fff 40px, #fff 48px)" }}
            />
            <CardHeader className="text-center pb-2 border-b border-border/50 relative z-10 bg-background/80">
              <Lock className="w-12 h-12 text-destructive mx-auto mb-4" />
              <CardTitle className="font-heading uppercase tracking-widest text-3xl text-destructive">
                {t("prison.incarcerated")}
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {t("prison.crime")}: <span className="text-foreground font-bold">{status.crimeCommitted || t("prison.unknownCrime")}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 text-center relative z-10 bg-background/80">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> {t("prison.timeRemaining")}
                </p>
                {status.releaseAt ? (
                  <PrisonTimer releaseAt={status.releaseAt} onExpired={handleRefresh} />
                ) : (
                  <span className="text-2xl font-heading">{t("prison.lifeSentence")}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading uppercase text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-500" /> {t("prison.bribeOption")}
                </CardTitle>
                <CardDescription>{t("prison.bribeDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{t("prison.bribeCost")}: <span className="text-green-500 font-mono font-bold">$5,000</span></p>
                <Button
                  className="w-full font-heading uppercase tracking-widest h-12"
                  onClick={() => bribeEscape.mutate({ data: { method: "bribe" } })}
                  disabled={bribeEscape.isPending}
                >
                  <ShieldAlert className="w-5 h-5 mr-2" />
                  {bribeEscape.isPending ? t("prison.bribing") : t("prison.bribe")}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border opacity-60">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading uppercase text-lg flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-orange-400" /> {t("prison.raidOption")}
                </CardTitle>
                <CardDescription>{t("prison.raidDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{t("prison.raidNote")}</p>
                <Button
                  variant="outline"
                  className="w-full font-heading uppercase tracking-widest h-12"
                  disabled
                >
                  {t("prison.raidRequiresGang")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-16 text-center space-y-4 flex flex-col items-center">
            <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center border border-border">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-heading uppercase tracking-wider">{t("prison.free")}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">{t("prison.freeDesc")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
