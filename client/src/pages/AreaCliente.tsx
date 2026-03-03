import { useState, type ChangeEvent } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { FileText, Upload, Download, CheckCircle2, Clock, XCircle, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

/**
 * Área do Cliente
 * 
 * Página exclusiva para clientes visualizarem contratos, documentos e dados pessoais.
 * 
 * EDIÇÃO:
 * - Esta página é protegida e requer autenticação
 * - Apenas usuários com role "cliente" têm acesso completo
 */

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function AreaCliente() {
  const { user, loading, isAuthenticated } = useAuth();
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const { data: contratos, isLoading: loadingContratos } = trpc.contracts.myContracts.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: documentos, isLoading: loadingDocs, refetch: refetchDocs } = trpc.documents.myDocuments.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const uploadDocument = trpc.documents.create.useMutation({
    onSuccess: () => {
      toast.success("Documento enviado com sucesso!");
      refetchDocs();
      setUploadingDoc(false);
    },
    onError: () => {
      toast.error("Erro ao enviar documento");
      setUploadingDoc(false);
    },
  });

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, tipo: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    toast.info("Funcionalidade de upload será implementada com S3");
    setUploadingDoc(false);

    // TODO: Implementar upload real com S3
    // const formData = new FormData();
    // formData.append('file', file);
    // const response = await fetch('/api/upload', { method: 'POST', body: formData });
    // const { url } = await response.json();
    // uploadDocument.mutate({ nomeArquivo: file.name, urlArquivo: url, tipo });
  };

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
            Você precisa estar autenticado para acessar a área do cliente.
          </p>
          <Button asChild>
            <a href={getLoginUrl()}>Fazer Login</a>
          </Button>
        </div>
      </Layout>
    );
  }

  if (user?.role !== "cliente") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
            Esta área é exclusiva para clientes.
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
          <h1 className="text-4xl font-bold mb-2">Área do Cliente</h1>
          <p className="text-muted-foreground">
            Bem-vindo, {user.name || user.email}
          </p>
        </div>

        <Card className="mb-6 border-dashed">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{"Ficha do Usu\u00E1rio"}</h2>
              <p className="text-sm text-muted-foreground">
                Abra sua ficha completa para revisar e editar os dados cadastrais.
              </p>
            </div>
            <Button asChild>
              <Link href="/minha-ficha?from=area-cliente">
                <a>Abrir minha ficha</a>
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="contratos" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto">
            <TabsTrigger value="contratos" className="gap-2">
              <FileText className="h-4 w-4" />
              Contratos
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2">
              <Upload className="h-4 w-4" />
              Documentos
            </TabsTrigger>
          </TabsList>

          {/* Contratos */}
          <TabsContent value="contratos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Meus Contratos</CardTitle>
                <CardDescription>
                  Visualize todos os seus contratos ativos e histórico
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingContratos ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-24 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : contratos && contratos.length > 0 ? (
                  <div className="space-y-4">
                    {contratos.map((contrato) => (
                      <Card key={contrato.id} className="border-2">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Building2 className="h-5 w-5 text-primary" />
                                <h3 className="font-bold">Contrato #{contrato.id}</h3>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    contrato.status === "ativo"
                                      ? "bg-green-100 text-green-700"
                                      : contrato.status === "encerrado"
                                      ? "bg-gray-100 text-gray-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {contrato.status}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">
                                Tipo: {contrato.tipo === "venda" ? "Compra" : "Locação"}
                              </p>
                              <p className="text-sm text-muted-foreground mb-1">
                                Valor: {formatCurrency(contrato.valor)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Período: {formatDate(contrato.dataInicio)}
                                {contrato.dataFim && ` até ${formatDate(contrato.dataFim)}`}
                              </p>
                            </div>
                            {contrato.urlContrato && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={contrato.urlContrato} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4 mr-2" />
                                  Baixar
                                </a>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Você ainda não possui contratos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documentos */}
          <TabsContent value="documentos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Meus Documentos</CardTitle>
                <CardDescription>
                  Envie e gerencie seus documentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload de Documentos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["RG", "CPF", "Comprovante de Residência"].map((tipo) => (
                    <Card key={tipo} className="border-2 border-dashed">
                      <CardContent className="p-4 text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium mb-2">{tipo}</p>
                        <Label htmlFor={`upload-${tipo}`} className="cursor-pointer">
                          <Button size="sm" variant="outline" disabled={uploadingDoc} asChild>
                            <span>Enviar</span>
                          </Button>
                          <Input
                            id={`upload-${tipo}`}
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload(e, tipo)}
                          />
                        </Label>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Lista de Documentos */}
                {loadingDocs ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : documentos && documentos.length > 0 ? (
                  <div className="space-y-3">
                    {documentos.map((doc) => (
                      <Card key={doc.id} className="border-2">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">{doc.tipo}</p>
                              <p className="text-sm text-muted-foreground">
                                Enviado em {formatDate(doc.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {doc.status === "aprovado" && (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                            {doc.status === "pendente" && (
                              <Clock className="h-5 w-5 text-yellow-500" />
                            )}
                            {doc.status === "rejeitado" && (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <Button variant="outline" size="sm" asChild>
                              <a href={doc.urlArquivo} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum documento enviado ainda</p>
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
