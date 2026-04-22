import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { formatStoredDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  Building2,
  FileText,
  KeyRound,
  MoreHorizontal,
  Search,
  Settings2,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";
const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

type PropertyKeyStatus = "disponivel" | "retirada" | "indisponivel";

const KEY_STATUS_META: Record<
  PropertyKeyStatus,
  { label: string; iconClass: string; badgeClass: string }
> = {
  disponivel: {
    label: "Disponível",
    iconClass: "text-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  retirada: {
    label: "Retirada",
    iconClass: "text-amber-600",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  indisponivel: {
    label: "Indisponível",
    iconClass: "text-rose-600",
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

  const formatted = formatter.format(parsedDate);
  return formatted.replace(",", " às");
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
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("imoveis");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeletedProperties, setShowDeletedProperties] = useState(false);
  const [keyStatusDialogPropertyId, setKeyStatusDialogPropertyId] = useState<number | null>(null);
  const [keyStatusDraft, setKeyStatusDraft] = useState<PropertyKeyStatus>("disponivel");
  const [keyStatusObservationDraft, setKeyStatusObservationDraft] = useState("");
  const [propertyPendingDelete, setPropertyPendingDelete] = useState<{ id: number; titulo: string } | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  const highlightedPropertyId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("highlightProperty");
    return rawValue ? Number(rawValue) : null;
  }, []);

  const { data: users } = trpc.admin.users.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
  });

  const { data: properties, isLoading: loadingProperties } = trpc.properties.list.useQuery(
    { showDeletedOnly: showDeletedProperties },
    {
    enabled: isAuthenticated && user?.role === "administrativo",
    }
  );

  const { data: contracts, isLoading: loadingContracts } = trpc.contracts.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
  });
  const { data: keyStatusRequests, isLoading: loadingKeyStatusRequests } = trpc.properties.keyStatusRequests.useQuery(
    { idImovel: keyStatusDialogPropertyId ?? 0 },
    {
      enabled: isAuthenticated && user?.role === "administrativo" && keyStatusDialogPropertyId !== null,
    }
  );

  const requestKeyStatusChange = trpc.properties.requestKeyStatusChange.useMutation({
    onSuccess: async () => {
      toast.success("Status das chaves atualizado com sucesso!");
      await utils.properties.list.invalidate();
      if (keyStatusDialogPropertyId !== null) {
        await utils.properties.keyStatusRequests.invalidate({ idImovel: keyStatusDialogPropertyId });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar o status das chaves");
    },
  });
  const reviewKeyStatusRequest = trpc.properties.reviewKeyStatusRequest.useMutation({
    onSuccess: async () => {
      toast.success("Solicitacao analisada com sucesso!");
      await utils.properties.list.invalidate();
      if (keyStatusDialogPropertyId !== null) {
        await utils.properties.keyStatusRequests.invalidate({ idImovel: keyStatusDialogPropertyId });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel analisar a solicitacao");
    },
  });
  const deleteProperty = trpc.properties.delete.useMutation({
    onSuccess: async () => {
      toast.success("Imovel enviado para a lixeira com sucesso.");
      setPropertyPendingDelete(null);
      setDeleteConfirmationText("");
      setDeleteReason("");
      await utils.properties.list.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel excluir o imovel.");
    },
  });

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

  const selectedProperty = useMemo(() => {
    if (!properties || keyStatusDialogPropertyId === null) return null;
    return properties.find(property => property.id === keyStatusDialogPropertyId) ?? null;
  }, [keyStatusDialogPropertyId, properties]);

  const usersById = useMemo(
    () => new Map((users ?? []).map(current => [current.id, current])),
    [users]
  );

  const pendingKeyStatusRequests = useMemo(
    () => (keyStatusRequests ?? []).filter(request => request.status === "pending"),
    [keyStatusRequests]
  );

  const totalImoveis = properties?.length || 0;
  const imoveisAtivos = properties?.filter(property => property.status === "ativo").length || 0;
  const totalContratos = contracts?.length || 0;
  const contratosAtivos = contracts?.filter(contract => contract.status === "ativo").length || 0;

  useEffect(() => {
    if (!highlightedPropertyId || !properties?.length || activeTab !== "imoveis") return;

    const row = document.querySelector(`[data-property-row="${highlightedPropertyId}"]`);
    if (row instanceof HTMLElement) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeTab, highlightedPropertyId, properties]);

  useEffect(() => {
    if (!selectedProperty) return;
    setKeyStatusDraft((selectedProperty.keyStatus as PropertyKeyStatus) ?? "disponivel");
    setKeyStatusObservationDraft(selectedProperty.keyStatusObservation ?? "");
  }, [selectedProperty]);

  const openKeyStatusDialog = (property: {
    id: number;
    keyStatus: string;
    keyStatusObservation: string | null;
  }) => {
    setKeyStatusDialogPropertyId(property.id);
    setKeyStatusDraft((property.keyStatus as PropertyKeyStatus) ?? "disponivel");
    setKeyStatusObservationDraft(property.keyStatusObservation ?? "");
  };

  const closeKeyStatusDialog = () => {
    setKeyStatusDialogPropertyId(null);
    setKeyStatusDraft("disponivel");
    setKeyStatusObservationDraft("");
  };

  const submitKeyStatusChange = () => {
    if (keyStatusDialogPropertyId === null) return;

    const requestedObservation = keyStatusObservationDraft.trim();
    if (!requestedObservation) {
      toast.error("Informe uma observacao para atualizar o status das chaves.");
      return;
    }

    requestKeyStatusChange.mutate({
      idImovel: keyStatusDialogPropertyId,
      requestedStatus: keyStatusDraft,
      requestedObservation,
    });
  };

  const openDeletePropertyDialog = (property: { id: number; titulo: string }) => {
    setPropertyPendingDelete({ id: property.id, titulo: property.titulo });
    setDeleteConfirmationText("");
    setDeleteReason("");
  };

  const submitSoftDeleteProperty = () => {
    if (!propertyPendingDelete) return;

    if (deleteConfirmationText.trim() !== "EXCLUIR IMOVEL") {
      toast.error("Digite exatamente EXCLUIR IMOVEL para confirmar.");
      return;
    }

    if (!deleteReason.trim()) {
      toast.error("Informe o motivo da exclusao.");
      return;
    }

    deleteProperty.mutate({
      id: propertyPendingDelete.id,
      confirmationText: deleteConfirmationText.trim(),
      motivoExclusao: deleteReason.trim(),
    });
  };

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

  const getUserLabelById = (userId: number | null | undefined) => {
    if (!userId) return "Usuario";
    const foundUser = usersById.get(userId);
    return foundUser?.name || foundUser?.email || `ID ${userId}`;
  };

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
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
      <div className="container py-8 md:py-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Administrativo</h1>
          <p className="text-slate-600">Gerencie imóveis e contratos do sistema</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="min-h-[124px] rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium text-slate-600">Imóveis</CardTitle>
              <Building2 className="h-6 w-6 text-slate-500" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight text-slate-950">{totalImoveis}</div>
              <p className="text-xs text-slate-500">{imoveisAtivos} ativos</p>
            </CardContent>
          </Card>

          <Card className="min-h-[124px] rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-5">
              <CardTitle className="text-sm font-medium text-slate-600">Contratos</CardTitle>
              <FileText className="h-6 w-6 text-slate-500" />
            </CardHeader>
            <CardContent className="px-6 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight text-slate-950">{totalContratos}</div>
              <p className="text-xs text-slate-500">{contratosAtivos} ativos</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="rounded-full border border-slate-200 bg-white/90">
            <TabsTrigger value="imoveis" className="gap-2">
              <Building2 className="h-4 w-4" />
              Imóveis
            </TabsTrigger>
            <TabsTrigger value="contratos" className="gap-2">
              <FileText className="h-4 w-4" />
              Contratos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="imoveis">
            <Card className={SURFACE_CARD_CLASS}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-slate-950">
                      {showDeletedProperties ? "Imóveis Apagados" : "Todos os Imóveis"}
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      {showDeletedProperties
                        ? "Visualize os imóveis que estão na lixeira"
                        : "Visualize todos os imóveis cadastrados no sistema"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Abrir ações da lista de imóveis">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuCheckboxItem
                        checked={showDeletedProperties}
                        onCheckedChange={checked => setShowDeletedProperties(checked === true)}
                      >
                        Imóveis apagados
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Corretor</TableHead>
                          <TableHead>Cadastro</TableHead>
                          <TableHead className="w-28 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProperties.map(property => (
                          <TableRow
                            key={property.id}
                            data-property-row={property.id}
                            className={property.id === highlightedPropertyId ? "bg-primary/5 ring-1 ring-primary/20" : ""}
                          >
                            <TableCell className="font-medium">
                              {(() => {
                                const currentKeyStatus =
                                  (property.keyStatus as PropertyKeyStatus) ?? "disponivel";
                                const hideKeyControl = isTerrenoType(property.tipo);
                                const canOpenDetails = property.lixeira !== 1;

                                return (
                              <div className="flex items-center gap-2">
                                {canOpenDetails ? (
                                  <Link href={`/imoveis/${property.id}`}>
                                    <a className="text-slate-900 hover:text-emerald-700 hover:underline">
                                      {property.titulo}
                                    </a>
                                  </Link>
                                ) : (
                                  <span className="text-slate-700">{property.titulo}</span>
                                )}
                                    {!hideKeyControl ? (
                                      <button
                                        type="button"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/80 hover:bg-slate-100"
                                        onClick={() => openKeyStatusDialog(property)}
                                        title={`Status da chave: ${KEY_STATUS_META[currentKeyStatus].label}`}
                                        aria-label={`Abrir status da chave do imóvel ${property.titulo}`}
                                      >
                                        <KeyRound className={`h-4 w-4 ${KEY_STATUS_META[currentKeyStatus].iconClass}`} />
                                      </button>
                                    ) : null}
                              </div>
                                );
                              })()}
                            </TableCell>
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
                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="icon" asChild className="h-8 w-8">
                                  <Link href={`/admin/imoveis/${property.id}`}>
                                    <a aria-label={`Abrir ficha do imóvel ${property.titulo}`}>
                                      <Settings2 className="h-4 w-4" />
                                    </a>
                                  </Link>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700"
                                  aria-label={`Excluir imóvel ${property.titulo}`}
                                  onClick={() => openDeletePropertyDialog(property)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                    <p className="text-slate-600">
                      {searchTerm
                        ? "Nenhum imóvel encontrado para essa pesquisa"
                        : showDeletedProperties
                          ? "Nenhum imóvel apagado"
                          : "Nenhum imóvel cadastrado"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contratos">
            <Card className={SURFACE_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-slate-950">Todos os Contratos</CardTitle>
                <CardDescription className="text-slate-600">Visualize todos os contratos do sistema</CardDescription>
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
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80">
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
                    <FileText className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                    <p className="text-slate-600">
                      {searchTerm ? "Nenhum contrato encontrado para essa pesquisa" : "Nenhum contrato encontrado"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={keyStatusDialogPropertyId !== null} onOpenChange={open => !open && closeKeyStatusDialog()}>
          <DialogContent className="max-h-[92vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-lg lg:max-w-[640px] sm:p-6">
            <DialogHeader className="space-y-3 pb-1">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                Controle de Chaves
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                {selectedProperty
                  ? `Imovel: ${selectedProperty.titulo}`
                  : "Selecione um imovel para gerenciar o status das chaves."}
              </DialogDescription>
            </DialogHeader>

            {selectedProperty ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status atual</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${KEY_STATUS_META[(selectedProperty.keyStatus as PropertyKeyStatus) ?? "disponivel"].badgeClass}`}
                    >
                      {KEY_STATUS_META[(selectedProperty.keyStatus as PropertyKeyStatus) ?? "disponivel"].label}
                    </span>
                    <span className="text-xs text-slate-500">
                      Atualizado em {formatDateTimeInSaoPaulo(selectedProperty.keyStatusUpdatedAt)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{selectedProperty.keyStatusObservation || "Sem observacao."}</p>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Atualizar status da chave</p>
                  <div className="space-y-2">
                    <Label htmlFor="key-status-select">Novo status</Label>
                    <Select value={keyStatusDraft} onValueChange={value => setKeyStatusDraft(value as PropertyKeyStatus)}>
                      <SelectTrigger id="key-status-select" className={`${FIELD_CLASS} w-full max-w-[260px]`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponivel">Disponível (verde)</SelectItem>
                        <SelectItem value="retirada">Retirada (amarelo)</SelectItem>
                        <SelectItem value="indisponivel">Indisponível (vermelho)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="key-status-observation">Observacao obrigatoria</Label>
                    <Textarea
                      id="key-status-observation"
                      value={keyStatusObservationDraft}
                      onChange={event => setKeyStatusObservationDraft(event.target.value)}
                      rows={4}
                      className="min-h-[100px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                      placeholder="Descreva o motivo da alteracao de status das chaves."
                    />
                  </div>
                  <Button
                    onClick={submitKeyStatusChange}
                    disabled={requestKeyStatusChange.isPending}
                    className="w-full rounded-full bg-emerald-700 text-white shadow-[0_18px_40px_-28px_rgba(4,120,87,0.75)] hover:bg-emerald-800"
                  >
                    {requestKeyStatusChange.isPending ? "Salvando..." : "Salvar status"}
                  </Button>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Solicitacoes pendentes</p>
                  {loadingKeyStatusRequests ? (
                    <p className="text-sm text-slate-500">Carregando solicitacoes...</p>
                  ) : pendingKeyStatusRequests.length > 0 ? (
                    <div className="space-y-3">
                      {pendingKeyStatusRequests.map(request => (
                        <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${KEY_STATUS_META[(request.requestedStatus as PropertyKeyStatus) ?? "disponivel"].badgeClass}`}
                            >
                              {KEY_STATUS_META[(request.requestedStatus as PropertyKeyStatus) ?? "disponivel"].label}
                            </span>
                            <span className="text-xs text-slate-500">{formatStoredDate(request.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Solicitado por {getUserLabelById(request.requestedByUserId)}
                          </p>
                          <p className="mt-2 text-sm text-slate-700">{request.requestedObservation}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                              disabled={reviewKeyStatusRequest.isPending}
                              onClick={() =>
                                reviewKeyStatusRequest.mutate({
                                  requestId: request.id,
                                  decision: "approved",
                                })
                              }
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full border-rose-300 text-rose-700 hover:bg-rose-50"
                              disabled={reviewKeyStatusRequest.isPending}
                              onClick={() =>
                                reviewKeyStatusRequest.mutate({
                                  requestId: request.id,
                                  decision: "rejected",
                                })
                              }
                            >
                              Reprovar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nao ha solicitacoes pendentes para este imovel.</p>
                  )}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={propertyPendingDelete !== null}
          onOpenChange={open => {
            if (!open) {
              setPropertyPendingDelete(null);
              setDeleteConfirmationText("");
              setDeleteReason("");
            }
          }}
        >
          <DialogContent className="max-h-[92vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-lg sm:p-6">
            <DialogHeader className="space-y-3 pb-1">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                Confirmar exclusão do imóvel
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                {propertyPendingDelete
                  ? `Você está enviando "${propertyPendingDelete.titulo}" para a lixeira.`
                  : "Confirme a exclusão lógica do imóvel."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-property-confirmation">
                  Digite EXCLUIR IMOVEL para confirmar
                </Label>
                <Input
                  id="delete-property-confirmation"
                  value={deleteConfirmationText}
                  onChange={event => setDeleteConfirmationText(event.target.value)}
                  className={`${FIELD_CLASS} w-full`}
                  placeholder="EXCLUIR IMOVEL"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-property-reason">Motivo da exclusão (obrigatório)</Label>
                <Textarea
                  id="delete-property-reason"
                  value={deleteReason}
                  onChange={event => setDeleteReason(event.target.value)}
                  rows={4}
                  className="min-h-[100px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                  placeholder="Descreva o motivo da exclusão do imóvel."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPropertyPendingDelete(null);
                    setDeleteConfirmationText("");
                    setDeleteReason("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteProperty.isPending}
                  onClick={submitSoftDeleteProperty}
                >
                  {deleteProperty.isPending ? "Excluindo..." : "Excluir imóvel"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </Layout>
  );
}
