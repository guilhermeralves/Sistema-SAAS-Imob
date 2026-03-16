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
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={searchTerm}
        onChange={event => setSearchTerm(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
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
            Voc\u00ea precisa estar autenticado para acessar o financeiro.
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
            Esta \u00e1rea \u00e9 exclusiva para administradores.
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
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">
            Acompanhe repasses e comiss\u00f5es do sistema.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="min-h-[124px] rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium">Repasses</CardTitle>
              <HandCoins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight">
                {filteredRepasseRows.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Itens financeiros para acompanhamento
              </p>
            </CardContent>
          </Card>

          <Card className="min-h-[124px] rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium">Comiss\u00f5es</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight">
                {filteredCommissionRows.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Comiss\u00f5es prontas para c\u00e1lculo e confer\u00eancia
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="repasses" className="gap-2">
              <HandCoins className="h-4 w-4" />
              Repasses
            </TabsTrigger>
            <TabsTrigger value="comissoes" className="gap-2">
              <CircleDollarSign className="h-4 w-4" />
              Comiss\u00f5es
            </TabsTrigger>
          </TabsList>

          <TabsContent value="repasses">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Repasses</CardTitle>
                <CardDescription>
                  Visualize os repasses registrados no sistema.
                </CardDescription>
                {renderSearchInput("Pesquisar repasses")}
              </CardHeader>
              <CardContent>
                {filteredRepasseRows.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>T\u00edtulo</TableHead>
                          <TableHead>Respons\u00e1vel</TableHead>
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
                    <HandCoins className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
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
            <Card>
              <CardHeader>
                <CardTitle>Todas as Comiss\u00f5es</CardTitle>
                <CardDescription>
                  Visualize as comiss\u00f5es registradas no sistema.
                </CardDescription>
                {renderSearchInput("Pesquisar comiss\u00f5es")}
              </CardHeader>
              <CardContent>
                {filteredCommissionRows.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>T\u00edtulo</TableHead>
                          <TableHead>Respons\u00e1vel</TableHead>
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
                    <CircleDollarSign className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
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
    </Layout>
  );
}
