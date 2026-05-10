import { useGetMyProfile, useToggleAntiSpy, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Crosshair, Skull, HeartPulse, MapPin, Award } from "lucide-react";
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
  
  const toggleAntiSpy = useToggleAntiSpy({
    mutation: {
      onSuccess: (updatedProfile) => {
        queryClient.setQueryData(getGetMyProfileQueryKey(), updatedProfile);
        toast({ title: t("profile.antiSpyUpdated"), description: updatedProfile.antiSpyEnabled ? t("profile.antiSpyOn") : t("profile.antiSpyOff") });
      },
      onError: () => {
        toast({ title: t("common.error"), description: t("profile.antiSpyError"), variant: "destructive" });
      }
    }
  });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-48 w-full bg-card" /><Skeleton className="h-64 w-full bg-card" /></div>;
  }

  if (!profile) return null;

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

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-heading uppercase tracking-wider text-lg">{t("profile.settingsSection")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border/50">
                <div className="space-y-1">
                  <Label htmlFor="anti-spy" className="text-base">{t("profile.antiSpyProtection")}</Label>
                  <p className="text-sm text-muted-foreground">{t("profile.antiSpyProtectionDesc")}</p>
                </div>
                <Switch 
                  id="anti-spy" 
                  checked={profile.antiSpyEnabled} 
                  onCheckedChange={(checked) => toggleAntiSpy.mutate({ data: { enabled: checked } })}
                  disabled={toggleAntiSpy.isPending}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
