import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Swords, Building2, DollarSign, Lock, RefreshCw, UserCheck, UserX } from "lucide-react";
import { useGetAdminStats, useGetAdminPlayers, useGetAdminGangs, useUpdateAdminPlayer, useResetAdminPlayer, useDeleteAdminGang } from "@workspace/api-client-react";

export default function Admin() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [playerPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: playersData, isLoading: playersLoading, refetch: refetchPlayers } = useGetAdminPlayers({ page: playerPage, limit: 50 });
  const { data: gangs, isLoading: gangsLoading, refetch: refetchGangs } = useGetAdminGangs();

  const { mutate: updatePlayer } = useUpdateAdminPlayer();
  const { mutate: resetPlayer } = useResetAdminPlayer();
  const { mutate: disbandGang } = useDeleteAdminGang();

  const handleRelease = (playerId: number) => {
    updatePlayer({ playerId, data: { isInPrison: false } }, {
      onSuccess: () => {
        toast({ title: "Player released from prison" });
        void refetchPlayers();
      },
      onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
    });
  };

  const handleReset = (playerId: number, username: string) => {
    if (!confirm(`Reset stats for ${username}?`)) return;
    resetPlayer({ playerId }, {
      onSuccess: () => {
        toast({ title: `${username}'s stats reset` });
        void refetchPlayers();
      },
      onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
    });
  };

  const handleGrantAdmin = (playerId: number, isAdmin: boolean) => {
    updatePlayer({ playerId, data: { isAdmin } }, {
      onSuccess: () => {
        toast({ title: isAdmin ? "Admin granted" : "Admin revoked" });
        void refetchPlayers();
      },
      onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
    });
  };

  const handleDisband = (gangId: number, name: string) => {
    if (!confirm(`Disband gang "${name}"?`)) return;
    disbandGang({ gangId }, {
      onSuccess: () => {
        toast({ title: `Gang "${name}" disbanded` });
        void refetchGangs();
        void refetchPlayers();
      },
      onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider text-primary">{t("admin.title")}</h1>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: t("admin.totalPlayers"), value: stats.totalPlayers, icon: Users, color: "text-blue-500" },
            { label: t("admin.totalGangs"), value: stats.totalGangs, icon: Building2, color: "text-purple-500" },
            { label: t("admin.totalAttacks"), value: stats.totalAttacks, icon: Swords, color: "text-red-500" },
            { label: t("admin.prisoners"), value: stats.totalPrisoners, icon: Lock, color: "text-orange-500" },
            { label: t("admin.economy"), value: `$${stats.totalMoneyInCirculation.toLocaleString()}`, icon: DollarSign, color: "text-green-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Icon className={`w-6 h-6 ${color} mb-2`} />
                <p className="text-xs text-muted-foreground uppercase">{label}</p>
                <p className="font-mono text-xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
            <Users className="w-5 h-5" /> {t("admin.managePlayers")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {playersLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-secondary" />)}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {playersData?.players.map((player) => (
                <div key={player.id} className="p-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{player.username}</span>
                      {player.isAdmin && <Badge variant="outline" className="text-yellow-500 border-yellow-500 text-xs">Admin</Badge>}
                      {player.isInPrison && <Badge variant="outline" className="text-orange-500 border-orange-500 text-xs">Jailed</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Lv.{player.level} · ${player.money.toLocaleString()} · {player.cityName}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {player.isInPrison && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-green-700 text-green-500 hover:bg-green-900" onClick={() => handleRelease(player.id)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> {t("admin.release")}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs border-blue-700 text-blue-400 hover:bg-blue-900" onClick={() => handleReset(player.id, player.username)}>
                      <RefreshCw className="w-3 h-3 mr-1" /> {t("admin.resetStats")}
                    </Button>
                    {player.isAdmin ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-700 text-red-400 hover:bg-red-900" onClick={() => handleGrantAdmin(player.id, false)}>
                        <UserX className="w-3 h-3 mr-1" /> {t("admin.revokeAdmin")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-yellow-700 text-yellow-500 hover:bg-yellow-900" onClick={() => handleGrantAdmin(player.id, true)}>
                        <UserCheck className="w-3 h-3 mr-1" /> {t("admin.grantAdmin")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-5 h-5" /> {t("admin.manageGangs")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {gangsLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-secondary" />)}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {gangs?.map((gang) => (
                <div key={gang.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <span className="font-bold text-foreground">{gang.name}</span>
                    <p className="text-xs text-muted-foreground">{gang.memberCount} members · ${gang.treasury.toLocaleString()} treasury</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-700 text-red-400 hover:bg-red-900" onClick={() => handleDisband(gang.id, gang.name)}>
                    {t("admin.disband")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
