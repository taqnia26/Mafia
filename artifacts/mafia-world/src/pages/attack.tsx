import {
  useGetMyAttacks,
  useGetIncomingAttacks,
  useGetMyWeapons,
  useGetMyAmmo,
  useInitiateAttack,
  useSpyOnPlayer,
  getGetMyAttacksQueryKey,
  getGetIncomingAttacksQueryKey,
  getGetMyWeaponsQueryKey,
  getGetMyAmmoQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Swords, ShieldAlert, Clock, CheckCircle2, XCircle, Target, Eye, Shield, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/apiError";

type SpyData = {
  attackPower: number | null;
  defensePower: number | null;
  isInPrison: boolean | null;
  bodyguardCount: number | null;
  blocked: boolean;
};

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Arrived"); return; }
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${m}m ${s}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span className="font-mono">{timeLeft}</span>;
}

export default function Attack() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const prefilledTargetId = params.get("target") || "";

  const [targetPlayerId, setTargetPlayerId] = useState(prefilledTargetId);
  const [selectedWeaponId, setSelectedWeaponId] = useState("");
  const [ammoQuantity, setAmmoQuantity] = useState("10");
  const [spyData, setSpyData] = useState<SpyData | null>(null);
  const [spiedTargetId, setSpiedTargetId] = useState<string | null>(null);

  const { data: myWeapons, isLoading: isWeaponsLoading } = useGetMyWeapons({ query: { queryKey: getGetMyWeaponsQueryKey() } });
  const { data: myAmmo } = useGetMyAmmo({ query: { queryKey: getGetMyAmmoQueryKey() } });
  const { data: myAttacks, isLoading: isMyAttacksLoading } = useGetMyAttacks({ query: { queryKey: getGetMyAttacksQueryKey() } });
  const { data: incoming, isLoading: isIncomingLoading } = useGetIncomingAttacks({ query: { queryKey: getGetIncomingAttacksQueryKey() } });

  const spyMutation = useSpyOnPlayer({
    mutation: {
      onSuccess: (result) => {
        setSpiedTargetId(targetPlayerId);
        if (result.blocked) {
          setSpyData({ attackPower: null, defensePower: null, isInPrison: null, bodyguardCount: null, blocked: true });
          toast({ title: t("attack.spyBlocked"), description: t("attack.spyBlockedDesc"), variant: "destructive" });
        } else {
          setSpyData({
            attackPower: result.attackPower ?? null,
            defensePower: result.defensePower ?? null,
            isInPrison: result.isInPrison ?? null,
            bodyguardCount: result.bodyguardCount ?? null,
            blocked: false,
          });
          toast({ title: t("attack.spySuccess"), description: t("attack.spySuccessDesc"), className: "bg-green-900 border-green-500" });
        }
      },
      onError: (err: unknown) => {
        toast({ title: t("attack.spyFailed"), description: getApiError(err), variant: "destructive" });
      },
    },
  });

  const initiateAttack = useInitiateAttack({
    mutation: {
      onSuccess: (attack) => {
        queryClient.invalidateQueries({ queryKey: getGetMyAttacksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({
          title: t("attack.dispatched"),
          description: `${t("attack.dispatchedEta")}: ${new Date(attack.travelArrivalAt!).toLocaleTimeString()}`,
          className: "bg-red-950 border-red-700 text-white",
        });
        setTargetPlayerId("");
        setSelectedWeaponId("");
        setAmmoQuantity("10");
        setSpyData(null);
        setSpiedTargetId(null);
      },
      onError: (err: unknown) => {
        toast({ title: t("attack.failed"), description: getApiError(err), variant: "destructive" });
      },
    },
  });

  const handleSpy = () => {
    if (!targetPlayerId) return;
    spyMutation.mutate({ targetPlayerId: parseInt(targetPlayerId) });
  };

  const handleAttack = () => {
    if (!targetPlayerId || !selectedWeaponId || !ammoQuantity) return;
    initiateAttack.mutate({
      data: {
        targetPlayerId: parseInt(targetPlayerId),
        weaponId: parseInt(selectedWeaponId),
        ammoQuantity: parseInt(ammoQuantity),
      },
    });
  };

  const hasSpied = spiedTargetId === targetPlayerId && spyData !== null;
  const canAttack = hasSpied && !spyData?.blocked;

  const renderStatus = (status: string, result?: boolean | null) => {
    if (status === "traveling") return <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">{t("attack.traveling")}</Badge>;
    if (status === "completed") {
      return result === false
        ? <Badge className="bg-green-500/20 text-green-500 border-green-500/50">{t("attack.won")}</Badge>
        : <Badge className="bg-destructive/20 text-destructive border-destructive/50">{t("attack.lost")}</Badge>;
    }
    return <Badge variant="outline">{t("attack.cancelled")}</Badge>;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.attack")}</h1>
      </div>

      <Card className="bg-card border-destructive/40 shadow-[0_0_20px_rgba(220,38,38,0.1)]">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="font-heading uppercase flex items-center gap-2 text-destructive">
            <Target className="w-5 h-5" /> {t("attack.dispatchHit")}
          </CardTitle>
          <CardDescription>{t("attack.spyFirstHint")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-heading uppercase tracking-wider text-xs text-muted-foreground">
                {t("attack.targetPlayerId")}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="e.g. 42"
                  value={targetPlayerId}
                  onChange={(e) => { setTargetPlayerId(e.target.value); setSpyData(null); setSpiedTargetId(null); }}
                  className="bg-background border-border font-mono flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleSpy}
                  disabled={!targetPlayerId || spyMutation.isPending}
                  className="font-heading uppercase whitespace-nowrap"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {spyMutation.isPending ? t("common.loading") : t("attack.spy")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("attack.spyRequired")}</p>
            </div>

            {hasSpied && (
              <div className={`p-4 rounded border ${spyData?.blocked ? "border-destructive/40 bg-destructive/10" : "border-green-500/30 bg-green-500/10"}`}>
                {spyData?.blocked ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <p className="font-heading uppercase font-bold text-sm">{t("attack.spyBlocked")}</p>
                      <p className="text-xs text-muted-foreground">{t("attack.spyBlockedDesc")}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-heading uppercase tracking-wider text-green-400">{t("attack.intelligenceReport")}</p>
                    <div className="flex flex-wrap gap-4 text-sm font-mono">
                      <span className="flex items-center gap-1 text-destructive"><Swords className="w-4 h-4" /> {t("common.attack")}: {spyData?.attackPower ?? "?"}</span>
                      <span className="flex items-center gap-1 text-blue-400"><Shield className="w-4 h-4" /> {t("common.defense")}: {spyData?.defensePower ?? "?"}</span>
                      <span className="flex items-center gap-1 text-muted-foreground">{t("nav.bodyguards")}: {spyData?.bodyguardCount ?? 0}</span>
                      {spyData?.isInPrison && (
                        <span className="flex items-center gap-1 text-orange-400"><AlertCircle className="w-4 h-4" /> {t("players.inPrison")}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!hasSpied && (
              <div className="p-4 rounded border border-border/50 bg-secondary/20 text-center">
                <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">{t("attack.spyFirst")}</p>
              </div>
            )}
          </div>

          {canAttack && (
            <div className="space-y-4 border-t border-border/50 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-heading uppercase tracking-wider text-xs text-muted-foreground">
                    {t("attack.selectWeapon")}
                  </Label>
                  {isWeaponsLoading ? (
                    <Skeleton className="h-10 w-full bg-secondary" />
                  ) : (
                    <Select value={selectedWeaponId} onValueChange={setSelectedWeaponId}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder={t("attack.selectWeaponPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {myWeapons && myWeapons.length > 0 ? (
                          myWeapons.map((w) => (
                            <SelectItem key={w.weaponId} value={String(w.weaponId)}>
                              {w.weaponName} (x{w.quantity}) +{w.attackPower} ATK
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>{t("attack.noWeapons")}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="font-heading uppercase tracking-wider text-xs text-muted-foreground">
                    {t("attack.ammoQuantity")}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={ammoQuantity}
                    onChange={(e) => setAmmoQuantity(e.target.value)}
                    className="bg-background border-border font-mono"
                  />
                  {myAmmo && myAmmo.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {myAmmo.map(a => `${a.ammoName} x${a.quantity}`).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <Button
                variant="destructive"
                className="w-full sm:w-auto font-heading uppercase tracking-widest h-12 px-12 text-base"
                disabled={!selectedWeaponId || !ammoQuantity || initiateAttack.isPending}
                onClick={handleAttack}
              >
                <Swords className="w-5 h-5 mr-2" />
                {initiateAttack.isPending ? t("attack.dispatching") : t("attack.initiateAttack")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading uppercase flex items-center gap-2 text-destructive">
              <Swords className="w-5 h-5" /> {t("attack.myAttacks")}
            </CardTitle>
            <CardDescription>{t("attack.myAttacksDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isMyAttacksLoading ? (
              <div className="p-6 space-y-4"><Skeleton className="h-16 w-full bg-secondary" /></div>
            ) : myAttacks && myAttacks.length > 0 ? (
              <div className="divide-y divide-border/50">
                {myAttacks.map((atk) => (
                  <div key={atk.id} className="p-4 flex flex-col gap-2 hover:bg-secondary/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold font-heading uppercase text-lg">{t("attack.target")}: {atk.targetUsername}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {atk.weaponName} — {atk.ammoUsed} {t("attack.rounds")} — {atk.fromCityName} → {atk.toCityName}
                        </p>
                      </div>
                      {renderStatus(atk.status, atk.targetSurvived)}
                    </div>
                    {atk.status === "traveling" && atk.travelArrivalAt && (
                      <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-400/10 p-2 rounded border border-orange-400/20 mt-2">
                        <Clock className="w-4 h-4" /> {t("attack.arrivingIn")}: <CountdownTimer targetDate={atk.travelArrivalAt} />
                      </div>
                    )}
                    {atk.status === "completed" && atk.damageDealt !== null && (
                      <div className="text-sm mt-1 flex items-center gap-2">
                        {atk.targetSurvived ? (
                          <XCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        <span className="text-muted-foreground">
                          {t("attack.dealt")} <span className="font-bold text-foreground">{atk.damageDealt}</span> {t("attack.damage")}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">{t("attack.noOutgoing")}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading uppercase flex items-center gap-2 text-orange-500">
              <ShieldAlert className="w-5 h-5" /> {t("attack.incoming")}
            </CardTitle>
            <CardDescription>{t("attack.incomingDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isIncomingLoading ? (
              <div className="p-6 space-y-4"><Skeleton className="h-16 w-full bg-secondary" /></div>
            ) : incoming && incoming.length > 0 ? (
              <div className="divide-y divide-border/50">
                {incoming.map((atk) => (
                  <div key={atk.id} className="p-4 flex flex-col gap-2 hover:bg-secondary/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold font-heading uppercase text-lg text-destructive">
                          {t("attack.from")}: {atk.attackerUsername}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {atk.fromCityName} → {atk.toCityName}
                        </p>
                      </div>
                      {renderStatus(atk.status, atk.targetSurvived)}
                    </div>
                    {atk.status === "traveling" && atk.travelArrivalAt && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 mt-2">
                        <Clock className="w-4 h-4" /> {t("attack.impactIn")}: <CountdownTimer targetDate={atk.travelArrivalAt} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">{t("attack.noIncoming")}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
