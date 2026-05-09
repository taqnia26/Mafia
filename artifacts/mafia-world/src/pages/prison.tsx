import { useGetPrisonStatus, useGetMyProfile, getGetPrisonStatusQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Lock, Clock, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

function PrisonTimer({ releaseAt }: { releaseAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const target = new Date(releaseAt).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("Sentence Served. Refreshing...");
        // Auto reload logic could go here
        return;
      }

      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [releaseAt]);

  return <span className="font-mono text-4xl font-bold text-destructive">{timeLeft}</span>;
}

export default function Prison() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useGetPrisonStatus({ query: { queryKey: getGetPrisonStatusQueryKey() } });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.prison")}</h1>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full bg-card" />
      ) : status?.isInPrison ? (
        <Card className="bg-card border-destructive overflow-hidden relative">
          {/* Prison bars overlay effect */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 40px, #fff 40px, #fff 48px)' }}></div>
          
          <CardHeader className="text-center pb-2 border-b border-border/50 relative z-10 bg-background/80">
            <Lock className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle className="font-heading uppercase tracking-widest text-3xl text-destructive">Incarcerated</CardTitle>
            <CardDescription className="text-lg mt-2">Busted for: <span className="text-foreground font-bold">{status.crimeCommitted || "Unknown Crimes"}</span></CardDescription>
          </CardHeader>
          <CardContent className="p-8 text-center relative z-10 bg-background/80">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-center gap-2"><Clock className="w-4 h-4"/> Time Remaining</p>
                {status.releaseAt ? <PrisonTimer releaseAt={status.releaseAt} /> : <span className="text-2xl">Life Sentence</span>}
              </div>
              
              <div className="pt-8 border-t border-border/50 max-w-sm mx-auto">
                <Button className="w-full font-heading uppercase tracking-widest h-14" variant="outline" disabled>
                  <ShieldAlert className="w-5 h-5 mr-2 text-orange-500" /> Bribe Guards (Unavailable)
                </Button>
                <p className="text-xs text-muted-foreground mt-3">Jailbreak features coming in next update.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-16 text-center space-y-4 flex flex-col items-center">
            <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center border border-border">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-heading uppercase tracking-wider">A Free Person</h2>
            <p className="text-muted-foreground max-w-md mx-auto">You are not currently in prison. Keep your head down and don't get caught doing crimes.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}