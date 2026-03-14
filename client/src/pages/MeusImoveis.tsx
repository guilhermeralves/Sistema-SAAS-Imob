import { useAuth } from "@/_core/hooks/useAuth";
import MoneyInput from "@/components/MoneyInput";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { lookupCep } from "@/lib/cep";
import { formatMoneyFromCentsValue, parseMoneyCentsInput } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { Building2, Edit, MapPin, Search, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type PropertyFilter = "all" | "active";

type PropertyFormState = {
  titulo: string;
  descricao: string;
  tipo: string;
  finalidade: string;
  valor: string;
  valorLocacao: string;
  area: string;
  quartos: string;
  banheiros: string;
  vagas: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  destaque: string;
};

function createEmptyForm(): PropertyFormState {
  return {
    titulo: "",
    descricao: "",
    tipo: "apartamento",
    finalidade: "venda",
    valor: "",
    valorLocacao: "",
    area: "",
    quartos: "",
    banheiros: "",
    vagas: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    destaque: "0",
  };
}

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function MeusImoveis() {
  const { user, loading, isAuthenticated } = useAuth();
  const canDeleteProperties = user?.role === "administrativo";
  const utils = trpc.useUtils();
  const [editingImovel, setEditingImovel] = useState<any>(null);
  const [formData, setFormData] = useState<PropertyFormState>(createEmptyForm);
  const [selectedFilter, setSelectedFilter] = useState<PropertyFilter | null>(null);
  const [search, setSearch] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const cepTimeoutRef = useRef<number | null>(null);
  const highlightedPropertyId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("highlightProperty");
    return rawValue ? Number(rawValue) : null;
  }, []);

  const { data: imoveis, isLoading, refetch } = trpc.properties.myProperties.useQuery(undefined, {
    enabled: isAuthenticated && (user?.role === "corretor" || user?.role === "administrativo"),
  });

  const updateProperty = trpc.properties.update.useMutation({
    onSuccess: async () => {
      toast.success("Imóvel atualizado com sucesso!");
      closeEditDialog();
      await refetch();
      await utils.properties.myProperties.invalidate();
    },
    onError: () => {
      toast.error("Erro ao atualizar imóvel");
    },
  });

  const deleteProperty = trpc.properties.delete.useMutation({
    onSuccess: async () => {
      toast.success("Imóvel removido com sucesso!");
      await refetch();
      await utils.properties.myProperties.invalidate();
    },
    onError: error => {
      if (error instanceof TRPCClientError && error.data?.code === "FORBIDDEN") {
        toast.error("Corretores não podem excluir imóveis.");
        return;
      }

      toast.error("Erro ao remover imóvel");
    },
  });

  useEffect(() => {
    return () => {
      if (cepTimeoutRef.current !== null) {
        window.clearTimeout(cepTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!highlightedPropertyId || !imoveis?.length) return;

    const row = document.querySelector(`[data-my-property-row="${highlightedPropertyId}"]`);
    if (row instanceof HTMLElement) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlightedPropertyId, imoveis]);

  const closeEditDialog = () => {
    setEditingImovel(null);
    setFormData(createEmptyForm());
    setCepLoading(false);
    setCepError("");
  };

  const handleEdit = (imovel: any) => {
    setEditingImovel(imovel);
    setFormData({
      titulo: imovel.titulo || "",
      descricao: imovel.descricao || "",
      tipo: imovel.tipo || "apartamento",
      finalidade: imovel.finalidade || "venda",
      valor: imovel.valor ? String(imovel.valor) : "",
      valorLocacao: imovel.valorLocacao ? String(imovel.valorLocacao) : "",
      area: imovel.area?.toString() || "",
      quartos: imovel.quartos?.toString() || "",
      banheiros: imovel.banheiros?.toString() || "",
      vagas: imovel.vagas?.toString() || "",
      endereco: imovel.endereco || "",
      numero: imovel.numero || "",
      bairro: imovel.bairro || "",
      cidade: imovel.cidade || "",
      estado: imovel.estado || "",
      cep: imovel.cep || "",
      destaque: String(imovel.destaque ?? 0),
    });
  };

  const handleZipCodeChange = (value: string) => {
    const formattedValue = formatZipCode(value);
    setFormData(current => ({ ...current, cep: formattedValue }));
    setCepError("");

    if (cepTimeoutRef.current !== null) {
      window.clearTimeout(cepTimeoutRef.current);
    }

    if (formattedValue.replace(/\D/g, "").length < 8) {
      setCepLoading(false);
      return;
    }

    setCepLoading(true);
    cepTimeoutRef.current = window.setTimeout(async () => {
      const result = await lookupCep(formattedValue);

      if (result.status !== "success") {
        setCepError(
          result.status === "not_found"
            ? "CEP não encontrado"
            : "Serviço de CEP indisponível no momento"
        );
        setCepLoading(false);
        return;
      }

      const dados = result.data;
      setFormData(current => ({
        ...current,
        cep: formattedValue,
        endereco: dados.endereco,
        bairro: dados.bairro,
        cidade: dados.cidade,
        estado: dados.estado,
      }));
      setCepError("");
      setCepLoading(false);
    }, 500);
  };

  const handleSubmit = () => {
    if (!editingImovel) return;

    if (!formData.titulo || !formData.valor || !formData.endereco || !formData.cidade || !formData.estado) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    updateProperty.mutate({
      id: editingImovel.id,
      titulo: formData.titulo,
      descricao: formData.descricao,
      tipo: formData.tipo,
      finalidade: formData.finalidade,
      valor: parseMoneyCentsInput(formData.valor) ?? 0,
      valorLocacao: parseMoneyCentsInput(formData.valorLocacao),
      area: formData.area ? parseInt(formData.area, 10) : null,
      quartos: formData.quartos ? parseInt(formData.quartos, 10) : null,
      banheiros: formData.banheiros ? parseInt(formData.banheiros, 10) : null,
      vagas: formData.vagas ? parseInt(formData.vagas, 10) : null,
      endereco: formData.endereco,
      numero: formData.numero || null,
      bairro: formData.bairro,
      cidade: formData.cidade,
      estado: formData.estado,
      cep: formData.cep,
      destaque: parseInt(formData.destaque, 10),
      fotos: editingImovel.fotos || "[]",
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este imóvel?")) {
      deleteProperty.mutate({ id });
    }
  };

  const totalImoveis = imoveis?.length ?? 0;
  const activeCount = imoveis?.filter(imovel => imovel.status === "ativo").length ?? 0;

  const filteredImoveis = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (imoveis ?? [])
      .filter(imovel => {
        if (!selectedFilter || selectedFilter === "all") return true;
        if (selectedFilter === "active") return imovel.status === "ativo";
        return true;
      })
      .filter(imovel => {
        if (!normalizedSearch) return true;

        const values = [
          imovel.titulo,
          imovel.tipo,
          imovel.finalidade,
          imovel.status,
          imovel.endereco,
          imovel.numero || "",
          imovel.bairro || "",
          imovel.cidade,
          imovel.estado,
        ];

        return values.some(value => (value || "").toLowerCase().includes(normalizedSearch));
      });
  }, [imoveis, search, selectedFilter]);

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
            Você precisa estar autenticado para acessar esta página.
          </p>
          <Button asChild>
            <a href={getLoginUrl()}>Fazer Login</a>
          </Button>
        </div>
      </Layout>
    );
  }

  if (user?.role !== "corretor" && user?.role !== "administrativo") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Building2 className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Negado</h1>
          <p className="mb-6 text-muted-foreground">
            Esta área é exclusiva para corretores e administradores.
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
      <div className="container space-y-6 py-8">
        <div>
          <h1 className="mb-2 text-4xl font-bold">Meus Imóveis</h1>
          <p className="text-muted-foreground">
            Consulte e atualize os imóveis já cadastrados.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            { key: "all" as PropertyFilter, label: "Total de Imóveis", value: totalImoveis },
            { key: "active" as PropertyFilter, label: "Imóveis Ativos", value: activeCount },
          ].map(card => {
            const isSelected = selectedFilter === card.key;

            return (
              <Card
                key={card.key}
                className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary shadow-md" : ""}`}
                onClick={() => setSelectedFilter(current => (current === card.key ? null : card.key))}
              >
                <CardHeader className="px-6 pt-4 pb-1 md:pb-2">
                  <CardTitle className="text-sm">{card.label}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pt-0 pb-4 text-2xl font-bold md:pb-6">
                  {card.value}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Lista de imóveis
            </CardTitle>
            <CardDescription>
              Filtre pelo que estiver cadastrado em cada imóvel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4 lg:max-w-xl">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Pesquisar por título, endereço, cidade, tipo, finalidade ou status"
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(item => (
                  <div key={item} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : filteredImoveis.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imóvel</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Finalidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="w-32">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredImoveis.map(imovel => (
                      <TableRow
                        key={imovel.id}
                        data-my-property-row={imovel.id}
                        className={imovel.id === highlightedPropertyId ? "bg-primary/5 ring-1 ring-primary/20" : ""}
                      >
                        <TableCell>
                          <div className="font-medium">{imovel.titulo}</div>
                          <div className="text-xs text-muted-foreground capitalize">{imovel.tipo}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {imovel.bairro ? `${imovel.bairro}, ` : ""}
                              {imovel.cidade}/{imovel.estado}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{imovel.finalidade}</TableCell>
                        <TableCell className="capitalize">{imovel.status}</TableCell>
                        <TableCell className="font-medium">{formatMoneyFromCentsValue(imovel.valor)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(imovel)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                            {canDeleteProperties ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(imovel.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum imóvel encontrado para o filtro atual.</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(editingImovel)} onOpenChange={open => !open && closeEditDialog()}>
          <DialogContent
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            onOpenAutoFocus={event => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Editar Imóvel</DialogTitle>
              <DialogDescription>Atualize as informações do imóvel.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="titulo" className="text-sm sm:text-base">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={event => setFormData({ ...formData, titulo: event.target.value })}
                  placeholder="Ex: Apartamento 3 Quartos no Centro"
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="descricao" className="text-sm sm:text-base">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={event => setFormData({ ...formData, descricao: event.target.value })}
                  rows={3}
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="tipo" className="text-sm sm:text-base">Tipo *</Label>
                  <Select value={formData.tipo} onValueChange={value => setFormData({ ...formData, tipo: value })}>
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartamento">Apartamento</SelectItem>
                      <SelectItem value="casa">Casa</SelectItem>
                      <SelectItem value="terreno">Terreno</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="finalidade" className="text-sm sm:text-base">Finalidade *</Label>
                  <Select value={formData.finalidade} onValueChange={value => setFormData({ ...formData, finalidade: value })}>
                    <SelectTrigger id="finalidade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venda">Venda</SelectItem>
                      <SelectItem value="locacao">Locação</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="valor" className="text-sm sm:text-base">Valor (R$) *</Label>
                  <MoneyInput
                    id="valor"
                    value={formData.valor}
                    onValueChange={value => setFormData({ ...formData, valor: value })}
                    placeholder="R$ 0,00"
                    className="text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="valorLocacao" className="text-sm sm:text-base">Valor Locação (R$)</Label>
                  <MoneyInput
                    id="valorLocacao"
                    value={formData.valorLocacao}
                    onValueChange={value => setFormData({ ...formData, valorLocacao: value })}
                    placeholder="R$ 0,00"
                    className="text-sm sm:text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="area" className="text-sm sm:text-base">Área (m²)</Label>
                  <Input
                    id="area"
                    type="number"
                    value={formData.area}
                    onChange={event => setFormData({ ...formData, area: event.target.value })}
                    className="text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="quartos" className="text-sm sm:text-base">Quartos</Label>
                  <Input
                    id="quartos"
                    type="number"
                    value={formData.quartos}
                    onChange={event => setFormData({ ...formData, quartos: event.target.value })}
                    className="text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="banheiros" className="text-sm sm:text-base">Banheiros</Label>
                  <Input
                    id="banheiros"
                    type="number"
                    value={formData.banheiros}
                    onChange={event => setFormData({ ...formData, banheiros: event.target.value })}
                    className="text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="vagas" className="text-sm sm:text-base">Vagas</Label>
                  <Input
                    id="vagas"
                    type="number"
                    value={formData.vagas}
                    onChange={event => setFormData({ ...formData, vagas: event.target.value })}
                    className="text-sm sm:text-base"
                  />
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="endereco" className="text-sm sm:text-base">Endereço *</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={event => setFormData({ ...formData, endereco: event.target.value })}
                  className="text-sm sm:text-base"
                  disabled={cepLoading}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="numero" className="text-sm sm:text-base">Número</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={event => setFormData({ ...formData, numero: event.target.value })}
                    className="text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="bairro" className="text-sm sm:text-base">Bairro</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={event => setFormData({ ...formData, bairro: event.target.value })}
                    className="text-sm sm:text-base"
                    disabled={cepLoading}
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="cidade" className="text-sm sm:text-base">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={event => setFormData({ ...formData, cidade: event.target.value })}
                    className="text-sm sm:text-base"
                    disabled={cepLoading}
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="estado" className="text-sm sm:text-base">Estado *</Label>
                  <Input
                    id="estado"
                    maxLength={2}
                    value={formData.estado}
                    onChange={event => setFormData({ ...formData, estado: event.target.value.toUpperCase() })}
                    className="text-sm sm:text-base"
                    disabled={cepLoading}
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="cep" className="text-sm sm:text-base">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    inputMode="numeric"
                    maxLength={9}
                    onChange={event => handleZipCodeChange(event.target.value)}
                    className="text-sm sm:text-base"
                  />
                  {cepLoading ? <p className="text-xs text-muted-foreground">Buscando CEP...</p> : null}
                  {cepError ? <p className="text-xs text-red-500">{cepError}</p> : null}
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="destaque" className="text-sm sm:text-base">Destaque na Home?</Label>
                  <Select value={formData.destaque} onValueChange={value => setFormData({ ...formData, destaque: value })}>
                    <SelectTrigger id="destaque">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Não</SelectItem>
                      <SelectItem value="1">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                className="mt-2 w-full py-2 text-sm sm:mt-4 sm:py-3 sm:text-base"
                disabled={updateProperty.isPending}
              >
                {updateProperty.isPending ? "Salvando..." : "Atualizar Imóvel"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {!isLoading && (!imoveis || imoveis.length === 0) ? (
          <Card className="p-12 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Nenhum imóvel cadastrado</h3>
            <p className="mb-4 text-muted-foreground">
              Os novos imóveis devem ser cadastrados pela tela principal de imóveis.
            </p>
            <Button asChild>
              <Link href="/imoveis">
                <a>Ir para Imóveis</a>
              </Link>
            </Button>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
}
