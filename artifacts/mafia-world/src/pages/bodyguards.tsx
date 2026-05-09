import {
  useListNpcBodyguards,
  useGetMyBodyguards,
  useHireNpcBodyguard,
  useListBodyguardRequests,
  useSendBodyguardRequest,
  useRespondToBodyguardRequest,
  getListNpcBodyguardsQueryKey,
  getGetMyBodyguardsQueryKey,
  getListBodyguardRequestsQueryKey,
  getGetMyProfileQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserPlus, Users, UserCheck, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { getApiError } from "@/lib/apiError";

export default function Bodyguards() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [offeredMoney, setOfferedMoney] = useState("0");

  const { data: npcs, isLoading: isNpcsLoading } = useListNpcBodyguards({ query: { queryKey: getListNpcBodyguardsQueryKey() } });
  const { data: myGuards, isLoading: isMyGuardsLoading } = useGetMyBodyguards({ query: { queryKey: getGetMyBodyguardsQueryKey() } });
  const { data: requests, isLoading: isRequestsLoading } = useListBodyguardRequests({ query: { queryKey: getListBodyguardRequestsQueryKey() } });

  const hireNpc = useHireNpcBodyguard({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyBodyguardsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: t("bodyguards.hired"), description: t("bodyguards.hiredDesc") });
      },
      onError: (err: unknown) => toast({ title: t("bodyguards.hireFailed"), description: getApiError(err), variant: "destructive" })
    }
  });

  const sendRequest = useSendBodyguardRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBodyguardRequestsQueryKey() });
        setTargetPlayerId("");
        setOfferedMoney("0");
        toast({ title: t("bodyguards.requestSent"), description: t("bodyguards.requestSentDesc") });
      },
      onError: (err: unknown) => toast({ title: t("bodyguards.requestFailed"), description: getApiError(err), variant: "destructive" })
    }
  });

  const respondToRequest = useRespondToBodyguardRequest({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getListBodyguardRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyBodyguardsQueryKey() });
        const accepted = (variables as { data: { accept: boolean } }).data.accept;
        toast({ title: accepted ? t("bodyguards.requestAccepted") : t("bodyguards.requestRejected") });
      },
      onError: (err: unknown) => toast({ title: t("common.error"), description: getApiError(err), variant: "destructive" })
    }
  });

  const handleSendRequest = () => {
    if (!targetPlayerId) return;
    sendRequest.mutate({ data: { targetPlayerId: parseInt(targetPlayerId), offeredMoney: parseInt(offeredMoney) || 0 } });
  };

  const incomingRequests = requests?.received?.filter(r => r.status === "pending") ?? [];
  const sentRequests = requests?.sent ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.bodyguards")}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-heading uppercase text-primary mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> {t("bodyguards.npcGuards")}
            </h2>
            <div className="space-y-4">
              {isNpcsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full bg-card" />)
              ) : npcs?.map((npc) => (
                <Card key={npc.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                  <div className="flex flex-col sm:flex-row">
                    <div className="p-6 flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold font-heading uppercase">{npc.name}</h3>
                        <Badge variant={npc.tier === "elite" ? "destructive" : npc.tier === "advanced" ? "default" : "secondary"} className="uppercase">
                          {npc.tier}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{npc.description}</p>
                      <div className="flex items-center gap-4 text-sm font-mono">
                        <span className="flex items-center gap-1 text-blue-500"><Shield className="w-4 h-4" /> +{npc.defensePower} {t("common.defense")}</span>
                      </div>
                    </div>
                    <div className="bg-secondary/30 p-6 flex flex-col justify-center sm:border-l border-border/50 sm:w-48 gap-3">
                      <div className="text-center font-mono">
                        <p className="text-green-500 font-bold">${npc.hirePrice.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">${npc.dailyCost.toLocaleString()}/{t("bodyguards.perDay")}</p>
                      </div>
                      <Button
                        className="w-full font-heading uppercase"
                        onClick={() => hireNpc.mutate({ guardId: npc.id })}
                        disabled={hireNpc.isPending}
                      >
                        {t("common.hire")}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-heading uppercase flex items-center gap-2 text-lg">
                <Send className="w-5 h-5 text-primary" /> {t("bodyguards.requestGuard")}
              </CardTitle>
              <CardDescription>{t("bodyguards.requestGuardDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-heading uppercase tracking-wider text-xs text-muted-foreground">{t("bodyguards.targetPlayerId")}</Label>
                <Input
                  type="number"
                  placeholder="e.g. 42"
                  value={targetPlayerId}
                  onChange={(e) => setTargetPlayerId(e.target.value)}
                  className="bg-background border-border font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-heading uppercase tracking-wider text-xs text-muted-foreground">{t("bodyguards.offerMoney")}</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={offeredMoney}
                  onChange={(e) => setOfferedMoney(e.target.value)}
                  className="bg-background border-border font-mono"
                />
                <p className="text-xs text-muted-foreground">{t("bodyguards.offerMoneyDesc")}</p>
              </div>
              <Button
                className="w-full font-heading uppercase tracking-widest"
                onClick={handleSendRequest}
                disabled={!targetPlayerId || sendRequest.isPending}
              >
                <Send className="w-4 h-4 mr-2" /> {t("bodyguards.sendRequest")}
              </Button>

              {sentRequests.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-heading uppercase tracking-wider text-muted-foreground">{t("bodyguards.sentRequests")}:</p>
                  {sentRequests.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                      <span className="font-heading uppercase">{r.toUsername}</span>
                      <Badge variant={r.status === "accepted" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {incomingRequests.length > 0 && (
            <Card className="bg-card border-primary/40">
              <CardHeader>
                <CardTitle className="font-heading uppercase flex items-center gap-2 text-lg text-primary">
                  <UserCheck className="w-5 h-5" /> {t("bodyguards.incomingRequests")}
                </CardTitle>
                <CardDescription>{t("bodyguards.incomingRequestsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {isRequestsLoading ? (
                    <div className="p-4"><Skeleton className="h-16 w-full bg-secondary" /></div>
                  ) : incomingRequests.map(r => (
                    <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold font-heading uppercase">{r.fromUsername}</p>
                        {r.offeredMoney > 0 && (
                          <p className="text-xs text-green-500 font-mono mt-1">{t("bodyguards.offering")}: ${r.offeredMoney.toLocaleString()}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="font-heading uppercase"
                          onClick={() => respondToRequest.mutate({ requestId: r.id, data: { accept: true } })}
                          disabled={respondToRequest.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> {t("common.confirm")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="font-heading uppercase"
                          onClick={() => respondToRequest.mutate({ requestId: r.id, data: { accept: false } })}
                          disabled={respondToRequest.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border sticky top-4">
            <CardHeader>
              <CardTitle className="font-heading uppercase flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> {t("bodyguards.myGuards")}
              </CardTitle>
              <CardDescription>{t("bodyguards.activeDetail")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isMyGuardsLoading ? (
                <div className="p-4 space-y-4"><Skeleton className="h-16 w-full bg-secondary" /></div>
              ) : (myGuards?.npcGuards.length === 0 && myGuards?.playerGuards.length === 0) ? (
                <div className="p-8 text-center text-muted-foreground">{t("bodyguards.noGuards")}</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {myGuards?.npcGuards.map((guard) => (
                    <div key={guard.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-bold font-heading uppercase">{guard.npcName}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4">{guard.tier}</Badge>
                          <span className="text-xs text-blue-500 flex items-center gap-1"><Shield className="w-3 h-3" /> +{guard.defensePower}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(guard.hiredAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {myGuards?.playerGuards.map((guard) => (
                    <div key={guard.id} className="p-4 flex items-center justify-between bg-primary/5">
                      <div>
                        <p className="font-bold font-heading uppercase flex items-center gap-2">
                          {guard.guardUsername} <Badge className="bg-primary hover:bg-primary h-4 text-[10px]">{t("bodyguards.playerGuard")}</Badge>
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{t("common.level")} {guard.level}</span>
                          <span className="text-xs text-blue-500 flex items-center gap-1"><Shield className="w-3 h-3" /> +{guard.defensePower}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
