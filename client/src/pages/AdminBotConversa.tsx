import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Loader2, MessageSquare, RefreshCw } from "lucide-react";

/**
 * Página de teste da integração BotConversa. Ao clicar em "Sincronizar",
 * chama o endpoint tRPC integracoes.botconversa.listarContatos e
 * mostra numa tabela.
 */

function formatDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return v;
  }
}

function formatTags(v: unknown) {
  if (!v) return "—";
  if (Array.isArray(v))
    return v
      .map(t => (typeof t === "string" ? t : (t as { name?: string })?.name))
      .filter(Boolean)
      .join(", ") || "—";
  return String(v);
}

function displayName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  const first = row.full_name ?? "";
  if (first) return first;
  return [row.first_name ?? "", row.last_name ?? ""].filter(Boolean).join(" ")
    || "—";
}

export default function AdminBotConversa() {
  const { data, isLoading, isFetching, error, refetch } =
    trpc.integracoesExternas.botconversa.listarContatos.useQuery(undefined, {
      enabled: false, // só busca quando clicar em Sincronizar
      retry: false,
    });

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <MessageSquare className="h-6 w-6 text-emerald-700" />
              BotConversa
            </h1>
            <p className="text-sm text-muted-foreground">
              Teste de integração — lista de contatos do BotConversa via API.
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar
          </Button>
        </div>

        {error ? (
          <Card>
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-medium text-red-700">
                  Falha ao consultar o BotConversa
                </p>
                <p className="mt-1 text-muted-foreground">{error.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Verifique se <code>BOTCONVERSA_API_KEY</code> está preenchida
                  no <code>.env</code> do servidor e reinicie o dev.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>
              Contatos {data ? `(${data.total})` : ""}
            </CardTitle>
            <CardDescription>
              {isLoading || isFetching
                ? "Buscando…"
                : data
                  ? "Lista atual retornada pela API."
                  : "Clique em Sincronizar para carregar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data && data.total === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum contato retornado.
              </p>
            ) : data ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Última interação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contatos.map((c, idx) => (
                      <TableRow key={String(c.id ?? idx)}>
                        <TableCell className="font-mono text-xs">
                          {String(c.id ?? "—")}
                        </TableCell>
                        <TableCell>{displayName(c)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.phone ?? "—"}
                        </TableCell>
                        <TableCell>{formatTags(c.tags)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(c.last_interaction ?? c.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
