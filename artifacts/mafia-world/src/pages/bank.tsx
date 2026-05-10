import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Landmark, ArrowDownToLine, ArrowUpFromLine, HandCoins, History, AlertTriangle, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface BankLoan {
  id: number;
  principal: number;
  remaining: number;
  interestRate: number;
  takenAt: string;
  dueAt: string;
  status: "active" | "repaid" | "defaulted";
  isOverdue: boolean;
}
interface BankAccount {
  bankBalance: number;
  cash: number;
  interestRatePerHour: number;
  accruedInterest: number;
  nextInterestAt: string | null;
  loans: BankLoan[];
  creditLimit: number;
  outstandingLoanTotal: number;
  availableCredit: number;
  loanTermDays: number;
  loanInterestPercent: number;
}
interface BankTransaction {
  id: number;
  type: "deposit" | "withdraw" | "interest" | "loan_taken" | "loan_repaid" | "loan_garnished" | "loan_default_seize";
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

function formatDate(s: string) {
  return new Date(s).toLocaleString();
}

function txSign(type: BankTransaction["type"]): 1 | -1 {
  switch (type) {
    case "deposit":
    case "interest":
    case "loan_taken":
      return 1;
    case "withdraw":
    case "loan_repaid":
    case "loan_garnished":
    case "loan_default_seize":
      return -1;
  }
}

export default function BankPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [loanAmt, setLoanAmt] = useState("");

  const { data: account, isLoading } = useQuery<BankAccount>({
    queryKey: ["bank-account"],
    queryFn: async () => {
      const r = await fetch("/api/bank/me", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: txs } = useQuery<BankTransaction[]>({
    queryKey: ["bank-transactions"],
    queryFn: async () => {
      const r = await fetch("/api/bank/transactions?limit=50", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bank-account"] });
    qc.invalidateQueries({ queryKey: ["bank-transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const post = async (path: string, body?: unknown) => {
    const r = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "Request failed" })) as { error: string };
      throw new Error(err.error);
    }
    return r.json();
  };

  const depositM = useMutation({
    mutationFn: (amount: number) => post("/api/bank/deposit", { amount }),
    onSuccess: () => {
      toast({ title: t("bank.depositOk") });
      setDepositAmt("");
      invalidate();
    },
    onError: (e: Error) => toast({ title: t("bank.failed"), description: e.message, variant: "destructive" }),
  });

  const withdrawM = useMutation({
    mutationFn: (amount: number) => post("/api/bank/withdraw", { amount }),
    onSuccess: () => {
      toast({ title: t("bank.withdrawOk") });
      setWithdrawAmt("");
      invalidate();
    },
    onError: (e: Error) => toast({ title: t("bank.failed"), description: e.message, variant: "destructive" }),
  });

  const loanM = useMutation({
    mutationFn: (amount: number) => post("/api/bank/loan/request", { amount }),
    onSuccess: () => {
      toast({ title: t("bank.loanOk") });
      setLoanAmt("");
      invalidate();
    },
    onError: (e: Error) => toast({ title: t("bank.failed"), description: e.message, variant: "destructive" }),
  });

  const repayM = useMutation({
    mutationFn: (loanId: number) => post(`/api/bank/loan/${loanId}/repay`),
    onSuccess: () => {
      toast({ title: t("bank.repayOk") });
      invalidate();
    },
    onError: (e: Error) => toast({ title: t("bank.failed"), description: e.message, variant: "destructive" }),
  });

  if (isLoading || !account) {
    return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Landmark className="w-6 h-6 text-primary" />
          {t("bank.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("bank.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("bank.balance")}</div>
            <div className="text-xl font-bold text-primary">{formatMoney(account.bankBalance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("bank.cash")}</div>
            <div className="text-xl font-bold">{formatMoney(account.cash)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />{t("bank.interest")}
            </div>
            <div className="text-xl font-bold text-green-400">0.1% / {t("bank.hour")}</div>
            <div className="text-[10px] text-muted-foreground">
              {t("bank.accrued")}: {formatMoney(account.accruedInterest)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("bank.creditAvailable")}</div>
            <div className="text-xl font-bold">{formatMoney(account.availableCredit)}</div>
            <div className="text-[10px] text-muted-foreground">/ {formatMoney(account.creditLimit)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deposit">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deposit"><ArrowDownToLine className="w-4 h-4 mr-1" />{t("bank.tabs.deposit")}</TabsTrigger>
          <TabsTrigger value="loans"><HandCoins className="w-4 h-4 mr-1" />{t("bank.tabs.loans")}</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-1" />{t("bank.tabs.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("bank.depositTitle")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{t("bank.depositHelp")}</p>
              <div className="flex gap-2">
                <Input type="number" placeholder={t("bank.amount")}
                  value={depositAmt} onChange={e => setDepositAmt(e.target.value)} min={1} />
                <Button onClick={() => depositM.mutate(Math.floor(Number(depositAmt)))}
                  disabled={depositM.isPending || !depositAmt || Number(depositAmt) <= 0}>
                  <ArrowDownToLine className="w-4 h-4 mr-1" />
                  {depositM.isPending ? t("bank.processing") : t("bank.deposit")}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("bank.withdrawTitle")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{t("bank.withdrawHelp")}</p>
              <div className="flex gap-2">
                <Input type="number" placeholder={t("bank.amount")}
                  value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} min={1} />
                <Button variant="secondary" onClick={() => withdrawM.mutate(Math.floor(Number(withdrawAmt)))}
                  disabled={withdrawM.isPending || !withdrawAmt || Number(withdrawAmt) <= 0}>
                  <ArrowUpFromLine className="w-4 h-4 mr-1" />
                  {withdrawM.isPending ? t("bank.processing") : t("bank.withdraw")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("bank.requestLoanTitle")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("bank.loanHelp")
                  .replace("{rate}", String(account.loanInterestPercent))
                  .replace("{days}", String(account.loanTermDays))
                  .replace("{credit}", formatMoney(account.availableCredit))}
              </p>
              <div className="flex gap-2">
                <Input type="number" placeholder={t("bank.amount")}
                  value={loanAmt} onChange={e => setLoanAmt(e.target.value)} min={1} max={account.availableCredit} />
                <Button onClick={() => loanM.mutate(Math.floor(Number(loanAmt)))}
                  disabled={loanM.isPending || !loanAmt || Number(loanAmt) <= 0 || Number(loanAmt) > account.availableCredit}>
                  <HandCoins className="w-4 h-4 mr-1" />
                  {loanM.isPending ? t("bank.processing") : t("bank.borrow")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("bank.activeLoans")}</CardTitle></CardHeader>
            <CardContent>
              {account.loans.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("bank.noLoans")}</p>
              ) : (
                <div className="space-y-2">
                  {account.loans.map(loan => (
                    <div key={loan.id} className="flex items-center justify-between gap-2 p-3 rounded border border-border bg-card">
                      <div className="text-sm">
                        <div className="font-medium flex items-center gap-2">
                          #{loan.id} — {formatMoney(loan.remaining)}
                          {loan.isOverdue && (
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="w-3 h-3 mr-1" />{t("bank.overdue")}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("bank.principal")}: {formatMoney(loan.principal)} · {t("bank.due")}: {formatDate(loan.dueAt)}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => repayM.mutate(loan.id)}
                        disabled={repayM.isPending || account.cash < loan.remaining}>
                        {t("bank.repay")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          <Card>
            <CardContent className="p-0">
              {!txs || txs.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">{t("bank.noHistory")}</p>
              ) : (
                <div className="divide-y divide-border">
                  {txs.map(tx => {
                    const sign = txSign(tx.type);
                    const colorCls = sign > 0 ? "text-green-400" : "text-red-400";
                    return (
                      <div key={tx.id} className="flex items-center justify-between gap-2 px-4 py-3">
                        <div>
                          <div className="text-sm font-medium">{t(`bank.tx.${tx.type}`)}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold ${colorCls}`}>
                            {sign > 0 ? "+" : "-"}{formatMoney(tx.amount)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {t("bank.balanceAfter")}: {formatMoney(tx.balanceAfter)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
