import { useState, useEffect } from "react";
import { useListPlayers, useSpyOnPlayer, useAttemptJailbreak, getListPlayersQueryKey, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Swords, Crosshair, Shield, CheckCircle2, AlertCircle, KeyRound, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { getApiError } from "@/lib/apiError";

type SpyResult = {
  targetPlayerId: number;
  blocked: boolean;
  attackPower?: number | null;
  defensePower?: number | null;
  isInPrison?: boolean | null;
  bodyguardCount?: number | null;
};

export default function Players() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [spyResults, setSpyResults] = useState<Map<number, SpyResult>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: myProfile } = useGetMyProfile();
  const { data, isLoading } = useListPlayers({ search: debouncedSearch, limit: 20 }, { query: { queryKey: getListPlayersQueryKey({ search: debouncedSearch, limit: 20 }) } });
  
  const spy = useSpyOnPlayer({
    mutation: {
      onSuccess: (result) => {
        if (result.blocked) {
          toast({ title: t("attack.spyBlocked"), description: t("attack.spyBlockedDesc"), variant: "destructive" });
        } else if (result.success && result.targetPlayerId != null) {
          setSpyResults(prev => new Map(prev).set(result.targetPlayerId!, result as SpyResult));
          toast({ title: t("attack.spySuccess"), description: `${t("common.atkAbbr")}: ${result.attackPower} | ${t("common.defAbbr")}: ${result.defensePower}`, className: "bg-green-900 border-green-500" });
        }
      },
      onError: (err: unknown) => {
        toast({ title: t("attack.spyFailed"), description: getApiError(err), variant: "destructive" });
      }
    }
  });

  const jailbreak = useAttemptJailbreak({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey({ search: debouncedSearch, limit: 20 }) });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        toast({ title: t("prison.jailbreakSuccess"), description: result.message, className: "bg-green-900 border-green-500" });
      },
      onError: (err: unknown) => {
        toast({ title: t("prison.jailbreakFailed"), description: getApiError(err), variant: "destructive" });
      }
    }
  });

  const myGangId = myProfile?.gangId ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.players")}</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t("common.search") + "..."} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full bg-card" />)
        ) : data?.players && data.players.length > 0 ? (
          data.players.map((player) => {
            const spyData = spyResults.get(player.id);
            const isGangMate = myGangId !== null && myGangId !== undefined && player.gangId === myGangId;
            const canJailbreak = player.isInPrison && isGangMate;
            return (
              <Card key={player.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg font-heading uppercase truncate">{player.username}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-muted-foreground">{t("common.level")} {player.level} • {player.cityName}</p>
                        {player.isInPrison && (
                          <Badge variant="outline" className="text-orange-400 border-orange-500/50 text-xs">{t("prison.incarcerated")}</Badge>
                        )}
                        {player.rankNameEn && (
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: player.rankColor ?? "#6b7280",
                              color: player.rankColor ?? "#9ca3af",
                            }}
                          >
                            {language === "ar" ? (player.rankNameAr ?? player.rankNameEn) : player.rankNameEn}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {player.gangName && (
                      <Badge variant="outline" className="border-primary/50 text-primary">{player.gangName}</Badge>
                    )}
                  </div>
                  
                  <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Crosshair className="w-3 h-3" /> {player.killCount}</span>
                    <span className="flex items-center gap-1 text-destructive"><Swords className="w-3 h-3" /> {player.deathCount}</span>
                  </div>

                  {spyData && !spyData.blocked && (
                    <div className="mt-3 p-2 rounded bg-green-500/10 border border-green-500/20 text-xs space-y-1">
                      <div className="flex gap-4 font-mono">
                        <span className="flex items-center gap-1 text-destructive"><Swords className="w-3 h-3" /> {t("common.attack")}: {spyData.attackPower ?? "?"}</span>
                        <span className="flex items-center gap-1 text-blue-400"><Shield className="w-3 h-3" /> {t("common.defense")}: {spyData.defensePower ?? "?"}</span>
                      </div>
                      <div className="flex gap-3 text-muted-foreground">
                        {spyData.isInPrison ? (
                          <span className="flex items-center gap-1 text-orange-400"><AlertCircle className="w-3 h-3" /> {t("nav.prison")}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3 h-3" /> {t("attack.free")}</span>
                        )}
                        <span>{t("nav.bodyguards")}: {spyData.bodyguardCount ?? 0}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 font-heading uppercase tracking-wider"
                      onClick={() => spy.mutate({ targetPlayerId: player.id })}
                      disabled={spy.isPending}
                    >
                      <Eye className="w-4 h-4 mr-2" /> {t("attack.spy")}
                    </Button>
                    {player.id !== myProfile?.id && (
                      <Link href={`/chat/private/${player.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full font-heading uppercase tracking-wider">
                          <MessageCircle className="w-4 h-4 mr-2" /> {t("chat.message")}
                        </Button>
                      </Link>
                    )}
                    {canJailbreak ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 font-heading uppercase tracking-wider border-green-700 text-green-500 hover:bg-green-900"
                        onClick={() => jailbreak.mutate({ targetPlayerId: player.id, data: { method: "raid" } })}
                        disabled={jailbreak.isPending}
                      >
                        <KeyRound className="w-4 h-4 mr-2" /> {t("prison.jailbreak")}
                      </Button>
                    ) : !player.isInPrison ? (
                      <Link href={`/attack?target=${player.id}`} className="flex-1">
                        <Button variant="destructive" size="sm" className="w-full font-heading uppercase tracking-wider">
                          <Swords className="w-4 h-4 mr-2" /> {t("common.attack")}
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            {t("players.noPlayers")}
          </div>
        )}
      </div>
    </div>
  );
}
