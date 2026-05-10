import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { PlayingCard, CardSlot, suitForIndex } from "@/components/blackjack/PlayingCard";
import { Dealer } from "@/components/blackjack/Dealer";

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

async function jsonFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "include", ...opts });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

const CHIPS = [
  { value: 1000, color: "from-slate-400 to-slate-600", label: "1K" },
  { value: 5000, color: "from-rose-500 to-rose-700", label: "5K" },
  { value: 10000, color: "from-blue-500 to-blue-700", label: "10K" },
  { value: 25000, color: "from-emerald-500 to-emerald-700", label: "25K" },
  { value: 100000, color: "from-amber-400 to-amber-600", label: "100K" },
];

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
  const actionPending = hit.isPending || stand.isPending;

  // Stable seed across the full hand lifecycle (session → result), reset only on next deal.
  const handSeedRef = useRef<number>(0);
  useEffect(() => {
    if (session?.id) handSeedRef.current = session.id;
    else if (!lastResult) handSeedRef.current = 0;
  }, [session?.id, lastResult]);
  const handSeed = handSeedRef.current || session?.id || 1;

  const dealerMessage = useMemo(() => {
    if (lastResult) {
      if (lastResult.outcome === "blackjack") return "Blackjack! Beautifully played.";
      if (lastResult.outcome === "win") return "Congratulations — you beat the house!";
      if (lastResult.outcome === "bust") return "Bust! Better luck next hand.";
      return "Better luck next time.";
    }
    if (session) {
      if (session.playerTotal === 21) return "Twenty-one! Stand to lock it in.";
      if (session.playerTotal >= 17) return "Risky territory — hit or stand?";
      return "Your move. Hit or stand?";
    }
    return "Place your bet, and I'll deal you in.";
  }, [session, lastResult]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#1a0a0a] to-black p-3 sm:p-6" data-testid="blackjack-page">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-amber-300 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">
              {t("blackjack.title")}
            </h1>
            <p className="text-amber-200/50 text-xs sm:text-sm">{t("blackjack.subtitle")}</p>
          </div>
          <div className="flex gap-2 sm:gap-3 text-right">
            <StatPill label={t("common.money")} value={formatMoney(s.cash)} />
            <StatPill label={t("blackjack.gamesToday")} value={`${s.limits.playedToday}/${s.limits.dailyLimit}`} />
          </div>
        </div>

        {/* Casino Table */}
        <div
          className="relative rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-10 border-[6px] sm:border-8 border-[#3b1d0f] shadow-[0_25px_60px_rgba(0,0,0,0.7)]"
          style={{
            background:
              "radial-gradient(ellipse at center, #166534 0%, #14532d 50%, #052e16 100%)",
            boxShadow:
              "inset 0 0 120px rgba(0,0,0,0.55), inset 0 0 30px rgba(0,0,0,0.4), 0 25px 60px rgba(0,0,0,0.7)",
          }}
        >
          {/* Table arc text */}
          <div className="text-center mb-4 sm:mb-6">
            <div className="text-amber-300/90 font-serif text-lg sm:text-2xl tracking-[0.2em] drop-shadow">
              BLACKJACK PAYS 3:2
            </div>
            <div className="text-amber-200/40 text-[10px] sm:text-xs tracking-wider">
              Dealer must hit on 16 and stand on 17
            </div>
          </div>

          {/* Dealer */}
          <div className="flex flex-col items-center gap-4">
            <Dealer message={dealerMessage} active={!!session || !lastResult} />

            {/* Dealer cards — unified render so hidden→revealed flips instead of remounting */}
            <div className="min-h-[7rem] sm:min-h-[9rem] flex items-end justify-center gap-1 mt-2">
              {(() => {
                const cards = session
                  ? [session.dealerVisible[0], 0] // 0 = placeholder while hidden
                  : lastResult
                  ? lastResult.dealerHand
                  : null;
                if (!cards) return (<><CardSlot /><CardSlot /></>);
                return cards.map((c, i) => {
                  const isHidden = !!session && i >= 1;
                  // While hidden, show a stable placeholder value (will be replaced when revealed).
                  const value = isHidden ? 1 : c;
                  return (
                    <PlayingCard
                      key={`dealer-${i}`}
                      value={value}
                      suit={suitForIndex(handSeed, i)}
                      hidden={isHidden}
                      delay={i * 0.15}
                      index={i}
                      toPlayer={false}
                    />
                  );
                });
              })()}
            </div>
            <DealerTotal
              total={
                session
                  ? null
                  : lastResult
                  ? lastResult.dealerTotal
                  : null
              }
            />
          </div>

          {/* Divider */}
          <div className="my-6 sm:my-8 mx-auto w-3/4 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

          {/* Player */}
          <div className="flex flex-col items-center gap-3">
            <div className="min-h-[7rem] sm:min-h-[9rem] flex items-end justify-center gap-1">
              {(() => {
                const cards = session?.playerHand ?? lastResult?.playerHand ?? null;
                if (!cards) return (<><CardSlot /><CardSlot /></>);
                return cards.map((c, i) => (
                  <PlayingCard
                    key={`player-${i}`}
                    value={c}
                    suit={suitForIndex(handSeed + 99, i)}
                    delay={(session ? 0.3 : 0) + i * 0.15}
                    index={i}
                    toPlayer
                  />
                ));
              })()}
            </div>
            <PlayerTotal
              total={session ? session.playerTotal : lastResult ? lastResult.playerTotal : null}
              outcome={lastResult?.outcome}
            />
          </div>

          {/* Action area */}
          <div className="mt-6 sm:mt-8">
            {session ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-3 sm:gap-4">
                  <CasinoButton
                    onClick={() => hit.mutate()}
                    disabled={actionPending}
                    variant="hit"
                    testId="button-hit"
                  >
                    {t("blackjack.hit")}
                  </CasinoButton>
                  <CasinoButton
                    onClick={() => stand.mutate()}
                    disabled={actionPending}
                    variant="stand"
                    testId="button-stand"
                  >
                    {t("blackjack.stand")}
                  </CasinoButton>
                </div>
                <div className="text-xs text-amber-200/60">
                  {t("blackjack.bet")}: {formatMoney(session.betAmount)} • {t("blackjack.commission")}: {formatMoney(session.commission)}
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto bg-black/40 backdrop-blur-sm border border-amber-700/30 rounded-2xl p-4 sm:p-5">
                <div className="text-center text-amber-200/80 text-sm font-semibold mb-3 tracking-wider uppercase">
                  {t("blackjack.placeBet")}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Input
                    type="number"
                    min={s.limits.minBet}
                    max={s.limits.maxBet}
                    value={bet}
                    onChange={(e) => setBet(e.target.value)}
                    data-testid="input-bet"
                    className="bg-black/60 border-amber-700/50 text-amber-100 font-mono text-lg text-center"
                  />
                </div>
                <div className="flex flex-wrap gap-2 justify-center mb-3">
                  {CHIPS.map((chip) => (
                    <Chip
                      key={chip.value}
                      label={chip.label}
                      colorClass={chip.color}
                      onClick={() =>
                        setBet((b) => String(Math.min(s.limits.maxBet, (Number(b) || 0) + chip.value)))
                      }
                    />
                  ))}
                  <button
                    onClick={() => setBet(String(s.limits.minBet))}
                    className="text-[10px] text-amber-200/60 hover:text-amber-200 underline self-center"
                  >
                    Reset
                  </button>
                </div>
                <div className="text-[11px] text-amber-200/50 text-center mb-3">
                  Min {formatMoney(s.limits.minBet)} • Max {formatMoney(s.limits.maxBet)} • Commission {formatMoney(commissionPreview)}
                </div>
                <CasinoButton
                  onClick={() => start.mutate(betNum)}
                  disabled={start.isPending || betNum < s.limits.minBet || betNum > s.limits.maxBet || s.limits.remaining <= 0}
                  variant="deal"
                  fullWidth
                  testId="button-deal"
                >
                  {s.limits.remaining <= 0 ? t("blackjack.dailyLimitReached") : `${t("blackjack.deal")} • ${formatMoney(betNum)}`}
                </CasinoButton>
              </div>
            )}
          </div>
        </div>

        {/* Result banner */}
        <AnimatePresence>
          {lastResult && !session && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className={`mt-4 rounded-2xl p-4 text-center border ${
                lastResult.netProfit > 0
                  ? "bg-emerald-900/30 border-emerald-500/40"
                  : "bg-red-900/30 border-red-500/40"
              }`}
            >
              <div className="text-xs uppercase tracking-widest opacity-70">
                {lastResult.outcome}
              </div>
              <div
                className={`text-3xl font-bold ${
                  lastResult.netProfit > 0 ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {lastResult.netProfit >= 0 ? "+" : ""}
                {formatMoney(lastResult.netProfit)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/40 border border-amber-700/30 rounded-lg px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-widest text-amber-200/60">{label}</div>
      <div className="text-sm font-bold text-amber-100">{value}</div>
    </div>
  );
}

function DealerTotal({ total }: { total: number | null }) {
  return (
    <div className="text-center min-h-[1.5rem]">
      {total !== null && (
        <span className="inline-block bg-black/50 border border-amber-700/40 rounded-full px-3 py-0.5 text-amber-200 font-bold text-sm">
          Dealer: {total}
        </span>
      )}
    </div>
  );
}

function PlayerTotal({ total, outcome }: { total: number | null; outcome?: BJResult["outcome"] }) {
  if (total === null) return <div className="min-h-[1.5rem]" />;
  const color =
    outcome === "win" || outcome === "blackjack"
      ? "border-emerald-500/60 text-emerald-200"
      : outcome === "lose" || outcome === "bust"
      ? "border-red-500/60 text-red-200"
      : "border-amber-500/40 text-amber-100";
  return (
    <div className="text-center">
      <span className={`inline-block bg-black/60 border ${color} rounded-full px-4 py-1 font-bold text-base sm:text-lg`}>
        You: {total}
      </span>
    </div>
  );
}

function CasinoButton({
  children,
  onClick,
  disabled,
  variant,
  fullWidth,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant: "hit" | "stand" | "deal";
  fullWidth?: boolean;
  testId?: string;
}) {
  const styles = {
    hit: "bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 border-red-900",
    stand: "bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 border-blue-900",
    deal: "bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 border-amber-800 text-black",
  }[variant];
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`${styles} ${
        fullWidth ? "w-full" : "px-7 sm:px-9"
      } py-3 rounded-full font-bold uppercase tracking-widest text-sm shadow-[0_6px_0_rgba(0,0,0,0.4),0_10px_20px_rgba(0,0,0,0.4)] border-b-2 disabled:opacity-50 disabled:cursor-not-allowed text-white`}
    >
      {children}
    </motion.button>
  );
}

function Chip({ label, colorClass, onClick }: { label: string; colorClass: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={`relative w-11 h-11 rounded-full bg-gradient-to-br ${colorClass} border-2 border-dashed border-white/70 shadow-[0_4px_8px_rgba(0,0,0,0.5)] flex items-center justify-center text-white text-[11px] font-extrabold`}
    >
      <span className="absolute inset-1 rounded-full border border-white/40" />
      ${label}
    </motion.button>
  );
}

