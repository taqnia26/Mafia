import { useListCrimes, useAttemptCrime, useGetCrimeHistory, getListCrimesQueryKey, getGetCrimeHistoryQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Briefcase, DollarSign, AlertCircle, Clock, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { getApiError } from "@/lib/apiError";

export default function Crimes() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: crimes, isLoading } = useListCrimes({ query: { queryKey: getListCrimesQueryKey() } });
  const { data: history, isLoading: isHistoryLoading } = useGetCrimeHistory({ query: { queryKey: getGetCrimeHistoryQueryKey() } });
  
  const attemptCrime = useAttemptCrime({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetCrimeHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        
        if (result.success) {
          toast({ 
            title: t("crimes.success"), 
            description: result.message,
            className: "bg-green-900 border-green-500 text-white"
          });
        } else if (result.caught) {
          toast({ 
            title: t("crimes.busted"), 
            description: result.message,
            variant: "destructive"
          });
        } else {
          toast({ 
            title: t("crimes.failed"), 
            description: result.message,
            variant: "destructive"
          });
        }
      },
      onError: (err: unknown) => {
        toast({ 
          title: t("crimes.cannotAttempt"), 
          description: getApiError(err),
          variant: "destructive"
        });
      }
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.crimes")}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-heading uppercase text-muted-foreground mb-4">{t("crimes.available")}</h2>
          
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full bg-card" />
              <Skeleton className="h-32 w-full bg-card" />
              <Skeleton className="h-32 w-full bg-card" />
            </div>
          ) : crimes?.map((crime) => (
            <Card key={crime.id} className="bg-card border-border overflow-hidden hover:border-primary/50 transition-colors">
              <div className="flex flex-col sm:flex-row">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold font-heading uppercase">{crime.name}</h3>
                    <Badge variant={crime.successRate > 70 ? "outline" : crime.successRate > 40 ? "secondary" : "destructive"} className="font-mono">
                      {crime.successRate}% {t("crimes.successRate")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{crime.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-green-500">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-mono">${crime.minReward} - ${crime.maxReward}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-mono">{crime.xpReward} XP</span>
                    </div>
                    {crime.prisonTimeHours > 0 && (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <ShieldAlert className="w-4 h-4" />
                        <span className="font-mono">{crime.prisonTimeHours}h {t("crimes.prisonRisk")}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-secondary/30 p-6 flex flex-col justify-center items-center sm:border-l border-border/50 sm:w-48">
                  <Button 
                    className="w-full font-heading tracking-widest uppercase"
                    onClick={() => attemptCrime.mutate({ data: { crimeTypeId: crime.id } })}
                    disabled={attemptCrime.isPending}
                  >
                    {t("crimes.attempt")}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {crime.cooldownMinutes}m {t("crimes.cooldown")}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div>
          <Card className="bg-card border-border sticky top-4">
            <CardHeader>
              <CardTitle className="font-heading uppercase tracking-wider text-lg">{t("crimes.rapSheet")}</CardTitle>
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
                      <div className={`mt-0.5 p-2 rounded-full h-fit ${record.success ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{record.crimeName}</p>
                        {record.success ? (
                          <p className="text-xs text-green-500 mt-1 flex items-center gap-2 font-mono">
                            +${record.moneyEarned} • +{record.xpEarned} XP
                          </p>
                        ) : record.caught ? (
                          <p className="text-xs text-destructive mt-1">{t("crimes.caughtByCops")}</p>
                        ) : (
                          <p className="text-xs text-orange-500 mt-1">{t("crimes.failedEscaped")}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(record.attemptedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
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
