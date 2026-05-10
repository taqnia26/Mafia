import { useParams, Link } from "wouter";
import { useGetGang, useListGangMembers, getGetGangQueryKey, getListGangMembersQueryKey } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Coins, Crown, Users } from "lucide-react";

export default function GangDetail() {
  const { id } = useParams<{ id: string }>();
  const gangId = parseInt(id || "0", 10);
  const { t } = useI18n();

  const { data: gang, isLoading: isGangLoading } = useGetGang(gangId, { query: { enabled: !!gangId, queryKey: getGetGangQueryKey(gangId) } });
  const { data: members, isLoading: isMembersLoading } = useListGangMembers(gangId, { query: { enabled: !!gangId, queryKey: getListGangMembersQueryKey(gangId) } });

  const getRankColor = (rank: string) => {
    switch (rank) {
      case "Boss": return "text-red-500 border-red-500";
      case "Consigliere": return "text-yellow-500 border-yellow-500";
      case "Underboss": return "text-purple-500 border-purple-500";
      case "Capo": return "text-blue-500 border-blue-500";
      default: return "text-gray-400 border-gray-600";
    }
  };

  const getRankLabel = (rank: string) => {
    const map: Record<string, string> = {
      Boss: t("gangs.rankBoss"),
      Consigliere: t("gangs.rankConsigliere"),
      Underboss: t("gangs.rankUnderboss"),
      Capo: t("gangs.rankCapo"),
      Soldier: t("gangs.rankSoldier"),
    };
    return map[rank] ?? rank;
  };

  if (!gangId) return <div className="text-center p-8 text-destructive">{t("gangs.invalidId")}</div>;

  return (
    <div className="space-y-6">
      <Link href="/gangs" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}
      </Link>

      {isGangLoading ? (
        <Skeleton className="h-32 w-full bg-card" />
      ) : gang ? (
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 space-y-2">
            <h1 className="text-4xl font-heading font-bold uppercase tracking-wider text-primary">{gang.name}</h1>
            <p className="text-muted-foreground">{gang.description}</p>
          </div>
          <div className="flex gap-4">
            <Card className="bg-card border-border min-w-[150px]">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <Coins className="w-8 h-8 text-yellow-500 mb-2" />
                <span className="text-xs text-muted-foreground uppercase">{t("gangs.treasury")}</span>
                <span className="font-mono text-xl font-bold">${gang.treasury.toLocaleString()}</span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border min-w-[150px]">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <Users className="w-8 h-8 text-blue-500 mb-2" />
                <span className="text-xs text-muted-foreground uppercase">{t("gangs.members")}</span>
                <span className="font-mono text-xl font-bold">{gang.memberCount}</span>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-heading uppercase tracking-wider">{t("gangs.roster")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isMembersLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full bg-secondary" />
              <Skeleton className="h-12 w-full bg-secondary" />
            </div>
          ) : members && members.length > 0 ? (
            <div className="divide-y divide-border/50">
              {members.map((member) => (
                <div key={member.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">{member.username}</p>
                    <p className="text-xs text-muted-foreground">{t("common.level")} {member.level}</p>
                  </div>
                  <Badge variant="outline" className={`${getRankColor(member.rank)} font-bold tracking-wider uppercase shrink-0`}>
                    {member.rank === "Boss" && <Crown className="w-3 h-3 mr-1" />}
                    {getRankLabel(member.rank)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">{t("gangs.noMembers")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
