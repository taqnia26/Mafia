import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Spade } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface BJState {
  session: null | {
    id: number;
    betAmount: number;
    commission: number;
    effectiveBet: number;
    playerHand: number[];
    playerTotal: number;
    dealerVisible: number[];
    status: string;
  };
  limits: {
    dailyLimit: number; playedToday: number; remaining: number;
    minBet: number; maxBet: number;
    commissionPct: number; payoutMultiplier: number;
  };
  cash: number;
}

interface BJResult {
  playerHand: number[]; playerTotal: number;
  dealerHand: number[]; dealerTotal: number;
  outcome: "win" | "lose" | "blackjack" | "bust";
  payout: number; netProfit: number;
}

function cardLabel(c: number): string {
  if (c === 1) return "A";
  if (c === 11) return "J";
  if (c === 12) return "Q";
  if (c === 13) return "K";
  return String(c);
}

function CardChip({ value }: { value: number }) {
  return (
    <div className="w-12 h-16 rounded-md bg-white text-black border-2 border-slate-300 flex items-center justify-center font-bold text-lg shadow-md">
      {cardLabel(value)}
    </div>
  );
}

async function jsonFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "include", ...opts });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export default function BlackjackPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [bet, setBet] = useState("10000");
  const [lastResult, setLastResult] = useState<BJResult | null>(null);

  const state = useQuery({
    queryKey: ["blackjack-state"],
    queryFn: () => jsonFetch<BJState>("/api/casino/blackjack/state"),
  });

  const start = useMutation({
    mutationFn: (betAmount: number) => jsonFetch("/api/casino/blackjack/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ betAmount }),
    }),
    onSuccess: () => { setLastResult(null); qc.invalidateQueries({ queryKey: ["blackjack-state"] }); },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const hit = useMutation({
    mutationFn: () => jsonFetch<BJResult | { status: string }>("/api/casino/blackjack/hit", { method: "POST" }),
    onSuccess: (data) => {
      if ("outcome" in data) { setLastResult(data); }
      qc.invalidateQueries({ queryKey: ["blackjack-state"] });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const stand = useMutation({
    mutationFn: () => jsonFetch<BJResult>("/api/casino/blackjack/stand", { method: "POST" }),
    onSuccess: (data) => {
      setLastResult(data);
      qc.invalidateQueries({ queryKey: ["blackjack-state"] });
      toast({
        title: data.outcome === "win" || data.outcome === "blackjack" ? t("blackjack.youWin") : t("blackjack.youLose"),
        description: `${data.outcome.toUpperCase()} • ${data.netProfit >= 0 ? "+" : ""}${formatMoney(data.netProfit)}`,
        variant: data.netProfit > 0 ? "default" : "destructive",
      });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  if (state.isLoading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  const s = state.data!;
  const session = s.session;
  const betNum = Number(bet) || 0;
  const commissionPreview = Math.floor(betNum * s.limits.commissionPct);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="blackjack-page">
      <div className="flex items-center gap-3">
        <Spade className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-heading font-bold">{t("blackjack.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("blackjack.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{t("common.money")}</div><div className="text-xl font-bold">{formatMoney(s.cash)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{t("blackjack.gamesToday")}</div><div className="text-xl font-bold">{s.limits.playedToday} / {s.limits.dailyLimit}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{t("blackjack.payout")}</div><div className="text-xl font-bold">{s.limits.payoutMultiplier}x</div></CardContent></Card>
      </div>

      {/* Active session */}
      {session ? (
        <Card data-testid="blackjack-active-session">
          <CardHeader><CardTitle>{t("blackjack.currentHand")}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">{t("blackjack.dealer")}</div>
              <div className="flex gap-2">
                {session.dealerVisible.map((c, i) => <CardChip key={i} value={c} />)}
                <div className="w-12 h-16 rounded-md bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-2xl">?</div>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">{t("blackjack.you")} ({session.playerTotal})</div>
              <div className="flex gap-2 flex-wrap">
                {session.playerHand.map((c, i) => <CardChip key={i} value={c} />)}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => hit.mutate()} disabled={hit.isPending} data-testid="button-hit">{t("blackjack.hit")}</Button>
              <Button variant="secondary" onClick={() => stand.mutate()} disabled={stand.isPending} data-testid="button-stand">{t("blackjack.stand")}</Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {t("blackjack.bet")}: {formatMoney(session.betAmount)} • {t("blackjack.commission")}: {formatMoney(session.commission)}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("blackjack.placeBet")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">{t("blackjack.bet")} ({formatMoney(s.limits.minBet)} - {formatMoney(s.limits.maxBet)})</label>
              <Input type="number" min={s.limits.minBet} max={s.limits.maxBet} value={bet}
                     onChange={(e) => setBet(e.target.value)} data-testid="input-bet" />
              <div className="text-xs text-muted-foreground mt-1">
                {t("blackjack.commission")} (15%): {formatMoney(commissionPreview)}
              </div>
            </div>
            <Button onClick={() => start.mutate(betNum)}
              disabled={start.isPending || betNum < s.limits.minBet || betNum > s.limits.maxBet || s.limits.remaining <= 0}
              data-testid="button-deal">
              {s.limits.remaining <= 0 ? t("blackjack.dailyLimitReached") : t("blackjack.deal")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Last result */}
      {lastResult && !session && (
        <Card data-testid="blackjack-last-result">
          <CardHeader><CardTitle>
            <Badge className={lastResult.netProfit > 0 ? "bg-emerald-700" : "bg-red-700"}>
              {lastResult.outcome.toUpperCase()}
            </Badge>
            <span className="ml-2">{lastResult.netProfit >= 0 ? "+" : ""}{formatMoney(lastResult.netProfit)}</span>
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t("blackjack.dealer")} ({lastResult.dealerTotal})</div>
              <div className="flex gap-2 flex-wrap">{lastResult.dealerHand.map((c, i) => <CardChip key={i} value={c} />)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t("blackjack.you")} ({lastResult.playerTotal})</div>
              <div className="flex gap-2 flex-wrap">{lastResult.playerHand.map((c, i) => <CardChip key={i} value={c} />)}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
