import { useGetMyAttacks, useGetIncomingAttacks, useGetMyWeapons, useGetMyAmmo, useInitiateAttack, getGetMyAttacksQueryKey, getGetIncomingAttacksQueryKey, getGetMyWeaponsQueryKey, getGetMyAmmoQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Swords, ShieldAlert, Clock, CheckCircle2, XCircle, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const target = new Date(targetDate).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("Arrived");
        return;
      }

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
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const prefilledTargetId = params.get("target") || "";

  const [targetPlayerId, setTargetPlayerId] = useState(prefilledTargetId);
  const [selectedWeaponId, setSelectedWeaponId] = useState("");
  const [ammoQuantity, setAmmoQuantity] = useState("10");

  const { data: myWeapons, isLoading: isWeaponsLoading } = useGetMyWeapons({ query: { queryKey: getGetMyWeaponsQueryKey() } });
  const { data: myAmmo } = useGetMyAmmo({ query: { queryKey: getGetMyAmmoQueryKey() } });
  const { data: myAttacks, isLoading: isMyAttacksLoading } = useGetMyAttacks({ query: { queryKey: getGetMyAttacksQueryKey() } });
  const { data: incoming, isLoading: isIncomingLoading } = useGetIncomingAttacks({ query: { queryKey: getGetIncomingAttacksQueryKey() } });

  const initiateAttack = useInitiateAttack({
    mutation: {
      onSuccess: (attack) => {
        queryClient.invalidateQueries({ queryKey: getGetMyAttacksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({
          title: "Attack Dispatched",
          description: `Your hit on Player #${attack.targetId} is en route. ETA: ${new Date(attack.travelArrivalAt!).toLocaleTimeString()}`,
          className: "bg-red-950 border-red-700 text-white",
        });
        setTargetPlayerId("");
        setSelectedWeaponId("");
        setAmmoQuantity("10");
      },
      onError: (err: any) => {
        toast({
          title: "Attack Failed",
          description: err?.response?.data?.error || "Could not dispatch attack.",
          variant: "destructive",
        });
      },
    },
  });

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

  const renderStatus = (status: string, result?: boolean | null) => {
    if (status === "traveling")
      return <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">Traveling</Badge>;
    if (status === "completed") {
      return result === false
        ? <Badge className="bg-green-500/20 text-green-500 border-green-500/50">Target Eliminated</Badge>
        : <Badge className="bg-destructive/20 text-destructive border-destructive/50">Target Survived</Badge>;
    }
    return <Badge variant="outline">Cancelled</Badge>;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.attack")}</h1>
        <Button onClick={() => setLocation("/players")} variant="outline" className="font-heading uppercase">
          Find Target
        </Button>
      </div>

      {/* Attack Form */}
      <Card className="bg-card border-destructive/40 shadow-[0_0_20px_rgba(220,38,38,0.1)]">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="font-heading uppercase flex items-center gap-2 text-destructive">
            <Target className="w-5 h-5" /> Dispatch a Hit
          </CardTitle>
          <CardDescription>Select your target, weapon, and ammo load-out to send an attack.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-id" className="font-heading uppercase tracking-wider text-xs text-muted-foreground">
                Target Player ID
              </Label>
              <Input
                id="target-id"
                type="number"
                placeholder="e.g. 42"
                value={targetPlayerId}
                onChange={(e) => setTargetPlayerId(e.target.value)}
                className="bg-background border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">Find IDs from the Players list.</p>
            </div>

            <div className="space-y-2">
              <Label className="font-heading uppercase tracking-wider text-xs text-muted-foreground">
                Weapon
              </Label>
              {isWeaponsLoading ? (
                <Skeleton className="h-10 w-full bg-secondary" />
              ) : (
                <Select value={selectedWeaponId} onValueChange={setSelectedWeaponId}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select a weapon..." />
                  </SelectTrigger>
                  <SelectContent>
                    {myWeapons && myWeapons.length > 0 ? (
                      myWeapons.map((w) => (
                        <SelectItem key={w.weaponId} value={String(w.weaponId)}>
                          {w.weaponName} (x{w.quantity}) +{w.attackPower} ATK
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No weapons owned — visit the shop</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ammo-qty" className="font-heading uppercase tracking-wider text-xs text-muted-foreground">
                Ammo Rounds
              </Label>
              <Input
                id="ammo-qty"
                type="number"
                min={1}
                placeholder="e.g. 10"
                value={ammoQuantity}
                onChange={(e) => setAmmoQuantity(e.target.value)}
                className="bg-background border-border font-mono"
              />
              {myAmmo && myAmmo.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ammo: {myAmmo.map(a => `${a.ammoName} x${a.quantity}`).join(", ")}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="destructive"
            className="w-full sm:w-auto font-heading uppercase tracking-widest h-12 px-12 text-base"
            disabled={!targetPlayerId || !selectedWeaponId || !ammoQuantity || initiateAttack.isPending}
            onClick={handleAttack}
          >
            <Swords className="w-5 h-5 mr-2" />
            {initiateAttack.isPending ? "Dispatching..." : "Send Hit"}
          </Button>
        </CardContent>
      </Card>

      {/* Attack History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading uppercase flex items-center gap-2 text-destructive">
              <Swords className="w-5 h-5" /> Outgoing Attacks
            </CardTitle>
            <CardDescription>Hits you've put out on others</CardDescription>
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
                        <p className="font-bold font-heading uppercase text-lg">Target: {atk.targetUsername}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {atk.weaponName} — {atk.ammoUsed} rounds — {atk.fromCityName} → {atk.toCityName}
                        </p>
                      </div>
                      {renderStatus(atk.status, atk.targetSurvived)}
                    </div>
                    {atk.status === "traveling" && atk.travelArrivalAt && (
                      <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-400/10 p-2 rounded border border-orange-400/20 mt-2">
                        <Clock className="w-4 h-4" /> Arriving in: <CountdownTimer targetDate={atk.travelArrivalAt} />
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
                          Dealt <span className="font-bold text-foreground">{atk.damageDealt}</span> damage
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">No outgoing attacks.</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading uppercase flex items-center gap-2 text-orange-500">
              <ShieldAlert className="w-5 h-5" /> Incoming Attacks
            </CardTitle>
            <CardDescription>Hits ordered on you</CardDescription>
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
                          From: {atk.attackerUsername}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {atk.fromCityName} → {atk.toCityName}
                        </p>
                      </div>
                      {renderStatus(atk.status, atk.targetSurvived)}
                    </div>
                    {atk.status === "traveling" && atk.travelArrivalAt && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 mt-2">
                        <Clock className="w-4 h-4" /> Impact in: <CountdownTimer targetDate={atk.travelArrivalAt} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">No incoming threats. Keep it that way.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
