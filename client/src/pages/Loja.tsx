import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Coins, Loader2, Package, Settings, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type Category = "todos" | "produto" | "viagem" | "servico";

function parseFotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const CATEGORY_LABELS: Record<Exclude<Category, "todos">, string> = {
  produto: "Produtos",
  viagem: "Viagens",
  servico: "Serviços",
};

export default function Loja() {
  const { user } = useAuth();
  const { data: balance } = trpc.store.myBalance.useQuery();
  const { data: products, isLoading } = trpc.store.listActiveProducts.useQuery();
  const [category, setCategory] = useState<Category>("todos");

  const filtered = useMemo(() => {
    const list = (products ?? []).map(p => ({ ...p, fotosList: parseFotos(p.fotos) }));
    if (category === "todos") return list;
    return list.filter(p => p.categoria === category);
  }, [products, category]);

  const isAdmin = user?.role === "administrativo";

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <ShoppingBag className="h-6 w-6 text-emerald-700" />
              Loja
            </h1>
            <p className="text-sm text-muted-foreground">
              Troque seus tokens por produtos, viagens e serviços.
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin ? (
              <Link href="/admin/loja">
                <a>
                  <Button variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" /> Gerenciar
                  </Button>
                </a>
              </Link>
            ) : null}
            <Link href="/carteira">
              <a>
                <Button variant="outline" className="gap-2">
                  <Coins className="h-4 w-4" />
                  <span>Saldo:</span>
                  <span className="font-semibold text-emerald-700">
                    {balance?.tokens ?? 0}
                  </span>
                </Button>
              </a>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["todos", "produto", "viagem", "servico"] as Category[]).map(cat => (
            <Button
              key={cat}
              size="sm"
              variant={category === cat ? "default" : "outline"}
              onClick={() => setCategory(cat)}
            >
              {cat === "todos" ? "Todos" : CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : filtered.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Vitrine</CardTitle>
              <CardDescription>Nenhum produto disponível nesta categoria.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground" />
                <p className="max-w-md text-sm text-muted-foreground">
                  {isAdmin
                    ? "Nenhum produto cadastrado ainda. Clique em 'Gerenciar' para adicionar."
                    : "Volte em breve — novos itens estão a caminho."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => {
              const canAfford = (balance?.tokens ?? 0) >= p.tokenPrice;
              return (
                <div
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-md"
                >
                  <div className="aspect-video bg-muted">
                    {p.fotosList[0] ? (
                      <img
                        src={p.fotosList[0]}
                        alt={p.nome}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <p className="line-clamp-1 font-medium">{p.nome}</p>
                    <p className="line-clamp-3 flex-1 text-xs text-muted-foreground">
                      {p.descricao || "—"}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 font-semibold text-emerald-700">
                        <Coins className="h-4 w-4" /> {p.tokenPrice}
                      </div>
                      {p.brlPriceCents > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          + {formatBRL(p.brlPriceCents)}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!canAfford && p.brlPriceCents === 0}
                      onClick={() => {
                        // Entrega 3 vai plugar o fluxo de compra + PIX aqui.
                        // Por ora, deixamos apenas visual.
                      }}
                    >
                      {p.brlPriceCents === 0
                        ? canAfford
                          ? "Trocar por tokens"
                          : "Tokens insuficientes"
                        : "Trocar + PIX"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
