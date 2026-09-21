import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowUpRight, Coins, Loader2 } from "lucide-react";
import { useMemo } from "react";

function formatDate(v: string | Date) {
  try {
    return new Date(v).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    admin_bonus: "Bônus manual",
    sale_close: "Venda fechada",
    rental_close: "Locação fechada",
    store_purchase: "Compra na loja",
    purchase_refund: "Estorno de compra",
  };
  return map[reason] ?? reason;
}

export default function Carteira() {
  const { data: balance, isLoading: loadingBalance } =
    trpc.store.myBalance.useQuery();
  const { data: transactions, isLoading: loadingTx } =
    trpc.store.myTransactions.useQuery({ limit: 50 });

  const totals = useMemo(() => {
    if (!transactions) return { credits: 0, debits: 0 };
    let credits = 0;
    let debits = 0;
    for (const t of transactions) {
      if (t.type === "credit") credits += t.amount;
      else debits += t.amount;
    }
    return { credits, debits };
  }, [transactions]);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Minha Carteira</h1>
          <p className="text-sm text-muted-foreground">
            Seus tokens acumulados por bonificações. Use-os depois na Loja.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Saldo atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBalance ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-3xl font-semibold text-emerald-700">
                  {balance?.tokens ?? 0} <span className="text-base text-muted-foreground">tokens</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                Créditos (histórico)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">+{totals.credits}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-rose-600" />
                Débitos (histórico)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">-{totals.debits}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Extrato</CardTitle>
            <CardDescription>Últimas 50 movimentações</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTx ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma movimentação ainda. Assim que você concluir sua primeira
                intermediação, os tokens aparecem aqui.
              </p>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => {
                  const positive = tx.type === "credit";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        {positive ? (
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 shrink-0 text-rose-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {reasonLabel(tx.reason)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.description || "—"} • {formatDate(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div
                        className={
                          "font-semibold " +
                          (positive ? "text-emerald-700" : "text-rose-700")
                        }
                      >
                        {positive ? "+" : "-"}
                        {tx.amount}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
