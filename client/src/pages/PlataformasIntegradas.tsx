import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, PlugZap, Shield } from "lucide-react";

const platforms = [
  { id: "olx", name: "OLX" },
  { id: "chaves-na-mao", name: "Chaves na Mão" },
  { id: "zap", name: "Zap" },
  { id: "viva-real", name: "Viva Real" },
];

export default function PlataformasIntegradas() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="space-y-4">
            <div className="h-8 w-72 animate-pulse rounded bg-muted" />
            <div className="h-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user || user.role !== "administrativo") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Negado</h1>
          <p className="mb-6 text-muted-foreground">Esta área é exclusiva para administradores.</p>
          <Button asChild>
            <Link href="/dashboard">
              <a>Voltar para Dashboard</a>
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
        <div className="container space-y-6 py-8 md:py-10">
          <Button variant="outline" asChild className="rounded-full">
            <Link href="/dashboard">
              <a className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </a>
            </Link>
          </Button>

          <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                Plataformas Integradas
              </CardTitle>
              <CardDescription className="text-slate-600">
                Gerencie integrações externas de publicação e distribuição de imóveis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {platforms.map(platform => (
                  <Card
                    key={platform.id}
                    className="w-full rounded-3xl border-white/70 bg-white/95 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)]"
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                        <PlugZap className="h-4 w-4 text-slate-500" />
                        {platform.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <p className="text-sm text-slate-600">
                        Status da integração: <span className="font-medium text-amber-700">Não configurado</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Em breve: token, endpoint, sincronização automática e monitoramento de envio.
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
