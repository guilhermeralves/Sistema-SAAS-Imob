import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowUpRight, Coins, Gift, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

export default function WalletAdminPanel({ userId }: { userId: number }) {
  const utils = trpc.useUtils();
  const { data: balance, isLoading: loadingBalance } =
    trpc.store.admin.userBalance.useQuery({ userId });
  const { data: transactions } = trpc.store.admin.userTransactions.useQuery({
    userId,
    limit: 20,
  });

  const [openMode, setOpenMode] = useState<null | "credit" | "debit">(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const giveBonus = trpc.store.admin.giveBonus.useMutation({
    onSuccess: async () => {
      toast.success("Bônus creditado.");
      close();
      await utils.store.admin.userBalance.invalidate({ userId });
      await utils.store.admin.userTransactions.invalidate({ userId });
    },
    onError: e => toast.error(e.message || "Falha ao creditar."),
  });

  const debit = trpc.store.admin.debitAdjustment.useMutation({
    onSuccess: async () => {
      toast.success("Ajuste registrado.");
      close();
      await utils.store.admin.userBalance.invalidate({ userId });
      await utils.store.admin.userTransactions.invalidate({ userId });
    },
    onError: e => toast.error(e.message || "Falha no ajuste."),
  });

  function close() {
    setOpenMode(null);
    setAmount("");
    setDescription("");
  }

  function submit() {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      toast.error("Informe uma quantidade inteira maior que zero.");
      return;
    }
    if (description.trim().length === 0) {
      toast.error("Descreva o motivo.");
      return;
    }
    if (openMode === "credit") {
      giveBonus.mutate({ userId, amount: value, description: description.trim() });
    } else if (openMode === "debit") {
      debit.mutate({ userId, amount: value, description: description.trim() });
    }
  }

  const isPending = giveBonus.isPending || debit.isPending;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-emerald-700" /> Carteira
            </CardTitle>
            <CardDescription>Saldo de tokens do usuário</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpenMode("debit")}
            >
              <ArrowDownRight className="mr-1 h-4 w-4" /> Ajustar
            </Button>
            <Button size="sm" onClick={() => setOpenMode("credit")}>
              <Gift className="mr-1 h-4 w-4" /> Bonificar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            {loadingBalance ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-semibold text-emerald-700">
                {balance?.tokens ?? 0}{" "}
                <span className="text-base text-muted-foreground">tokens</span>
              </div>
            )}
          </div>

          {transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Últimas movimentações</p>
              <div className="space-y-2">
                {transactions.slice(0, 5).map(tx => {
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
                          <p className="text-sm font-medium">{reasonLabel(tx.reason)}</p>
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
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={openMode !== null} onOpenChange={o => !o && close()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {openMode === "credit" ? "Bonificar tokens" : "Ajustar (debitar) tokens"}
            </DialogTitle>
            <DialogDescription>
              {openMode === "credit"
                ? "Credita tokens na carteira do usuário. Fica registrado no extrato dele."
                : "Débito manual. Use para corrigir lançamentos ou revogar bônus indevidos."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wallet-amount">Quantidade (tokens)</Label>
              <Input
                id="wallet-amount"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet-description">Motivo</Label>
              <Textarea
                id="wallet-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={
                  openMode === "credit"
                    ? "Ex: Bônus por bater meta do mês"
                    : "Ex: Estorno do bônus X lançado por engano"
                }
                rows={3}
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={isPending}>
              {isPending ? "Registrando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
