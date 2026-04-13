import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Building2, KeyRound, Shield } from "lucide-react";

type PropertyKeyStatus = "disponivel" | "retirada" | "indisponivel";

const KEY_STATUS_META: Record<
  PropertyKeyStatus,
  { label: string; badgeClass: string }
> = {
  disponivel: {
    label: "Disponível",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  retirada: {
    label: "Retirada",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  indisponivel: {
    label: "Indisponível",
    badgeClass: "bg-rose-100 text-rose-700",
  },
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isTerrenoType(value: string | null | undefined) {
  if (!value) return false;
  return normalizeSearchValue(value).includes("terreno");
}

function formatDateTimeInSaoPaulo(value: Date | string | null | undefined, fallback = "-") {
  if (!value) return fallback;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return fallback;
  }

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return formatter.format(parsedDate).replace(",", " às");
}

export default function ControleDeChaves() {
  const { user, loading } = useAuth();

  const { data: properties, isLoading } = trpc.properties.list.useQuery(
    { showDeletedOnly: false },
    {
      enabled: user?.role === "administrativo",
    }
  );

  const keyProperties = (properties ?? []).filter(property => !isTerrenoType(property.tipo));

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
                Controle de Chaves
              </CardTitle>
              <CardDescription className="text-slate-600">
                Lista de imóveis vinculados a chave com status e informações atualizadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(item => (
                    <div key={item} className="h-16 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : keyProperties.length > 0 ? (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Imóvel</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Status da chave</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead>Atualizado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keyProperties.map(property => {
                        const keyStatus = (property.keyStatus as PropertyKeyStatus) ?? "disponivel";
                        return (
                          <TableRow key={property.id}>
                            <TableCell className="font-medium">
                              <Link href={`/imoveis/${property.id}`}>
                                <a className="inline-flex items-center gap-2 text-slate-900 hover:text-emerald-700 hover:underline">
                                  <KeyRound className="h-4 w-4 text-slate-500" />
                                  {property.titulo}
                                </a>
                              </Link>
                            </TableCell>
                            <TableCell>{property.cidade}/{property.estado}</TableCell>
                            <TableCell>
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${KEY_STATUS_META[keyStatus].badgeClass}`}>
                                {KEY_STATUS_META[keyStatus].label}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-xs truncate" title={property.keyStatusObservation || "Sem observação"}>
                              {property.keyStatusObservation || "Sem observação"}
                            </TableCell>
                            <TableCell>{formatDateTimeInSaoPaulo(property.keyStatusUpdatedAt)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                  <p className="text-slate-600">Nenhum imóvel com chave vinculado no momento.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
