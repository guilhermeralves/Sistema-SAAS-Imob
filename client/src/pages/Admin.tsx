import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatStoredDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Building2, FileText, Search, Shield, TrendingUp, User } from "lucide-react";
import { toast } from "sonner";

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildSearchText(
  item: Record<string, unknown>,
  extraValues: Array<string | number | null | undefined> = []
) {
  const values = Object.entries(item)
    .filter(([key, value]) => key !== "fotos" && value !== null && value !== undefined)
    .flatMap(([, value]) => {
      if (typeof value === "string" || typeof value === "number") {
        return [String(value)];
      }

      if (value instanceof Date) {
        return [formatStoredDate(value)];
      }

      return [];
    });

  const allValues = [
    ...values,
    ...extraValues
      .filter(value => value !== null && value !== undefined)
      .map(value => String(value)),
  ];

  return normalizeSearchValue(allValues.join(" "));
}

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("imoveis");
  const [searchTerm, setSearchTerm] = useState("");

  const highlightedPropertyId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("highlightProperty");
    return rawValue ? Number(rawValue) : null;
  }, []);

  const { data: users } = trpc.admin.users.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
  });

  const { data: properties, isLoading: loadingProperties } = trpc.properties.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
  });

  const { data: leads, isLoading: loadingLeads } = trpc.leads.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
  });

  const { data: contracts, isLoading: loadingContracts } = trpc.contracts.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
  });

  const assignLead = trpc.leads.assign.useMutation({
    onSuccess: () => {
      toast.success("Lead atribuído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atribuir lead");
    },
  });

  const corretoresAtivos = users?.filter(candidate => candidate.role === "corretor" && candidate.isActive === 1) || [];
  const normalizedSearchTerm = normalizeSearchValue(searchTerm.trim());

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    if (!normalizedSearchTerm) return properties;

    return properties.filter(property =>
      buildSearchText(property as Record<string, unknown>, [
        formatStoredDate(property.createdAt),
        property.cidade,
        property.estado,
      ]).includes(normalizedSearchTerm)
    );
  }, [properties, normalizedSearchTerm]);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    if (!normalizedSearchTerm) return leads;

    return leads.filter(lead =>
      buildSearchText(lead as Record<string, unknown>, [formatStoredDate(lead.createdAt)]).includes(normalizedSearchTerm)
    );
  }, [leads, normalizedSearchTerm]);

  const filteredContracts = useMemo(() => {
    if (!contracts) return [];
    if (!normalizedSearchTerm) return contracts;

    return contracts.filter(contract =>
      buildSearchText(contract as Record<string, unknown>, [
        formatStoredDate(contract.createdAt),
        formatStoredDate(contract.dataInicio),
        contract.dataFim ? formatStoredDate(contract.dataFim) : null,
      ]).includes(normalizedSearchTerm)
    );
  }, [contracts, normalizedSearchTerm]);

  const totalImoveis = properties?.length || 0;
  const imoveisAtivos = properties?.filter(property => property.status === "ativo").length || 0;
  const totalLeads = leads?.length || 0;
  const leadsFechados = leads?.filter(lead => lead.status === "fechado").length || 0;
  const totalContratos = contracts?.length || 0;
  const contratosAtivos = contracts?.filter(contract => contract.status === "ativo").length || 0;

  useEffect(() => {
    if (!highlightedPropertyId || !properties?.length || activeTab !== "imoveis") return;

    const row = document.querySelector(`[data-property-row="${highlightedPropertyId}"]`);
    if (row instanceof HTMLElement) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeTab, highlightedPropertyId, properties]);

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
            Você precisa estar autenticado para acessar o painel administrativo.
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
          <p className="mb-6 text-muted-foreground">Esta área é exclusiva para administradores.</p>
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
          <h1 className="mb-2 text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie imóveis, leads e contratos do sistema</p>
          <div className="mt-4">
            <Link href="/admin/users" className="text-sm font-medium text-primary underline">
              Abrir painel completo de usuários
            </Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="min-h-[124px] rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium">Imóveis</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight">{totalImoveis}</div>
              <p className="text-xs text-muted-foreground">{imoveisAtivos} ativos</p>
            </CardContent>
          </Card>

          <Card className="min-h-[124px] rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium">Leads</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight">{totalLeads}</div>
              <p className="text-xs text-muted-foreground">{leadsFechados} fechados</p>
            </CardContent>
          </Card>

          <Card className="min-h-[124px] rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium">Contratos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight">{totalContratos}</div>
              <p className="text-xs text-muted-foreground">{contratosAtivos} ativos</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="imoveis" className="gap-2">
              <Building2 className="h-4 w-4" />
              Imóveis
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="contratos" className="gap-2">
              <FileText className="h-4 w-4" />
              Contratos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="imoveis">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Imóveis</CardTitle>
                <CardDescription>Visualize todos os imóveis cadastrados no sistema</CardDescription>
                {renderSearchInput("Pesquisar imóveis")}
              </CardHeader>
              <CardContent>
                {loadingProperties ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(item => (
                      <div key={item} className="h-16 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : filteredProperties.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Corretor</TableHead>
                          <TableHead>Cadastro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProperties.map(property => (
                          <TableRow
                            key={property.id}
                            data-property-row={property.id}
                            className={property.id === highlightedPropertyId ? "bg-primary/5 ring-1 ring-primary/20" : ""}
                          >
                            <TableCell className="font-medium">{property.titulo}</TableCell>
                            <TableCell className="capitalize">{property.tipo}</TableCell>
                            <TableCell>{property.cidade}/{property.estado}</TableCell>
                            <TableCell>
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-medium ${
                                  property.status === "ativo"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {property.status}
                              </span>
                            </TableCell>
                            <TableCell>ID {property.idCorretor}</TableCell>
                            <TableCell>{formatStoredDate(property.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum imóvel encontrado para essa pesquisa" : "Nenhum imóvel cadastrado"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Leads</CardTitle>
                <CardDescription>Visualize todos os leads do sistema</CardDescription>
                {renderSearchInput("Pesquisar leads")}
              </CardHeader>
              <CardContent>
                {loadingLeads ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(item => (
                      <div key={item} className="h-16 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : filteredLeads.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Cadastro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeads.map(lead => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.nome}</TableCell>
                            <TableCell>{lead.email || "—"}</TableCell>
                            <TableCell>{lead.telefone || "—"}</TableCell>
                            <TableCell>
                              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">
                                {lead.status}
                              </span>
                            </TableCell>
                            <TableCell className="capitalize">{lead.origem || "—"}</TableCell>
                            <TableCell>
                              <Select
                                value={lead.idResponsavel ? String(lead.idResponsavel) : "unassigned"}
                                onValueChange={value =>
                                  assignLead.mutate({
                                    leadId: lead.id,
                                    userId: value === "unassigned" ? null : Number(value),
                                  })
                                }
                              >
                                <SelectTrigger className="w-44">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                                  {corretoresAtivos.map(corretor => (
                                    <SelectItem key={corretor.id} value={String(corretor.id)}>
                                      {corretor.name || corretor.email || `Corretor #${corretor.id}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{formatStoredDate(lead.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum lead encontrado para essa pesquisa" : "Nenhum lead encontrado"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contratos">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Contratos</CardTitle>
                <CardDescription>Visualize todos os contratos do sistema</CardDescription>
                {renderSearchInput("Pesquisar contratos")}
              </CardHeader>
              <CardContent>
                {loadingContracts ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(item => (
                      <div key={item} className="h-16 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : filteredContracts.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Imóvel</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data Início</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContracts.map(contract => (
                          <TableRow key={contract.id}>
                            <TableCell className="font-medium">#{contract.id}</TableCell>
                            <TableCell>ID {contract.idCliente}</TableCell>
                            <TableCell>ID {contract.idImovel}</TableCell>
                            <TableCell className="capitalize">{contract.tipo}</TableCell>
                            <TableCell>
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-medium ${
                                  contract.status === "ativo"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {contract.status}
                              </span>
                            </TableCell>
                            <TableCell>{formatStoredDate(contract.dataInicio)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum contrato encontrado para essa pesquisa" : "Nenhum contrato encontrado"}
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
