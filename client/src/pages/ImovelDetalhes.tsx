import { useMemo, useState, type ChangeEvent } from "react";
import { Link, useLocation, useRoute } from "wouter";
import Layout from "@/components/Layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatStoredDate, formatStoredDateTime } from "@/lib/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const WHATSAPP_NUMBER = "5511999999999";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function getPropertyStatusPresentation(status: string | null | undefined) {
  switch (status) {
    case "ativo":
      return {
        label: "Disponivel",
        className: "bg-emerald-100 text-emerald-700",
      };
    case "negociacao":
    case "em_negociacao":
    case "em negociacao":
    case "em negociação":
      return {
        label: "Em Negociacao",
        className: "bg-orange-100 text-orange-700",
      };
    case "inativo":
    case "vendido":
    case "alugado":
      return {
        label: "Indisponivel",
        className: "bg-red-100 text-red-700",
      };
    default:
      return {
        label: "Status",
        className: "bg-slate-100 text-slate-700",
      };
  }
}

export default function ImovelDetalhes() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/imoveis/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentPendingDelete, setDocumentPendingDelete] = useState<number | null>(null);

  const { data: imovel, isLoading } = trpc.properties.getById.useQuery({ id });

  const canManageProperty =
    isAuthenticated &&
    user &&
    imovel &&
    (user.role === "administrativo" || (user.role === "corretor" && user.id === imovel.idCorretor));
  const isAdminViewer = user?.role === "administrativo";

  const propertyDocuments = trpc.properties.documents.useQuery(
    { idImovel: id },
    {
      enabled: Boolean(documentsOpen && canManageProperty && id),
      refetchOnWindowFocus: false,
    }
  );

  const addPropertyDocument = trpc.properties.addDocument.useMutation({
    onSuccess: async () => {
      toast.success("Documento anexado com sucesso!");
      setUploadingDocument(false);
      await propertyDocuments.refetch();
    },
    onError: error => {
      toast.error(error.message || "Erro ao anexar documento");
      setUploadingDocument(false);
    },
  });

  const deletePropertyDocument = trpc.properties.deleteDocument.useMutation({
    onSuccess: async () => {
      toast.success("Documento removido com sucesso!");
      setDocumentPendingDelete(null);
      await propertyDocuments.refetch();
    },
    onError: error => {
      toast.error(error.message || "Erro ao remover documento");
    },
  });

  const propertyStatus = useMemo(
    () => getPropertyStatusPresentation(imovel?.status),
    [imovel?.status]
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-96 rounded-lg bg-muted" />
            <div className="h-8 w-2/3 rounded bg-muted" />
            <div className="h-4 w-1/3 rounded bg-muted" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!imovel) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Building2 className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Imovel nao encontrado</h1>
          <p className="mb-6 text-muted-foreground">
            O imovel que voce procura nao existe ou foi removido.
          </p>
          <Link href="/imoveis">
            <Button>Ver todos os imoveis</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const fotos = imovel.fotos ? JSON.parse(imovel.fotos) : [];
  const temFotos = fotos.length > 0;
  const whatsappMessage = `Ola! Tenho interesse no imovel: ${imovel.titulo}`;

  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % fotos.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + fotos.length) % fotos.length);
  };

  const handleDocumentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF sao permitidos.");
      return;
    }

    setUploadingDocument(true);

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      addPropertyDocument.mutate({
        idImovel: imovel.id,
        nomeArquivo: file.name,
        urlArquivo: result,
        tipoArquivo: file.type,
      });
    };
    reader.onerror = () => {
      setUploadingDocument(false);
      toast.error("Nao foi possivel ler o arquivo selecionado.");
    };

    reader.readAsDataURL(file);
  };

  const resolveDocumentUrl = async (url: string) => {
    if (!url.startsWith("data:")) {
      return { href: url, revoke: () => {} };
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    return {
      href: blobUrl,
      revoke: () => URL.revokeObjectURL(blobUrl),
    };
  };

  const handleOpenDocument = async (url: string) => {
    try {
      const resolved = await resolveDocumentUrl(url);
      const newWindow = window.open(resolved.href, "_blank");

      if (!newWindow) {
        resolved.revoke();
        toast.error("Nao foi possivel abrir o documento em uma nova aba.");
        return;
      }

      setTimeout(() => resolved.revoke(), 60_000);
    } catch (error) {
      console.error("[PropertyDocument] Erro ao abrir documento", error);
      toast.error("Nao foi possivel visualizar o documento.");
    }
  };

  const handleDownloadDocument = async (url: string, fileName: string) => {
    const resolved = await resolveDocumentUrl(url);
    const link = document.createElement("a");
    link.href = resolved.href;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => resolved.revoke(), 5_000);
  };

  const handleGoToPropertyDetails = () => {
    const targetPath =
      user?.role === "administrativo"
        ? `/admin?highlightProperty=${imovel.id}`
        : `/meus-imoveis?highlightProperty=${imovel.id}`;

    setLocation(targetPath);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  return (
    <Layout>
      <div className="container py-8 lg:pt-4">
        <div className="mb-6 lg:mb-4">
          <Link href="/imoveis">
            <Button variant="ghost" size="sm" className="mb-4 gap-2 lg:mb-3">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Imóveis
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="overflow-hidden shadow-sm">
              {temFotos ? (
                <div className="relative">
                  <div className="relative h-[420px] bg-muted lg:h-[340px] xl:h-[390px]">
                    <img
                      src={fotos[currentImageIndex]}
                      alt={`${imovel.titulo} - Foto ${currentImageIndex + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {fotos.length > 1 ? (
                      <>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute left-4 top-1/2 -translate-y-1/2"
                          onClick={prevImage}
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          onClick={nextImage}
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                          {currentImageIndex + 1} / {fotos.length}
                        </div>
                      </>
                    ) : null}
                  </div>
                  {fotos.length > 1 ? (
                    <div className="flex gap-2 overflow-x-auto p-4">
                      {fotos.map((foto: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                            index === currentImageIndex
                              ? "border-primary"
                              : "border-transparent hover:border-muted-foreground"
                          }`}
                        >
                          <img
                            src={foto}
                            alt={`Miniatura ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-[420px] items-center justify-center bg-muted lg:h-[340px] xl:h-[390px]">
                  <Building2 className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </Card>

            <Card className="shadow-sm">
              <CardContent className="space-y-4 px-4 py-3 md:px-5 md:py-3.5">
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    {imovel.finalidade === "locacao" ? "Valor da locacao" : "Valor do Imóvel"}
                  </p>
                  <p className="text-[1.85rem] font-bold leading-none text-primary xl:text-[2.05rem]">
                    {formatCurrency(imovel.valor)}
                  </p>
                  {imovel.valorLocacao && imovel.finalidade !== "venda" ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Locacao: {formatCurrency(imovel.valorLocacao)}/mes
                    </p>
                  ) : null}
                </div>

                <Button className="w-full gap-2" asChild>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Falar com Corretor
                  </a>
                </Button>

                <Link href="/contato">
                  <Button variant="outline" className="w-full">
                    Enviar Mensagem
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardContent className="space-y-6 p-6">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                        {imovel.finalidade === "venda"
                          ? "Venda"
                          : imovel.finalidade === "locacao"
                            ? "Locacao"
                            : "Venda/Locacao"}
                      </span>
                      <span className="rounded-full bg-muted px-3 py-1 font-medium capitalize">
                        {imovel.tipo}
                      </span>
                      <span className={`rounded-full px-3 py-1 font-medium ${propertyStatus.className}`}>
                        {propertyStatus.label}
                      </span>
                      {imovel.destaque === 1 ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                          Destaque
                        </span>
                      ) : null}
                    </div>

                    {canManageProperty ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Acoes do imovel" className="h-9 w-9">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleGoToPropertyDetails}>
                            Ir para Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDocumentsOpen(true)}>
                            Documentos
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>

                  <h1 className="mb-3 text-3xl font-bold leading-tight lg:text-[1.8rem] xl:text-[1.95rem]">{imovel.titulo}</h1>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      {imovel.endereco}
                      {imovel.numero ? `, ${imovel.numero}` : ""}
                      {imovel.bairro ? `, ${imovel.bairro}` : ""}, {imovel.cidade}/{imovel.estado}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 border-y py-5 sm:grid-cols-2 xl:grid-cols-4">
                  {imovel.area ? (
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-2xl font-bold">{imovel.area}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">m2</p>
                    </div>
                  ) : null}
                  {imovel.quartos ? (
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-2xl font-bold">{imovel.quartos}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Quartos</p>
                    </div>
                  ) : null}
                  {imovel.banheiros ? (
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-2xl font-bold">{imovel.banheiros}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Banheiros</p>
                    </div>
                  ) : null}
                  {imovel.vagas ? (
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-2xl font-bold">{imovel.vagas}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vagas</p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {isAdminViewer && (imovel.proprietario || imovel.cadastradoPor || imovel.corretorResponsavel) ? (
              <Card className="shadow-sm">
                <CardContent className="space-y-5 p-6">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary/80">
                      Vinculos do imovel
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proprietario</p>
                      {imovel.proprietario ? (
                        <>
                          <Link href={`/admin/proprietarios/${imovel.proprietario.id}?fromProperty=${imovel.id}`}>
                            <a className="text-base font-semibold text-primary underline">
                              {imovel.proprietario.name}
                            </a>
                          </Link>
                          <p className="text-sm text-muted-foreground">{imovel.proprietario.email}</p>
                          <p className="text-sm text-muted-foreground">{imovel.proprietario.phone}</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nao informado</p>
                      )}
                    </div>

                    <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Corretor Responsável</p>
                      {imovel.corretorResponsavel ? (
                        <Link href={`/admin/users/${imovel.corretorResponsavel.id}?fromProperty=${imovel.id}`}>
                          <a className="text-base font-semibold text-primary underline">
                            {imovel.corretorResponsavel.name || imovel.corretorResponsavel.email}
                          </a>
                        </Link>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nao informado</p>
                      )}
                    </div>

                    <div className="space-y-2 rounded-2xl bg-slate-50 p-4 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cadastrado por</p>
                      {imovel.cadastradoPor ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {imovel.cadastradoPor.registrationSource === "bootstrap" ? (
                            <span className="text-base font-semibold text-foreground">
                              {imovel.cadastradoPor.name || "Administrador"}
                            </span>
                          ) : (
                            <Link href={`/admin/users/${imovel.cadastradoPor.id}?fromProperty=${imovel.id}`}>
                              <a className="text-base font-semibold text-primary underline">
                                {imovel.cadastradoPor.name || imovel.cadastradoPor.email}
                              </a>
                            </Link>
                          )}
                          {imovel.createdAt ? (
                            <span className="text-sm text-muted-foreground">
                              {formatStoredDateTime(imovel.createdAt)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nao informado</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary/80">
                    Observacoes do imovel
                  </p>
                </div>
                <p className="whitespace-pre-line text-[15px] leading-7 text-muted-foreground">
                  {imovel.descricao?.trim() || "Nenhuma observacao cadastrada para este imovel ate o momento."}
                </p>
              </CardContent>
            </Card>

            {imovel.latitude && imovel.longitude ? (
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <MapPin className="h-5 w-5 text-primary" />
                    Localizacao
                  </h3>
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Mapa em breve</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        <Dialog open={documentsOpen} onOpenChange={setDocumentsOpen}>
          <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Documentos do imovel</DialogTitle>
              <DialogDescription>
                Visualize, baixe e anexe documentos PDF relacionados a este imovel.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Arquivos anexados</p>
                  <p className="text-sm text-muted-foreground">Somente PDF.</p>
                </div>
                <div>
                  <Input
                    id="property-document-upload"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={handleDocumentUpload}
                    disabled={uploadingDocument || addPropertyDocument.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploadingDocument || addPropertyDocument.isPending}
                    onClick={() => document.getElementById("property-document-upload")?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingDocument ? "Anexando..." : "Anexar Novo Documento"}
                  </Button>
                </div>
              </div>

              {propertyDocuments.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(item => (
                    <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : propertyDocuments.data && propertyDocuments.data.length > 0 ? (
                <div className="space-y-3">
                  {propertyDocuments.data.map(document => (
                    <div
                      key={document.id}
                      className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{document.nomeArquivo}</p>
                          <p className="text-sm text-muted-foreground">
                            Enviado em {formatStoredDate(document.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleOpenDocument(document.urlArquivo)}
                          aria-label="Visualizar documento"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleDownloadDocument(document.urlArquivo, document.nomeArquivo)}
                          aria-label="Baixar documento"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDocumentPendingDelete(document.id)}
                          aria-label="Excluir documento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                  <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Nenhum documento anexado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use o botao acima para anexar o primeiro PDF deste imovel.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={documentPendingDelete !== null} onOpenChange={open => !open && setDocumentPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusao do documento?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa acao removera permanentemente o documento anexado a este imovel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (documentPendingDelete !== null) {
                    deletePropertyDocument.mutate({ id: documentPendingDelete });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir documento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
