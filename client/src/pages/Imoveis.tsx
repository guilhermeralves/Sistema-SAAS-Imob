import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Layout from "@/components/Layout";
import MoneyInput from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCep } from "@/lib/cep";
import { formatMoneyFromCentsValue, parseMoneyCentsInput } from "@/lib/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Building2, MapPin, Bed, Bath, Car, Search, SlidersHorizontal, Plus } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

/**
 * Pagina de listagem de imoveis.
 *
 * Lista todos os imoveis disponiveis com sistema de filtros.
 */

// ========== AREA DE EDICAO - OPCOES DE FILTRO ==========
const TIPOS = [
  { value: "todos", label: "Todos os Tipos" },
  { value: "casa", label: "Casa" },
  { value: "apartamento", label: "Apartamento" },
  { value: "terreno", label: "Terreno" },
  { value: "comercial", label: "Comercial" },
];

const FINALIDADES = [
  { value: "todos", label: "Todas" },
  { value: "venda", label: "Venda" },
  { value: "locacao", label: "Locação" },
];

const NUMBER_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];
// ========== FIM DA AREA DE EDICAO ==========

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildPropertySearchText(property: Record<string, unknown>) {
  const rawValues = Object.entries(property)
    .filter(([key]) => key !== "fotos")
    .flatMap(([_, value]) => {
      if (value === null || value === undefined) return [];
      if (typeof value === "string" || typeof value === "number") {
        return [String(value)];
      }
      return [];
    });

  if (typeof property.valor === "number") {
    rawValues.push(formatMoneyFromCentsValue(property.valor));
  }

  if (typeof property.valorLocacao === "number") {
    rawValues.push(formatMoneyFromCentsValue(property.valorLocacao));
  }

  if (property.finalidade === "locacao") {
    rawValues.push("locacao", "locação");
  } else if (property.finalidade === "venda") {
    rawValues.push("venda");
  }

  return normalizeSearchValue(rawValues.join(" "));
}

export default function Imoveis() {
  const { user, isAuthenticated } = useAuth();
  const { data: imoveis, isLoading, refetch} = trpc.properties.list.useQuery();
  const canManageProperties =
    isAuthenticated && (user?.role === "corretor" || user?.role === "administrativo");
  // Estado para controlar o dialog (Aberto ou fechado)
  const [newPropertyOpen, setNewPropertyOpen] = useState(false);
  // Estado para armazenar os dados do formulario
  const [newPropertyData, setNewPropertyData] = useState({
    titulo: "",
    descricao: "",
    tipo: "apartamento",
    finalidade: "venda",
    valor: "",
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
  });

  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const cepTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cepTimeoutRef.current !== null) {
        window.clearTimeout(cepTimeoutRef.current);
      }
    };
  }, []);

  // Mutation para criar imovel
  const createProperty = trpc.properties.create.useMutation({
    onSuccess: () => {
      toast.success("Imóvel cadastrado com sucesso!");
      refetch();  // Atualiza a lista
      setNewPropertyOpen(false);  // Fecha o dialog
      // Limpa o formulÃ¡rio
      setNewPropertyData({
        titulo: "",
        descricao: "",
        tipo: "apartamento",
        finalidade: "venda",
        valor: "",
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
      });
    },
    onError: () => {
      toast.error("Erro ao cadastrar imóvel");
    },
  });

  // Funcao para validar e criar o imovel
  const handleCreateProperty = () => {
    // Valida campos obrigatorios
    if (!newPropertyData.titulo || !newPropertyData.valor || !newPropertyData.endereco) {
      toast.error("Preencha título, valor e endereço");
      return;
    }

    // Envia para o backend
    createProperty.mutate({
      ...newPropertyData,
      valor: parseMoneyCentsInput(newPropertyData.valor) ?? 0,
      area: parseFloat(newPropertyData.area),
      quartos: parseInt(newPropertyData.quartos),
      banheiros: parseInt(newPropertyData.banheiros),
      vagas: parseInt(newPropertyData.vagas),
    });
  };

  // ========== FUNCAO PARA LIDAR COM CEP ==========
  const handleCepChange = async (value: string) => {
    const formattedValue = formatZipCode(value);
    setNewPropertyData(current => ({ ...current, cep: formattedValue }));
    setCepError("");

    if (cepTimeoutRef.current !== null) {
      window.clearTimeout(cepTimeoutRef.current);
    }

    // Se o CEP tiver menos de 8 digitos, nao busca
    if (formattedValue.replace(/\D/g, "").length < 8) {
      setCepLoading(false);
      return;
    }

    // Inicia o carregamento
    setCepLoading(true);

    // Aguarda 500ms para o usuario terminar de digitar
    cepTimeoutRef.current = window.setTimeout(async () => {
      const result = await lookupCep(formattedValue);

      if (result.status === "success") {
        const dados = result.data;
        // Preenche os campos automaticamente
        setNewPropertyData((prev) => ({
          ...prev,
          cep: formattedValue,
          endereco: dados.endereco,
          bairro: dados.bairro,
          cidade: dados.cidade,
          estado: dados.estado,
        }));
        setCepError("");
      } else {
        setCepError(
          result.status === "not_found"
            ? "CEP não encontrado"
            : "Serviço de CEP indisponível no momento"
        );
      }

      setCepLoading(false);
    }, 500);
  };
  // ========== FIM DA FUNCAO ==========

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    tipo: "todos",
    finalidade: "todos",
    cidade: "",
    bairro: "",
    quartos: "todos",
    banheiros: "todos",
    vagas: "todos",
    valorMin: "",
    valorMax: "",
    search: "",
  });

  // Aplicar filtros
  const imoveisFiltrados = imoveis?.filter((imovel) => {
    const normalizedCidade = normalizeSearchValue(filters.cidade);
    const normalizedBairro = normalizeSearchValue(filters.bairro);
    const searchTerms = normalizeSearchValue(filters.search)
      .split(/\s+/)
      .filter(Boolean);

    if (filters.tipo !== "todos" && imovel.tipo !== filters.tipo) return false;
    if (filters.finalidade !== "todos" && imovel.finalidade !== filters.finalidade) return false;
    if (filters.cidade && !normalizeSearchValue(imovel.cidade).includes(normalizedCidade)) return false;
    if (filters.bairro && !normalizeSearchValue(imovel.bairro || "").includes(normalizedBairro)) return false;
    if (filters.quartos !== "todos" && (imovel.quartos ?? 0) !== Number(filters.quartos)) return false;
    if (filters.banheiros !== "todos" && (imovel.banheiros ?? 0) !== Number(filters.banheiros)) return false;
    if (filters.vagas !== "todos" && (imovel.vagas ?? 0) !== Number(filters.vagas)) return false;
    if (filters.valorMin && imovel.valor < (parseMoneyCentsInput(filters.valorMin) ?? 0)) return false;
    if (filters.valorMax && imovel.valor > (parseMoneyCentsInput(filters.valorMax) ?? 0)) return false;

    if (searchTerms.length > 0) {
      const searchableText = buildPropertySearchText(imovel as Record<string, unknown>);
      if (!searchTerms.every(term => searchableText.includes(term))) return false;
    }

    return true;
  });

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Imóveis Disponíveis</h1>
            <p className="text-muted-foreground mt-2">
              Encontre o imóvel perfeito para você
            </p>
          </div>

          {/* Botao que abre o dialog */}
          {canManageProperties ? (
          <Dialog open={newPropertyOpen} onOpenChange={setNewPropertyOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Imóvel
              </Button>
            </DialogTrigger>

            {/* Conteudo do dialog */}
            <DialogContent
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
              onOpenAutoFocus={event => event.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Imóvel</DialogTitle>
                <DialogDescription>
                  Preencha as informações do imóvel
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Campo Titulo */}
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="titulo" className="text-sm sm:text-base">Título *</Label>
                  <Input
                    id="titulo"
                    value={newPropertyData.titulo}
                    onChange={(e) =>
                      setNewPropertyData({ ...newPropertyData, titulo: e.target.value })
                    }
                    placeholder="Ex: Apartamento 3 Quartos no Centro"
                    className="text-sm sm:text-base"
                  />
                </div>

                {/* Campo Descricao */}
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="descricao" className="text-sm sm:text-base">Descrição</Label>
                  <textarea
                    id="descricao"
                    value={newPropertyData.descricao}
                    onChange={(e) =>
                      setNewPropertyData({ ...newPropertyData, descricao: e.target.value })
                    }
                    placeholder="Descrição sobre o imóvel"
                    className="w-full p-2 border rounded text-sm sm:text-base resize-none"
                    rows={3}
                  />
                </div>

                {/* Campo Tipo e Finalidade (Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="tipo" className="text-sm sm:text-base">Tipo *</Label>
                    <select
                      id="tipo"
                      value={newPropertyData.tipo}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, tipo: e.target.value })
                      }
                      className="w-full p-2 border rounded text-sm sm:text-base"
                    >
                      <option value="apartamento">Apartamento</option>
                      <option value="casa">Casa</option>
                      <option value="terreno">Terreno</option>
                      <option value="comercial">Comercial</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="finalidade" className="text-sm sm:text-base">Finalidade *</Label>
                    <select
                      id="finalidade"
                      value={newPropertyData.finalidade}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, finalidade: e.target.value })
                      }
                      className="w-full p-2 border rounded text-sm sm:text-base"
                    >
                      <option value="venda">Venda</option>
                      <option value="locacao">Locação</option>
                    </select>
                  </div>
                </div>

                {/* Campo Valor */}
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="valor" className="text-sm sm:text-base">Valor (R$) *</Label>
                  <MoneyInput
                    id="valor"
                    value={newPropertyData.valor}
                    onValueChange={(value) =>
                      setNewPropertyData({ ...newPropertyData, valor: value })
                    }
                    placeholder="R$ 0,00"
                    className="text-sm sm:text-base"
                  />
                </div>

                {/* Campos de Caracteristicas (Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="area" className="text-sm sm:text-base">Área (m²)</Label>
                    <Input
                      id="area"
                      type="number"
                      value={newPropertyData.area}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, area: e.target.value })
                      }
                      className="text-sm sm:text-base"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="quartos" className="text-sm sm:text-base">Quartos</Label>
                    <Input
                      id="quartos"
                      type="number"
                      value={newPropertyData.quartos}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, quartos: e.target.value })
                      }
                      className="text-sm sm:text-base"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="banheiros" className="text-sm sm:text-base">Banheiros</Label>
                    <Input
                      id="banheiros"
                      type="number"
                      value={newPropertyData.banheiros}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, banheiros: e.target.value })
                      }
                      className="text-sm sm:text-base"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="vagas" className="text-sm sm:text-base">Vagas</Label>
                    <Input
                      id="vagas"
                      type="number"
                      value={newPropertyData.vagas}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, vagas: e.target.value })
                      }
                      className="text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Campos de Localizacao */}
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="endereco" className="text-sm sm:text-base">Endereço *</Label>
                  <Input
                    id="endereco"
                    value={newPropertyData.endereco}
                    onChange={(e) =>
                      setNewPropertyData({ ...newPropertyData, endereco: e.target.value })
                    }
                    placeholder="Ex: Rua Principal, 123"
                    className="text-sm sm:text-base"
                    disabled={cepLoading}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="numero" className="text-sm sm:text-base">Número</Label>
                    <Input
                      id="numero"
                      value={newPropertyData.numero}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, numero: e.target.value })
                      }
                      placeholder="Ex: 123"
                      className="text-sm sm:text-base"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="bairro" className="text-sm sm:text-base">Bairro</Label>
                    <Input
                      id="bairro"
                      value={newPropertyData.bairro}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, bairro: e.target.value })
                      }
                      placeholder="Ex: Centro"
                      className="text-sm sm:text-base"
                      disabled={cepLoading}
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="cidade" className="text-sm sm:text-base">Cidade</Label>
                    <Input
                      id="cidade"
                      value={newPropertyData.cidade}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, cidade: e.target.value })
                      }
                      placeholder="Ex: São Paulo"
                      className="text-sm sm:text-base"
                      disabled={cepLoading}
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="estado" className="text-sm sm:text-base">Estado</Label>
                    <Input
                      id="estado"
                      value={newPropertyData.estado}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, estado: e.target.value })
                      }
                      placeholder="SP"
                      maxLength={2}
                      className="text-sm sm:text-base"
                      disabled={cepLoading}
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="cep" className="text-sm sm:text-base">CEP</Label>
                    <div className="relative">
                      <Input
                        id="cep"
                        value={newPropertyData.cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="01310-100"
                        className="text-sm sm:text-base"
                        maxLength={9}
                      />
                      {cepLoading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>
                    {cepError && (
                      <p className="text-red-500 text-xs sm:text-sm mt-1">{cepError}</p>
                    )}
                  </div>
                </div>

                {/* Botao de Criar */}
                <Button
                  onClick={handleCreateProperty}
                  className="w-full mt-2 sm:mt-4 text-sm sm:text-base py-2 sm:py-3"
                  disabled={createProperty.isPending}
                >
                  {createProperty.isPending ? "Criando..." : "Criar Imóvel"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          ) : null}
        </div>

        {/* Filtros */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <SlidersHorizontal className="h-5 w-5" />
                Filtros
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden"
              >
                {showFilters ? "Ocultar" : "Mostrar"}
              </Button>
            </div>

            <div className={`grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-12 ${showFilters ? "" : "hidden md:grid"}`}>
              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={filters.tipo} onValueChange={value => setFilters({ ...filters, tipo: value })}>
                  <SelectTrigger id="tipo" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="finalidade">Finalidade</Label>
                <Select value={filters.finalidade} onValueChange={value => setFilters({ ...filters, finalidade: value })}>
                  <SelectTrigger id="finalidade" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINALIDADES.map(finalidade => (
                      <SelectItem key={finalidade.value} value={finalidade.value}>
                        {finalidade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 xl:col-span-4">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  className="h-11"
                  id="cidade"
                  placeholder="Ex: São Paulo"
                  value={filters.cidade}
                  onChange={(e) => setFilters({ ...filters, cidade: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 xl:col-span-4">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  className="h-11"
                  id="bairro"
                  placeholder="Ex: Centro"
                  value={filters.bairro}
                  onChange={(e) => setFilters({ ...filters, bairro: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 xl:col-span-3">
                <Label htmlFor="valorMin">Valor Mínimo</Label>
                <MoneyInput
                  className="h-11"
                  id="valorMin"
                  value={filters.valorMin}
                  onValueChange={(value) => setFilters({ ...filters, valorMin: value })}
                />
              </div>

              <div className="space-y-1.5 xl:col-span-3">
                <Label htmlFor="valorMax">Valor Máximo</Label>
                <MoneyInput
                  className="h-11"
                  id="valorMax"
                  value={filters.valorMax}
                  onValueChange={(value) => setFilters({ ...filters, valorMax: value })}
                />
              </div>

              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="quartos-filtro">Quartos</Label>
                <Select value={filters.quartos} onValueChange={value => setFilters({ ...filters, quartos: value })}>
                  <SelectTrigger id="quartos-filtro" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NUMBER_FILTER_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="banheiros-filtro">Banheiros</Label>
                <Select value={filters.banheiros} onValueChange={value => setFilters({ ...filters, banheiros: value })}>
                  <SelectTrigger id="banheiros-filtro" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NUMBER_FILTER_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="vagas-filtro">Vagas</Label>
                <Select value={filters.vagas} onValueChange={value => setFilters({ ...filters, vagas: value })}>
                  <SelectTrigger id="vagas-filtro" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NUMBER_FILTER_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={`relative mt-4 ${showFilters ? "" : "hidden md:block"}`}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={event => setFilters({ ...filters, search: event.target.value })}
                placeholder="Pesquisa de Imóveis"
                className="h-11 pl-9"
              />
            </div>

            {(filters.tipo !== "todos" ||
              filters.finalidade !== "todos" ||
              filters.cidade ||
              filters.bairro ||
              filters.quartos !== "todos" ||
              filters.banheiros !== "todos" ||
              filters.vagas !== "todos" ||
              filters.valorMin ||
              filters.valorMax ||
              filters.search) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({
                  tipo: "todos",
                  finalidade: "todos",
                  cidade: "",
                  bairro: "",
                  quartos: "todos",
                  banheiros: "todos",
                  vagas: "todos",
                  valorMin: "",
                  valorMax: "",
                  search: "",
                })}
                className="mt-4"
              >
                Limpar Filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="mb-4 text-sm text-muted-foreground">
          {imoveisFiltrados?.length || 0} {imoveisFiltrados?.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="h-48 bg-muted animate-pulse" />
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : imoveisFiltrados && imoveisFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {imoveisFiltrados.map((imovel) => {
              const fotos = imovel.fotos ? JSON.parse(imovel.fotos) : [];
              const primeiraFoto = fotos[0] || "/placeholder-property.jpg";

              return (
                <Link key={imovel.id} href={`/imoveis/${imovel.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={primeiraFoto}
                        alt={imovel.titulo}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                        {imovel.finalidade === "venda" ? "Venda" : imovel.finalidade === "locacao" ? "Locação" : "Venda/Locação"}
                      </div>
                      {imovel.destaque === 1 && (
                        <div className="absolute top-3 left-3 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          Destaque
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-lg mb-2 line-clamp-1">{imovel.titulo}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {imovel.bairro ? `${imovel.bairro}, ` : ""}{imovel.cidade}, {imovel.estado}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
                        {imovel.quartos && (
                          <div className="flex items-center gap-1">
                            <Bed className="h-4 w-4" />
                            {imovel.quartos}
                          </div>
                        )}
                        {imovel.banheiros && (
                          <div className="flex items-center gap-1">
                            <Bath className="h-4 w-4" />
                            {imovel.banheiros}
                          </div>
                        )}
                        {imovel.vagas && (
                          <div className="flex items-center gap-1">
                            <Car className="h-4 w-4" />
                            {imovel.vagas}
                          </div>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {formatMoneyFromCentsValue(imovel.valor)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum imóvel encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Tente ajustar os filtros para encontrar mais resultados
            </p>
            <Button
              variant="outline"
              onClick={() => setFilters({
                tipo: "todos",
                finalidade: "todos",
                cidade: "",
                bairro: "",
                quartos: "todos",
                banheiros: "todos",
                vagas: "todos",
                valorMin: "",
                valorMax: "",
                search: "",
              })}
            >
              Limpar Filtros
            </Button>
          </Card>
        )}
      </div>
    </Layout>
  );
}

