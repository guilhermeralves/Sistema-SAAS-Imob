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
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-20">
          <div className="container py-10 md:py-12">
            <div className="animate-pulse space-y-5">
              <div className="h-10 w-40 rounded-full bg-white/80" />
              <div className="h-[420px] rounded-[32px] bg-white/80" />
              <div className="h-10 w-2/3 rounded bg-white/80" />
              <div className="h-5 w-1/2 rounded bg-white/70" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!imovel) {
    return (
      <Layout>
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-20">
          <div className="container py-16">
            <Card className="rounded-[32px] border-white/70 bg-white/90 p-12 text-center shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <Building2 className="mx-auto mb-4 h-16 w-16 text-slate-400" />
              <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-950">Imovel nao encontrado</h1>
              <p className="mb-6 text-slate-600">
                O imovel que voce procura nao existe ou foi removido.
              </p>
              <Link href="/imoveis">
                <Button className="rounded-full bg-slate-950 text-white hover:bg-slate-800">
                  Ver todos os imoveis
                </Button>
              </Link>
            </Card>
          </div>
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
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-20">
        <div className="container py-8 md:py-10">
          <div className="mb-6 lg:mb-4">
            <Link href="/imoveis">
              <Button
                variant="ghost"
                size="sm"
                className="mb-4 gap-2 rounded-full border border-white/70 bg-white/80 text-slate-700 shadow-sm hover:bg-white lg:mb-3"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para Imóveis
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="overflow-hidden rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              {temFotos ? (
                <div className="relative">
                  <div className="relative h-[420px] bg-slate-100 lg:h-[340px] xl:h-[390px]">
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
                          className="absolute left-4 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-white/30 bg-white/85 text-slate-800 shadow-lg hover:bg-white"
                          onClick={prevImage}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-4 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-white/30 bg-white/85 text-slate-800 shadow-lg hover:bg-white"
                          onClick={nextImage}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-slate-950/80 px-3 py-1 text-sm font-medium text-white backdrop-blur">
                          {currentImageIndex + 1} / {fotos.length}
                        </div>
                      </>
                    ) : null}
                  </div>
                  {fotos.length > 1 ? (
                    <div className="flex gap-3 overflow-x-auto p-4 md:p-5">
                      {fotos.map((foto: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition-all ${
                            index === currentImageIndex
                              ? "border-emerald-600 shadow-md"
                              : "border-transparent hover:border-slate-300"
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
                <div className="flex h-[420px] items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,243,0.88))] lg:h-[340px] xl:h-[390px]">
                  <Building2 className="h-16 w-16 text-slate-400" />
                </div>
              )}
            </Card>

            <Card className="rounded-[32px] border-transparent bg-[linear-gradient(135deg,#4e7b66,#628b78_55%,#7aa18b)] text-white shadow-[0_25px_60px_-35px_rgba(15,23,42,0.6)]">
              <CardContent className="space-y-4 p-6">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-white/70">
                    {imovel.finalidade === "locacao" ? "Valor da locacao" : "Valor do imóvel"}
                  </p>
                  <p className="text-[1.95rem] font-semibold leading-none tracking-tight xl:text-[2.15rem]">
                    {formatCurrency(imovel.valor)}
                  </p>
                  {imovel.valorLocacao && imovel.finalidade !== "venda" ? (
                    <p className="mt-2 text-sm text-white/80">
                      Locacao: {formatCurrency(imovel.valorLocacao)}/mes
                    </p>
                  ) : null}
                </div>

                <Button className="h-12 w-full rounded-full bg-white text-slate-900 shadow-sm hover:bg-slate-100" asChild>
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
                  <Button variant="outline" className="h-12 w-full rounded-full border-white/30 bg-white/10 text-white hover:bg-white/15">
                    Enviar Mensagem
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <CardContent className="space-y-6 p-6 md:p-7">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                        {imovel.finalidade === "venda"
                          ? "Venda"
                          : imovel.finalidade === "locacao"
                            ? "Locacao"
                            : "Venda/Locacao"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium capitalize text-slate-700">
                        {imovel.tipo}
                      </span>
                      <span className={`rounded-full px-3 py-1 font-medium ${propertyStatus.className}`}>
                        {propertyStatus.label}
                      </span>
                      {imovel.destaque === 1 ? (
                        <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 font-medium text-amber-700">
                          Destaque
                        </span>
                      ) : null}
                    </div>

                    {canManageProperty ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Acoes do imovel"
                            className="h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          >
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

                  <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-950 lg:text-[1.8rem] xl:text-[1.95rem]">
                    {imovel.titulo}
                  </h1>
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
                    <span>
                      {imovel.endereco}
                      {imovel.numero ? `, ${imovel.numero}` : ""}
                      {imovel.bairro ? `, ${imovel.bairro}` : ""}, {imovel.cidade}/{imovel.estado}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {imovel.area ? (
                    <div className="border-b border-slate-200/80 pb-3 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-4">
                      <p className="text-2xl font-semibold tracking-tight text-slate-950">{imovel.area}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">m2</p>
                    </div>
                  ) : null}
                  {imovel.quartos ? (
                    <div className="border-b border-slate-200/80 pb-3 sm:border-b-0 sm:pb-0 xl:border-r xl:pr-4">
                      <p className="text-2xl font-semibold tracking-tight text-slate-950">{imovel.quartos}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Quartos</p>
                    </div>
                  ) : null}
                  {imovel.banheiros ? (
                    <div className="border-b border-slate-200/80 pb-3 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-4">
                      <p className="text-2xl font-semibold tracking-tight text-slate-950">{imovel.banheiros}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Banheiros</p>
                    </div>
                  ) : null}
                  {imovel.vagas ? (
                    <div>
                      <p className="text-2xl font-semibold tracking-tight text-slate-950">{imovel.vagas}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Vagas</p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {isAdminViewer && (imovel.proprietario || imovel.cadastradoPor || imovel.corretorResponsavel) ? (
              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
                <CardContent className="space-y-5 p-6 md:p-7">
                  <div>
                    <p className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                      Vinculos do imovel
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Proprietario</p>
                      {imovel.proprietario ? (
                        <>
                          <Link href={`/admin/proprietarios/${imovel.proprietario.id}?fromProperty=${imovel.id}`}>
                            <a className="text-base font-semibold text-emerald-800 underline">
                              {imovel.proprietario.name}
                            </a>
                          </Link>
                          <p className="text-sm text-slate-600">{imovel.proprietario.email}</p>
                          <p className="text-sm text-slate-600">{imovel.proprietario.phone}</p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-600">Nao informado</p>
                      )}
                    </div>

                    <div className="space-y-2 rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Corretor Responsável</p>
                      {imovel.corretorResponsavel ? (
                        <Link href={`/admin/users/${imovel.corretorResponsavel.id}?fromProperty=${imovel.id}`}>
                          <a className="text-base font-semibold text-emerald-800 underline">
                            {imovel.corretorResponsavel.name || imovel.corretorResponsavel.email}
                          </a>
                        </Link>
                      ) : (
                        <p className="text-sm text-slate-600">Nao informado</p>
                      )}
                    </div>

                    <div className="space-y-2 rounded-[28px] border border-slate-100 bg-slate-50/70 p-5 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cadastrado por</p>
                      {imovel.cadastradoPor ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {imovel.cadastradoPor.registrationSource === "bootstrap" ? (
                            <span className="text-base font-semibold text-slate-950">
                              {imovel.cadastradoPor.name || "Administrador"}
                            </span>
                          ) : (
                            <Link href={`/admin/users/${imovel.cadastradoPor.id}?fromProperty=${imovel.id}`}>
                              <a className="text-base font-semibold text-emerald-800 underline">
                                {imovel.cadastradoPor.name || imovel.cadastradoPor.email}
                              </a>
                            </Link>
                          )}
                          {imovel.createdAt ? (
                            <span className="text-sm text-slate-500">
                              {formatStoredDateTime(imovel.createdAt)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">Nao informado</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <CardContent className="space-y-4 p-6 md:p-7">
                <div>
                  <p className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                    Observacoes do imovel
                  </p>
                </div>
                <p className="whitespace-pre-line text-[15px] leading-7 text-slate-600">
                  {imovel.descricao?.trim() || "Nenhuma observacao cadastrada para este imovel ate o momento."}
                </p>
              </CardContent>
            </Card>

            {imovel.latitude && imovel.longitude ? (
              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
                <CardContent className="p-6 md:p-7">
                  <h3 className="mb-4 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-950">
                    <MapPin className="h-5 w-5 text-emerald-700" />
                    Localizacao
                  </h3>
                  <div className="flex aspect-video items-center justify-center rounded-[28px] border border-slate-100 bg-slate-50">
                    <p className="text-sm text-slate-500">Mapa em breve</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
        </div>

        <Dialog open={documentsOpen} onOpenChange={setDocumentsOpen}>
          <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-hidden">
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
