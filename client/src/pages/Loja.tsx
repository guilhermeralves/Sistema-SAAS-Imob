import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Coins, Package, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

export default function Loja() {
  const { data: balance } = trpc.store.myBalance.useQuery();

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <ShoppingBag className="h-6 w-6 text-emerald-700" />
              Loja
            </h1>
            <p className="text-sm text-muted-foreground">
              Troque seus tokens por produtos, viagens e serviços.
            </p>
          </div>
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

        <Card>
          <CardHeader>
            <CardTitle>Vitrine</CardTitle>
            <CardDescription>Produtos disponíveis para troca</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground" />
              <div className="max-w-md space-y-1">
                <p className="font-medium">Vitrine em construção</p>
                <p className="text-sm text-muted-foreground">
                  Em breve você poderá escolher produtos, viagens e serviços
                  para trocar pelos seus tokens acumulados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
