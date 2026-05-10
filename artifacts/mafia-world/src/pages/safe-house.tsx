import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Home as HomeIcon, Shield, Clock, AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface Listing {
  playerPropertyId: number;
  ownerId: number;
  ownerName: string;
  level: number;
  nameEn: string;
  nameAr: string;
  suggestedRent: number;
}
interface Status {
  inSafeHouse: boolean;
  expiresAt: string | null;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Request failed");
  return r.json() as Promise<T>;
}

export default function SafeHousePage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rentValues, setRentValues] = useState<Record<number, string>>({});
  const [days, setDays] = useState<Record<number, string>>({});

  const listings = useQuery({
    queryKey: ["safe-house-listings"],
    queryFn: () => fetchJSON<Listing[]>("/api/safe-house/listings"),
  });
  const status = useQuery({
    queryKey: ["safe-house-me"],
    queryFn: () => fetchJSON<Status>("/api/safe-house/me"),
    refetchInterval: 30000,
  });

  const rent = useMutation({
    mutationFn: async (vars: { playerPropertyId: number; rentAmount: number; durationDays: number }) => {
      const r = await fetch("/api/safe-house/rent", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Rent failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: t("safeHouse.rented"),
        description: t("safeHouse.rentedDesc")
          .replace("{paid}", formatMoney(data.rentPaid))
          .replace("{owner}", formatMoney(data.ownerReceived)),
      });
      qc.invalidateQueries({ queryKey: ["safe-house-me"] });
      qc.invalidateQueries({ queryKey: ["safe-house-listings"] });
      qc.invalidateQueries({ queryKey: ["layout-player-rank"] });
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const expiresMs = status.data?.expiresAt ? new Date(status.data.expiresAt).getTime() - Date.now() : 0;
  const expiresHours = Math.max(0, Math.floor(expiresMs / 3600000));
  const expiresMinutes = Math.max(0, Math.floor((expiresMs % 3600000) / 60000));

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="safe-house-page">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-heading font-bold">{t("safeHouse.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("safeHouse.subtitle")}</p>
        </div>
      </div>

      {/* Current status */}
      <Card data-testid="safe-house-status-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><HomeIcon className="w-5 h-5" /> {t("safeHouse.myStatus")}</CardTitle></CardHeader>
        <CardContent>
          {status.isLoading ? <Skeleton className="h-12 w-full" /> :
           status.data?.inSafeHouse ? (
            <div className="flex items-center justify-between gap-4">
              <Badge variant="secondary" className="bg-emerald-900/40 text-emerald-300 border-emerald-700">
                {t("safeHouse.protected")}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {t("safeHouse.timeLeft")}: <span className="font-mono text-foreground">{expiresHours}h {expiresMinutes}m</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4" /> {t("safeHouse.notProtected")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listings */}
      <Card data-testid="safe-house-listings-card">
        <CardHeader><CardTitle>{t("safeHouse.availableInCity")}</CardTitle></CardHeader>
        <CardContent>
          {listings.isLoading ? <Skeleton className="h-32 w-full" /> :
           !listings.data?.length ? (
            <p className="text-muted-foreground text-sm">{t("safeHouse.noListings")}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {listings.data.map((l) => {
                const rentStr = rentValues[l.playerPropertyId] ?? String(l.suggestedRent);
                const rentNum = Number(rentStr) || 0;
                const dStr = days[l.playerPropertyId] ?? "7";
                const dNum = Math.max(1, Math.min(7, Number(dStr) || 7));
                return (
                  <div key={l.playerPropertyId} className="border border-border rounded-lg p-4 space-y-3 bg-card/50"
                       data-testid={`safe-house-listing-${l.playerPropertyId}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{language === "ar" ? l.nameAr : l.nameEn}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("safeHouse.owner")}: <span className="text-foreground">{l.ownerName}</span>
                          {" • "}{t("common.level")} {l.level}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">{t("safeHouse.rentAmount")}</label>
                        <Input type="number" min={10000} value={rentStr}
                          onChange={(e) => setRentValues({ ...rentValues, [l.playerPropertyId]: e.target.value })}
                          data-testid={`input-rent-${l.playerPropertyId}`} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{t("safeHouse.days")}</label>
                        <Input type="number" min={1} max={7} value={dStr}
                          onChange={(e) => setDays({ ...days, [l.playerPropertyId]: e.target.value })}
                          data-testid={`input-days-${l.playerPropertyId}`} />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("safeHouse.split")}: 35% {t("safeHouse.owner")} / 65% {t("safeHouse.house")}
                    </div>
                    <Button className="w-full" disabled={rent.isPending || rentNum < 10000}
                      onClick={() => rent.mutate({ playerPropertyId: l.playerPropertyId, rentAmount: rentNum, durationDays: dNum })}
                      data-testid={`button-rent-${l.playerPropertyId}`}>
                      {rent.isPending ? t("common.loading") : `${t("safeHouse.rent")} (${formatMoney(rentNum)})`}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
