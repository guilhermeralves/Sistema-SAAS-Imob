import { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { trpc } from "@/lib/trpc";
import { Building2, FileText, TrendingUp, User, Shield } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

/**
 * Painel Administrativo
 * 
 * Página exclusiva para administradores gerenciarem usuários, imóveis e visualizarem métricas.
 */

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();

  const { data: users } = trpc.admin.users.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "administrativo" }
  );

  const { data: properties, isLoading: loadingProperties } = trpc.properties.list.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "administrativo" }
  );

  const { data: leads, isLoading: loadingLeads } = trpc.leads.list.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "administrativo" }
  );

  const { data: contracts, isLoading: loadingContracts } = trpc.contracts.list.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "administrativo" }
  );

  const assignLead = trpc.leads.assign.useMutation({
    onSuccess: () => {
      toast.success("Lead atribuído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atribuir lead");
    },
  });

  const corretoresAtivos = users?.filter((u) => u.role === "corretor" && u.isActive === 1) || [];

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground mb-6">
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
          <Shield className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
            Esta área é exclusiva para administradores.
          </p>
          <Button asChild>
            <a href="/">Voltar para Home</a>
          </Button>
        </div>
      </Layout>
    );
  }

  // Cálculo de métricas
  const totalImoveis = properties?.length || 0;
  const imoveisAtivos = properties?.filter((p) => p.status === "ativo").length || 0;
  const totalLeads = leads?.length || 0;
  const leadsFechados = leads?.filter((l) => l.status === "fechado").length || 0;
  const totalContratos = contracts?.length || 0;
  const contratosAtivos = contracts?.filter((c) => c.status === "ativo").length || 0;
  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Painel Administrativo</h1>
          <p className="text-muted-foreground">
            Gerencie imóveis, leads e contratos do sistema
          </p>
          <div className="mt-4">
            <Link href="/admin/users">
              <a className="text-sm font-medium text-primary underline">
                Abrir painel completo de usuários
              </a>
            </Link>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="min-h-[124px] rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-6 pt-5 pb-2">
              <CardTitle className="text-sm font-medium">Imóveis</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight">{totalImoveis}</div>
              <p className="text-xs text-muted-foreground">
                {imoveisAtivos} ativos
              </p>
            </CardContent>
          </Card>

          <Card className="min-h-[124px] rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-6 pt-5 pb-2">
              <CardTitle className="text-sm font-medium">Leads</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight">{totalLeads}</div>
              <p className="text-xs text-muted-foreground">
                {leadsFechados} fechados
              </p>
            </CardContent>
          </Card>

          <Card className="min-h-[124px] rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-6 pt-5 pb-2">
              <CardTitle className="text-sm font-medium">Contratos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight">{totalContratos}</div>
              <p className="text-xs text-muted-foreground">
                {contratosAtivos} ativos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Gestão */}
        <Tabs defaultValue="imoveis" className="space-y-6">
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

          {/* Gestão de Imóveis */}
          <TabsContent value="imoveis">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Imóveis</CardTitle>
                <CardDescription>
                  Visualize todos os imóveis cadastrados no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingProperties ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : properties && properties.length > 0 ? (
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
                        {properties.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.titulo}</TableCell>
                            <TableCell className="capitalize">{p.tipo}</TableCell>
                            <TableCell>{p.cidade}/{p.estado}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  p.status === "ativo"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {p.status}
                              </span>
                            </TableCell>
                            <TableCell>ID {p.idCorretor}</TableCell>
                            <TableCell>{formatDate(p.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum imóvel cadastrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gestão de Leads */}
          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Leads</CardTitle>
                <CardDescription>
                  Visualize todos os leads do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLeads ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : leads && leads.length > 0 ? (
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
                        {leads.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium">{l.nome}</TableCell>
                            <TableCell>{l.email || "—"}</TableCell>
                            <TableCell>{l.telefone || "—"}</TableCell>
                            <TableCell>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                                {l.status}
                              </span>
                            </TableCell>
                            <TableCell className="capitalize">{l.origem || "—"}</TableCell>
                            <TableCell>
                              <Select
                                value={l.idResponsavel ? String(l.idResponsavel) : "unassigned"}
                                onValueChange={(value) =>
                                  assignLead.mutate({
                                    leadId: l.id,
                                    userId: value === "unassigned" ? null : Number(value),
                                  })
                                }
                              >
                                <SelectTrigger className="w-44">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                                  {corretoresAtivos.map((corretor) => (
                                    <SelectItem key={corretor.id} value={String(corretor.id)}>
                                      {corretor.name || corretor.email || `Corretor #${corretor.id}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{formatDate(l.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum lead encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gestão de Contratos */}
          <TabsContent value="contratos">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Contratos</CardTitle>
                <CardDescription>
                  Visualize todos os contratos do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingContracts ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : contracts && contracts.length > 0 ? (
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
                        {contracts.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">#{c.id}</TableCell>
                            <TableCell>ID {c.idCliente}</TableCell>
                            <TableCell>ID {c.idImovel}</TableCell>
                            <TableCell className="capitalize">{c.tipo}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  c.status === "ativo"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {c.status}
                              </span>
                            </TableCell>
                            <TableCell>{formatDate(c.dataInicio)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum contrato encontrado</p>
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
