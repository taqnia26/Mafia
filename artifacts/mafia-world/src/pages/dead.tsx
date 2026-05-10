import { useGetMyProfile, useRestartAfterDeath, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Skull, Crosshair, Trophy, Calendar, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Dead() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });

  const restart = useRestartAfterDeath({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        toast({ title: t("dead.restarted"), description: t("dead.restartedDesc") });
        setLocation("/dashboard");
      },
      onError: () => {
        toast({ title: t("common.error"), description: t("dead.restartError"), variant: "destructive" });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <Skeleton className="h-96 w-full max-w-md bg-card" />
      </div>
    );
  }

  if (!profile) return null;

  if (!profile.isPermanentlyDead) {
    setLocation("/dashboard");
    return null;
  }

  const diedAt = profile.diedAt ? new Date(profile.diedAt) : null;
  const formattedDate = diedAt ? diedAt.toLocaleString(language === "ar" ? "ar-EG" : "en-US") : "—";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950/30 via-background to-background pointer-events-none" />
      <Card className="w-full max-w-md bg-card border-2 border-red-900/60 relative">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-red-950/60 border-2 border-red-700 flex items-center justify-center">
            <Skull className="w-14 h-14 text-red-500" />
          </div>

          <div>
            <h1 className="text-4xl font-heading font-bold uppercase tracking-wider text-red-500">
              {t("dead.title")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("dead.subtitle")}</p>
          </div>

          <div className="w-full space-y-3 text-left">
            <div className="bg-secondary/50 rounded-lg p-3 flex items-start gap-3">
              <Crosshair className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("dead.killedBy")}</p>
                <p className="font-bold truncate">
                  {profile.killedByUsername ?? t("dead.unknown")}
                </p>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-lg p-3 flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("dead.cause")}</p>
                <p className="font-medium truncate">
                  {profile.deathCause ?? t("dead.unknown")}
                </p>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-lg p-3 flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("dead.diedAt")}</p>
                <p className="font-mono text-sm">{formattedDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{t("common.level")}</p>
                <p className="font-mono font-bold">{profile.level}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <Skull className="w-4 h-4 text-green-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{t("common.kills")}</p>
                <p className="font-mono font-bold">{profile.killCount}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mt-3">$</p>
                <p className="font-mono font-bold text-xs">${profile.money.toLocaleString("en-US")}</p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => restart.mutate()}
            disabled={restart.isPending}
            size="lg"
            className="w-full bg-red-700 hover:bg-red-600 text-white font-heading uppercase tracking-wider"
            data-testid="button-start-over"
          >
            {restart.isPending ? t("common.loading") : t("dead.startOver")}
          </Button>

          <p className="text-xs text-muted-foreground">{t("dead.startOverWarning")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
