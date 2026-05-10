import { useGetDashboardStats, useGetRecentActivity, useGetLeaderboard, useGetMyProfile } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import {
  Trophy,
  DollarSign,
  Crosshair,
  Shield,
  Activity,
  AlertTriangle,
  Lock,
  Award,
  Skull,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { PageBanner } from "@/components/PageBanner";

export default function Dashboard() {
  const { t, language } = useI18n();
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardStats({ query: { queryKey: ["/api/dashboard/stats"] } });
  const { data: activity, isLoading: isActivityLoading } = useGetRecentActivity({ query: { queryKey: ["/api/dashboard/activity"] } });
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useGetLeaderboard({ query: { queryKey: ["/api/dashboard/leaderboard"] } });
  const { data: profile } = useGetMyProfile({ query: { queryKey: ["/api/players/me"] } });

  return (
    <div className="space-y-6">
      <PageBanner image="/images/banners/dashboard.png" title={t("nav.dashboard")} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isStatsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl bg-card" />)
        ) : stats ? (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("common.money")}</p>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-green-400">${stats.money.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {t("dashboard.city")}: <span className="text-foreground">{stats.cityName}</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("common.level")} {stats.level}</p>
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-2 mt-2">
                  <Progress value={(stats.xp / (stats.xp + stats.xpToNextLevel)) * 100} className="h-2 bg-secondary" indicatorClassName="bg-primary" />
                  <p className="text-xs text-muted-foreground text-right">{stats.xp.toLocaleString()} {t("dashboard.xp")}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("dashboard.combatPower")}</p>
                  <Crosshair className="h-4 w-4 text-orange-500" />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{t("common.attack")}</span>
                    <span className="font-mono text-lg">{stats.attackPower.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-muted-foreground">{t("common.defense")}</span>
                    <span className="font-mono text-lg">{stats.defensePower.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("common.status")}</p>
                  <Activity className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {profile?.isPermanentlyDead ? (
                    <Badge variant="destructive" className="w-fit flex gap-1 bg-red-900/70"><Skull className="w-3 h-3"/> {t("dead.badge")}</Badge>
                  ) : stats.isInPrison ? (
                    <Badge variant="destructive" className="w-fit flex gap-1"><Lock className="w-3 h-3"/> {t("dashboard.inPrison")}</Badge>
                  ) : stats.isTraveling ? (
                    <Badge variant="secondary" className="w-fit">{t("dashboard.traveling")}</Badge>
                  ) : (
                    <Badge variant="outline" className="w-fit border-green-500 text-green-500">{t("dashboard.active")}</Badge>
                  )}
                  {(stats.incomingAttacks > 0 || stats.pendingAttacks > 0) && (
                    <Badge variant="destructive" className="w-fit flex gap-1 bg-orange-600">
                      <AlertTriangle className="w-3 h-3" /> {t("dashboard.combatActive")}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border col-span-full md:col-span-2 lg:col-span-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("nav.ranks")}</p>
                  <Award className="h-4 w-4" style={{ color: stats.rankColor }} />
                </div>
                <div className="mt-1">
                  <Link href="/ranks">
                    <span
                      className="text-xl font-heading font-bold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ color: stats.rankColor }}
                    >
                      {language === "ar" ? stats.rankNameAr : stats.rankNameEn}
                    </span>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? `رتبة #${stats.currentRank}` : `Rank #${stats.currentRank}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {t("dashboard.activity")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isActivityLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full bg-secondary" />
                <Skeleton className="h-10 w-full bg-secondary" />
                <Skeleton className="h-10 w-full bg-secondary" />
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="divide-y divide-border/50">
                {activity.map((item) => (
                  <div key={item.id} className="p-4 flex items-start gap-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: language === "ar" ? arLocale : undefined })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">{t("dashboard.noActivity")}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {t("dashboard.topBosses")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLeaderboardLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-full bg-secondary" />
                <Skeleton className="h-8 w-full bg-secondary" />
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <div className="divide-y divide-border/50">
                {leaderboard.slice(0, 5).map((player, index) => (
                  <div key={player.playerId} className="p-3 flex items-center gap-3">
                    <span className={`font-mono text-lg font-bold ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                      #{player.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{player.username}</p>
                      <p className="text-xs text-muted-foreground">{t("dashboard.lvl")} {player.level} • {player.cityName}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">{t("players.noPlayers")}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
