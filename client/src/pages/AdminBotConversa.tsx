import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

const CHUNK_SIZE = 500;

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
    return (
      v
        .map(t => (typeof t === "string" ? t : (t as { name?: string })?.name))
        .filter(Boolean)
        .join(", ") || "—"
    );
  return String(v);
}

function displayName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  const first = row.full_name ?? "";
  if (first) return first;
  return (
    [row.first_name ?? "", row.last_name ?? ""].filter(Boolean).join(" ") || "—"
  );
}

export default function AdminBotConversa() {
  // Histórico de startPages visitados (para permitir Anterior sem
  // recalcular). Cada entrada é o `startPage` que foi passado ao
  // servidor para produzir aquele lote.
  const [history, setHistory] = useState<number[]>([1]);
  const [index, setIndex] = useState(0);
  const [search, setSearch] = useState("");
  const currentStartPage = history[index];

  const query = trpc.integracoesExternas.botconversa.listarContatos.useQuery(
    { startPage: currentStartPage, chunkSize: CHUNK_SIZE },
    {
      retry: false,
      staleTime: 5 * 60_000,
    }
  );

  const goNext = () => {
    if (!query.data?.nextStartPage) return;
    const next = query.data.nextStartPage;
    // Se já visitamos, só avança o índice (react-query serve do cache)
    if (history[index + 1] === next) {
      setIndex(index + 1);
      return;
    }
    // Descarta futuro (caso tenha voltado e mudou algo) e adiciona novo
    setHistory(h => [...h.slice(0, index + 1), next]);
    setIndex(index + 1);
  };

  const goPrev = () => {
    if (index === 0) return;
    setIndex(index - 1);
  };

  const total = query.data?.total ?? null;
  const chunkNumber = index + 1;
  const chunkStart = index * CHUNK_SIZE + 1;
  const chunkEnd = chunkStart + (query.data?.contatos.length ?? 0) - 1;

  /**
   * Filtro client-side: procura o termo em qualquer campo textual do
   * subscriber (nome/telefone/tags/id/etc). Só busca dentro do lote
   * atual — para pesquisar em tudo é preciso paginar até achar.
   */
  const filteredContatos = useMemo(() => {
    const raw = query.data?.contatos ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return raw;
    return raw.filter(c => {
      const haystack = Object.values(c)
        .map(v => (v == null ? "" : String(v)))
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [query.data?.contatos, search]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <MessageSquare className="h-6 w-6 text-emerald-700" />
              BotConversa
            </h1>
            <p className="text-sm text-muted-foreground">
              Contatos sincronizados da API BotConversa em lotes de{" "}
              {CHUNK_SIZE}. Novos lotes só são buscados quando você navega
              (o servidor consulta a API sob demanda).
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Recarregar lote atual
          </Button>
        </div>

        {query.error ? (
          <Card>
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-medium text-red-700">
                  Falha ao consultar o BotConversa
                </p>
                <p className="mt-1 text-muted-foreground">
                  {query.error.message}
                </p>
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
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>
                  Contatos {total != null ? `· ${total} no total` : ""}
                </CardTitle>
                <CardDescription>
                  {query.isFetching
                    ? "Buscando…"
                    : query.data
                      ? `Exibindo ${chunkStart}–${chunkEnd} · Lote ${chunkNumber}`
                      : "Aguardando…"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={index === 0 || query.isFetching}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={
                    !query.data?.nextStartPage || query.isFetching
                  }
                >
                  Próxima <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {query.data ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome, telefone, tag, ID…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filteredContatos.length} de{" "}
                    {query.data.contatos.length} resultados neste lote (busca
                    só nos contatos já carregados — mude de lote para
                    procurar em outros).
                  </p>
                ) : null}
              </div>
            ) : null}

            {query.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Carregando primeiro lote…
              </p>
            ) : query.data && query.data.contatos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum contato neste lote.
              </p>
            ) : query.data ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContatos.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Nenhum contato encontrado para "{search}" neste lote.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContatos.map((c, idx) => (
                        <TableRow key={String(c.id ?? `${index}-${idx}`)}>
                          <TableCell className="font-mono text-xs">
                            {String(c.id ?? "—")}
                          </TableCell>
                          <TableCell>{displayName(c)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {c.phone ?? "—"}
                          </TableCell>
                          <TableCell>{formatTags(c.tags)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(c.created_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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
