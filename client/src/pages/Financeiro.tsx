import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CircleDollarSign,
  HandCoins,
  Search,
  Shield,
  User,
} from "lucide-react";

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";
const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type FinancialRow = {
  id: number;
  titulo: string;
  responsavel: string;
  status: string;
  valor: string;
};

const initialRepasses: FinancialRow[] = [];
const initialCommissions: FinancialRow[] = [];

export default function Financeiro() {
  const { user, loading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("repasses");
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedSearchTerm = normalizeSearchValue(searchTerm.trim());

  const filteredRepasseRows = useMemo(() => {
    if (!normalizedSearchTerm) return initialRepasses;

    return initialRepasses.filter(item =>
      normalizeSearchValue(
        `${item.titulo} ${item.responsavel} ${item.status} ${item.valor}`
      ).includes(normalizedSearchTerm)
    );
  }, [normalizedSearchTerm]);

  const filteredCommissionRows = useMemo(() => {
    if (!normalizedSearchTerm) return initialCommissions;

    return initialCommissions.filter(item =>
      normalizeSearchValue(
        `${item.titulo} ${item.responsavel} ${item.status} ${item.valor}`
      ).includes(normalizedSearchTerm)
    );
  }, [normalizedSearchTerm]);

  const renderSearchInput = (placeholder: string) => (
    <div className="relative mt-2 max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={searchTerm}
        onChange={event => setSearchTerm(event.target.value)}
        placeholder={placeholder}
        className={`${FIELD_CLASS} pl-9`}
      />
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-muted" />
            <div className="h-64 rounded bg-muted" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <User className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Restrito</h1>
          <p className="mb-6 text-muted-foreground">
            Você precisa estar autenticado para acessar o financeiro.
          </p>
          <Button asChild>
            <a href={getLoginUrl()}>Fazer Login</a>
          </Button>
        </div>
      </Layout>
    );
  }

  if (user?.role !== "administrativo") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Negado</h1>
          <p className="mb-6 text-muted-foreground">
            Esta área é exclusiva para administradores.
          </p>
          <Button asChild>
            <a href="/">Voltar para Home</a>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
      <div className="container py-8 md:py-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Financeiro</h1>
          <p className="text-slate-600">
            Acompanhe repasses e comissões do sistema.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="min-h-[124px] rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium text-slate-600">Repasses</CardTitle>
              <HandCoins className="h-6 w-6 text-slate-500" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight text-slate-950">
                {filteredRepasseRows.length}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Itens financeiros para acompanhamento
              </p>
            </CardContent>
          </Card>

          <Card className="min-h-[124px] rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium text-slate-600">Comissões</CardTitle>
              <CircleDollarSign className="h-6 w-6 text-slate-500" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight text-slate-950">
                {filteredCommissionRows.length}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Comissões prontas para pagamento
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="rounded-full border border-slate-200 bg-white/90">
            <TabsTrigger value="repasses" className="gap-2">
              <HandCoins className="h-4 w-4" />
              Repasses
            </TabsTrigger>
            <TabsTrigger value="comissoes" className="gap-2">
              <CircleDollarSign className="h-4 w-4" />
              Comissões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="repasses">
            <Card className={SURFACE_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-slate-950">Todos os Repasses</CardTitle>
                <CardDescription className="text-slate-600">
                  Visualize os repasses registrados no sistema.
                </CardDescription>
                {renderSearchInput("Pesquisar repasses")}
              </CardHeader>
              <CardContent>
                {filteredRepasseRows.length > 0 ? (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRepasseRows.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.titulo}</TableCell>
                            <TableCell>{item.responsavel}</TableCell>
                            <TableCell>{item.status}</TableCell>
                            <TableCell>{item.valor}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <HandCoins className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                    <p className="text-slate-600">
                      {searchTerm
                        ? "Nenhum repasse encontrado para essa pesquisa"
                        : "Nenhum repasse cadastrado ainda"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comissoes">
            <Card className={SURFACE_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-slate-950">Todas as Comissões</CardTitle>
                <CardDescription className="text-slate-600">
                  Visualize as Comissões registradas no sistema.
                </CardDescription>
                {renderSearchInput("Pesquisar Comissões")}
              </CardHeader>
              <CardContent>
                {filteredCommissionRows.length > 0 ? (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCommissionRows.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.titulo}</TableCell>
                            <TableCell>{item.responsavel}</TableCell>
                            <TableCell>{item.status}</TableCell>
                            <TableCell>{item.valor}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <CircleDollarSign className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                    <p className="text-slate-600">
                      {searchTerm
                        ? "Nenhuma comiss\u00e3o encontrada para essa pesquisa"
                        : "Nenhuma comiss\u00e3o cadastrada ainda"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </Layout>
  );
}
