import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Layout from "@/components/Layout";
import MoneyInput from "@/components/MoneyInput";
import ProtectedPropertyImage from "@/components/ProtectedPropertyImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoneyFromCentsValue, parseMoneyCentsInput } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import {
  Bath,
  Bed,
  Building2,
  CalendarDays,
  Car,
  MapPin,
  Search,
  SlidersHorizontal,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

const TIPOS = [
  { value: "todos", label: "Todos os Tipos" },
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "comercial", label: "Comercial" },
];

const NUMBER_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatRange(min?: number | null, max?: number | null, suffix = "") {
  if (min && max && min !== max) return `${min} a ${max}${suffix}`;
  if (min) return `A partir de ${min}${suffix}`;
  if (max) return `Até ${max}${suffix}`;
  return "Sob consulta";
}

function formatDelivery(value?: Date | string | null) {
  if (!value) return "Entrega sob consulta";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Entrega sob consulta";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function parsePhoto(value?: string | null) {
  if (!value) return "/placeholder-property.jpg";

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && typeof parsed[0] === "string") {
      return parsed[0];
    }
  } catch {
    return "/placeholder-property.jpg";
  }

  return "/placeholder-property.jpg";
}

function createEmptyLaunchForm() {
  return {
    nome: "",
    descricao: "",
    construtora: "",
    tipo: "apartamento",
    status: "lancamento",
    entregaPrevista: "",
    valorMin: "",
    valorMax: "",
    areaMin: "",
    areaMax: "",
    quartosMin: "",
    quartosMax: "",
    vagasMin: "",
    vagasMax: "",
    unidadesDisponiveis: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    destaque: "0",
  };
}

export default function Lancamentos() {
  const { user, isAuthenticated } = useAuth();
  const canManageLaunches =
    isAuthenticated &&
    (user?.role === "corretor" || user?.role === "administrativo");
  const { data: lancamentos, isLoading } = trpc.launches.list.useQuery();
  const utils = trpc.useUtils();
  const createLaunch = trpc.launches.create.useMutation({
    onSuccess: async () => {
      toast.success("Lançamento cadastrado com sucesso.");
      setNewLaunchOpen(false);
      setNewLaunchData(createEmptyLaunchForm());
      await utils.launches.list.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel cadastrar o lançamento.");
    },
  });
  const [newLaunchOpen, setNewLaunchOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [newLaunchData, setNewLaunchData] = useState(createEmptyLaunchForm);
  const [filters, setFilters] = useState({
    tipo: "todos",
    cidade: "",
    bairro: "",
    quartos: "todos",
    vagas: "todos",
    valorMin: "",
    valorMax: "",
    search: "",
  });

  const lancamentosFiltrados = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(filters.search.trim());
    const valorMin = parseMoneyCentsInput(filters.valorMin);
    const valorMax = parseMoneyCentsInput(filters.valorMax);
    const quartosMin =
      filters.quartos === "todos" ? null : Number(filters.quartos);
    const vagasMin = filters.vagas === "todos" ? null : Number(filters.vagas);

    return (lancamentos ?? []).filter(lancamento => {
      if (filters.tipo !== "todos" && lancamento.tipo !== filters.tipo) {
        return false;
      }

      if (
        filters.cidade &&
        !normalizeSearchValue(lancamento.cidade).includes(
          normalizeSearchValue(filters.cidade)
        )
      ) {
        return false;
      }

      if (
        filters.bairro &&
        !normalizeSearchValue(lancamento.bairro ?? "").includes(
          normalizeSearchValue(filters.bairro)
        )
      ) {
        return false;
      }

      if (
        valorMin !== null &&
        (lancamento.valorMax ?? lancamento.valorMin) < valorMin
      ) {
        return false;
      }

      if (valorMax !== null && lancamento.valorMin > valorMax) {
        return false;
      }

      if (
        quartosMin !== null &&
        (lancamento.quartosMax ?? lancamento.quartosMin ?? 0) < quartosMin
      ) {
        return false;
      }

      if (
        vagasMin !== null &&
        (lancamento.vagasMax ?? lancamento.vagasMin ?? 0) < vagasMin
      ) {
        return false;
      }

      if (normalizedSearch) {
        const searchableText = normalizeSearchValue(
          [
            lancamento.nome,
            lancamento.construtora ?? "",
            lancamento.tipo,
            lancamento.status,
            lancamento.endereco,
            lancamento.bairro ?? "",
            lancamento.cidade,
            lancamento.estado,
            lancamento.cep ?? "",
          ].join(" ")
        );

        if (!searchableText.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }, [filters, lancamentos]);

  const hasFilters =
    filters.tipo !== "todos" ||
    filters.cidade ||
    filters.bairro ||
    filters.quartos !== "todos" ||
    filters.vagas !== "todos" ||
    filters.valorMin ||
    filters.valorMax ||
    filters.search;

  const handleCreateLaunch = () => {
    if (
      !newLaunchData.nome.trim() ||
      !newLaunchData.valorMin ||
      !newLaunchData.endereco.trim() ||
      !newLaunchData.cidade.trim() ||
      !newLaunchData.estado.trim()
    ) {
      toast.error("Preencha nome, valor inicial, endereço, cidade e estado.");
      return;
    }

    const parseOptionalNumber = (value: string) =>
      value.trim() ? Number(value) : null;

    createLaunch.mutate({
      nome: newLaunchData.nome,
      descricao: newLaunchData.descricao || null,
      construtora: newLaunchData.construtora || null,
      tipo: newLaunchData.tipo,
      status: newLaunchData.status,
      entregaPrevista: newLaunchData.entregaPrevista || null,
      valorMin: parseMoneyCentsInput(newLaunchData.valorMin) ?? 0,
      valorMax: parseMoneyCentsInput(newLaunchData.valorMax),
      areaMin: parseOptionalNumber(newLaunchData.areaMin),
      areaMax: parseOptionalNumber(newLaunchData.areaMax),
      quartosMin: parseOptionalNumber(newLaunchData.quartosMin),
      quartosMax: parseOptionalNumber(newLaunchData.quartosMax),
      vagasMin: parseOptionalNumber(newLaunchData.vagasMin),
      vagasMax: parseOptionalNumber(newLaunchData.vagasMax),
      unidadesDisponiveis: parseOptionalNumber(
        newLaunchData.unidadesDisponiveis
      ),
      endereco: newLaunchData.endereco,
      numero: newLaunchData.numero || null,
      bairro: newLaunchData.bairro || null,
      cidade: newLaunchData.cidade,
      estado: newLaunchData.estado.toUpperCase(),
      cep: newLaunchData.cep || null,
      fotos: null,
      destaque: Number(newLaunchData.destaque),
    });
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
        <div className="container py-8 md:py-10">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Lançamentos
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600">
                Consulte empreendimentos, unidades disponíveis, faixas de valor
                e previsão de entrega.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canManageLaunches ? (
                <Dialog open={newLaunchOpen} onOpenChange={setNewLaunchOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800">
                      <Plus className="h-4 w-4" />
                      Novo Lançamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-h-[90vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6 lg:max-w-4xl"
                    onOpenAutoFocus={event => event.preventDefault()}
                  >
                    <DialogHeader className="space-y-2 pb-2">
                      <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                        Cadastrar Novo Lançamento
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5">
                      <div className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)] sm:p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-slate-950">
                            Dados do empreendimento
                          </h3>
                          <p className="text-sm text-slate-600">
                            Identificação comercial, construtora e previsão de
                            entrega.
                          </p>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-6">
                          <div className="space-y-1.5 lg:col-span-4">
                            <Label htmlFor="launch-nome">Nome *</Label>
                            <Input
                              id="launch-nome"
                              value={newLaunchData.nome}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  nome: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                              placeholder="Ex: Residencial Jardim das Palmeiras"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="launch-construtora">
                              Construtora
                            </Label>
                            <Input
                              id="launch-construtora"
                              value={newLaunchData.construtora}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  construtora: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="launch-tipo">Tipo *</Label>
                            <Select
                              value={newLaunchData.tipo}
                              onValueChange={value =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  tipo: value,
                                })
                              }
                            >
                              <SelectTrigger
                                id="launch-tipo"
                                className="rounded-2xl"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="apartamento">
                                  Apartamento
                                </SelectItem>
                                <SelectItem value="casa">Casa</SelectItem>
                                <SelectItem value="comercial">
                                  Comercial
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="launch-status">Status</Label>
                            <Select
                              value={newLaunchData.status}
                              onValueChange={value =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  status: value,
                                })
                              }
                            >
                              <SelectTrigger
                                id="launch-status"
                                className="rounded-2xl"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lancamento">
                                  Lançamento
                                </SelectItem>
                                <SelectItem value="em_obras">
                                  Em obras
                                </SelectItem>
                                <SelectItem value="pronto_para_morar">
                                  Pronto para morar
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="launch-entrega">
                              Entrega prevista
                            </Label>
                            <Input
                              id="launch-entrega"
                              type="date"
                              value={newLaunchData.entregaPrevista}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  entregaPrevista: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-6">
                            <Label htmlFor="launch-descricao">Descrição</Label>
                            <textarea
                              id="launch-descricao"
                              value={newLaunchData.descricao}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  descricao: event.target.value,
                                })
                              }
                              className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
                              placeholder="Diferenciais, lazer, plantas e observações comerciais"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)] sm:p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-slate-950">
                            Unidades e valores
                          </h3>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="launch-valor-min">
                              Valor inicial *
                            </Label>
                            <MoneyInput
                              id="launch-valor-min"
                              value={newLaunchData.valorMin}
                              onValueChange={value =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  valorMin: value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="launch-valor-max">
                              Valor final
                            </Label>
                            <MoneyInput
                              id="launch-valor-max"
                              value={newLaunchData.valorMax}
                              onValueChange={value =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  valorMax: value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="launch-unidades">
                              Unidades disponíveis
                            </Label>
                            <Input
                              id="launch-unidades"
                              type="number"
                              value={newLaunchData.unidadesDisponiveis}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  unidadesDisponiveis: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          {[
                            ["areaMin", "Área mín."],
                            ["areaMax", "Área máx."],
                            ["quartosMin", "Quartos mín."],
                            ["quartosMax", "Quartos máx."],
                            ["vagasMin", "Vagas mín."],
                            ["vagasMax", "Vagas máx."],
                          ].map(([key, label]) => (
                            <div
                              key={key}
                              className="space-y-1.5 lg:col-span-1"
                            >
                              <Label htmlFor={`launch-${key}`}>{label}</Label>
                              <Input
                                id={`launch-${key}`}
                                type="number"
                                value={
                                  newLaunchData[
                                    key as keyof typeof newLaunchData
                                  ]
                                }
                                onChange={event =>
                                  setNewLaunchData({
                                    ...newLaunchData,
                                    [key]: event.target.value,
                                  })
                                }
                                className="rounded-2xl"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)] sm:p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-slate-950">
                            Localização
                          </h3>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-6">
                          <div className="space-y-1.5 lg:col-span-4">
                            <Label htmlFor="launch-endereco">Endereço *</Label>
                            <Input
                              id="launch-endereco"
                              value={newLaunchData.endereco}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  endereco: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-1">
                            <Label htmlFor="launch-numero">Número</Label>
                            <Input
                              id="launch-numero"
                              value={newLaunchData.numero}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  numero: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-1">
                            <Label htmlFor="launch-cep">CEP</Label>
                            <Input
                              id="launch-cep"
                              value={newLaunchData.cep}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  cep: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-2">
                            <Label htmlFor="launch-bairro">Bairro</Label>
                            <Input
                              id="launch-bairro"
                              value={newLaunchData.bairro}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  bairro: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-3">
                            <Label htmlFor="launch-cidade">Cidade *</Label>
                            <Input
                              id="launch-cidade"
                              value={newLaunchData.cidade}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  cidade: event.target.value,
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                          <div className="space-y-1.5 lg:col-span-1">
                            <Label htmlFor="launch-estado">Estado *</Label>
                            <Input
                              id="launch-estado"
                              value={newLaunchData.estado}
                              maxLength={2}
                              onChange={event =>
                                setNewLaunchData({
                                  ...newLaunchData,
                                  estado: event.target.value.toUpperCase(),
                                })
                              }
                              className="rounded-2xl"
                            />
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        className="w-full rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                        disabled={createLaunch.isPending}
                        onClick={handleCreateLaunch}
                      >
                        {createLaunch.isPending
                          ? "Salvando..."
                          : "Cadastrar Lançamento"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : null}

              <Button
                variant="outline"
                className="gap-2 rounded-full border-white/70 bg-white/85 shadow-sm md:hidden"
                onClick={() => setShowFilters(current => !current)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
              </Button>
            </div>
          </div>

          <Card className="mb-8 rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardContent className="p-6 md:p-7">
              <div
                className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 ${
                  showFilters ? "" : "hidden md:grid"
                }`}
              >
                <div className="space-y-1.5 xl:col-span-2">
                  <Label htmlFor="tipo-lancamento">Tipo</Label>
                  <Select
                    value={filters.tipo}
                    onValueChange={value =>
                      setFilters({ ...filters, tipo: value })
                    }
                  >
                    <SelectTrigger id="tipo-lancamento" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 xl:col-span-2">
                  <Label htmlFor="cidade-lancamento">Cidade</Label>
                  <Input
                    id="cidade-lancamento"
                    value={filters.cidade}
                    onChange={event =>
                      setFilters({ ...filters, cidade: event.target.value })
                    }
                    className="h-11"
                    placeholder="Cidade"
                  />
                </div>

                <div className="space-y-1.5 xl:col-span-2">
                  <Label htmlFor="bairro-lancamento">Bairro</Label>
                  <Input
                    id="bairro-lancamento"
                    value={filters.bairro}
                    onChange={event =>
                      setFilters({ ...filters, bairro: event.target.value })
                    }
                    className="h-11"
                    placeholder="Bairro"
                  />
                </div>

                <div className="space-y-1.5 xl:col-span-2">
                  <Label htmlFor="valor-min-lancamento">Valor mínimo</Label>
                  <MoneyInput
                    id="valor-min-lancamento"
                    className="h-11"
                    value={filters.valorMin}
                    onValueChange={value =>
                      setFilters({ ...filters, valorMin: value })
                    }
                  />
                </div>

                <div className="space-y-1.5 xl:col-span-2">
                  <Label htmlFor="valor-max-lancamento">Valor máximo</Label>
                  <MoneyInput
                    id="valor-max-lancamento"
                    className="h-11"
                    value={filters.valorMax}
                    onValueChange={value =>
                      setFilters({ ...filters, valorMax: value })
                    }
                  />
                </div>

                <div className="space-y-1.5 xl:col-span-1">
                  <Label htmlFor="quartos-lancamento">Quartos</Label>
                  <Select
                    value={filters.quartos}
                    onValueChange={value =>
                      setFilters({ ...filters, quartos: value })
                    }
                  >
                    <SelectTrigger id="quartos-lancamento" className="h-11">
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

                <div className="space-y-1.5 xl:col-span-1">
                  <Label htmlFor="vagas-lancamento">Vagas</Label>
                  <Select
                    value={filters.vagas}
                    onValueChange={value =>
                      setFilters({ ...filters, vagas: value })
                    }
                  >
                    <SelectTrigger id="vagas-lancamento" className="h-11">
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

              <div
                className={`relative mt-4 ${showFilters ? "" : "hidden md:block"}`}
              >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={event =>
                    setFilters({ ...filters, search: event.target.value })
                  }
                  placeholder="Pesquisar por empreendimento, construtora, bairro ou cidade"
                  className="h-11 pl-9"
                />
              </div>

              {hasFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters({
                      tipo: "todos",
                      cidade: "",
                      bairro: "",
                      quartos: "todos",
                      vagas: "todos",
                      valorMin: "",
                      valorMax: "",
                      search: "",
                    })
                  }
                  className="mt-4 rounded-full border-slate-200 bg-white"
                >
                  Limpar Filtros
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <div className="mb-5 text-sm text-slate-600">
            {lancamentosFiltrados.length}{" "}
            {lancamentosFiltrados.length === 1
              ? "lançamento encontrado"
              : "lançamentos encontrados"}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(item => (
                <Card
                  key={item}
                  className="overflow-hidden rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]"
                >
                  <div className="h-56 animate-pulse bg-muted" />
                  <CardContent className="p-5">
                    <div className="mb-3 h-4 animate-pulse rounded bg-muted" />
                    <div className="mb-5 h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-8 w-28 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : lancamentosFiltrados.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {lancamentosFiltrados.map(lancamento => (
                <Card
                  key={lancamento.id}
                  className="h-full overflow-hidden rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-42px_rgba(15,23,42,0.52)]"
                >
                  <div className="relative h-56 overflow-hidden bg-slate-100">
                    <ProtectedPropertyImage
                      src={parsePhoto(lancamento.fotos)}
                      variant="thumb"
                      alt={lancamento.nome}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                    <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-slate-950/80 px-3 py-1 text-sm font-semibold capitalize text-white backdrop-blur">
                      {lancamento.status.replace(/_/g, " ")}
                    </div>
                    {lancamento.destaque === 1 ? (
                      <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-amber-500/90 px-3 py-1 text-sm font-semibold text-white backdrop-blur">
                        Destaque
                      </div>
                    ) : null}
                  </div>

                  <CardContent className="p-5">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-800">
                      {lancamento.construtora || "Construtora sob consulta"}
                    </p>
                    <h3 className="mb-2 line-clamp-1 text-lg font-semibold text-slate-950">
                      {lancamento.nome}
                    </h3>
                    <div className="mb-4 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="line-clamp-1">
                        {lancamento.bairro ? `${lancamento.bairro}, ` : ""}
                        {lancamento.cidade}, {lancamento.estado}
                      </span>
                    </div>

                    <div className="mb-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        {formatRange(
                          lancamento.quartosMin,
                          lancamento.quartosMax
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Car className="h-4 w-4" />
                        {formatRange(lancamento.vagasMin, lancamento.vagasMax)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Bath className="h-4 w-4" />
                        {formatRange(
                          lancamento.areaMin,
                          lancamento.areaMax,
                          " m2"
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        {formatDelivery(lancamento.entregaPrevista)}
                      </div>
                    </div>

                    <div className="text-2xl font-semibold tracking-tight text-emerald-800">
                      {lancamento.valorMax &&
                      lancamento.valorMax !== lancamento.valorMin
                        ? `${formatMoneyFromCentsValue(lancamento.valorMin)} a ${formatMoneyFromCentsValue(lancamento.valorMax)}`
                        : formatMoneyFromCentsValue(lancamento.valorMin)}
                    </div>
                    {lancamento.unidadesDisponiveis ? (
                      <p className="mt-2 text-sm text-slate-500">
                        {lancamento.unidadesDisponiveis} unidades disponíveis
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-[32px] border-white/70 bg-white/90 p-12 text-center shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
              <h3 className="mb-2 text-lg font-semibold text-slate-950">
                Nenhum lançamento encontrado
              </h3>
              <p className="text-slate-500">
                Tente ajustar os filtros ou cadastre novos empreendimentos.
              </p>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
