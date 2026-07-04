import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import MoneyInput from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useAuth } from "@/_core/hooks/useAuth";
import { lookupCep } from "@/lib/cep";
import { trpc } from "@/lib/trpc";
import { formatMoneyFromCentsValue, parseMoneyCentsInput } from "@/lib/money";
import { Building2, ChevronDown, ChevronUp, PencilLine, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

type CondominiumType = "casa" | "apartamento";

type CondominiumFormState = {
  nome: string;
  tipo: CondominiumType;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  referencia: string;
  valorCondominio: string;
  valorIptu: string;
  cnpj: string;
  administradoraNome: string;
  administradoraContato: string;
  caracteristicas: string[];
  observacoes: string;
};

type CondominiumListItem = {
  id: number;
  nome: string;
  tipo: CondominiumType;
  endereco: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  cep: string | null;
  referencia: string | null;
  valorCondominio: number | null;
  valorIptu: number | null;
  cnpj: string | null;
  administradoraNome: string | null;
  administradoraContato: string | null;
  caracteristicas: string | null;
  observacoes: string | null;
  isAtivo: number;
};

const INITIAL_FORM: CondominiumFormState = {
  nome: "",
  tipo: "apartamento",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  referencia: "",
  valorCondominio: "",
  valorIptu: "",
  cnpj: "",
  administradoraNome: "",
  administradoraContato: "",
  caracteristicas: [],
  observacoes: "",
};

const CONDOMINIUM_FEATURE_OPTIONS = [
  "Portaria 24h",
  "Piscina",
  "Academia",
  "Salao de festas",
  "Espaco gourmet",
  "Churrasqueira",
  "Playground",
  "Brinquedoteca",
  "Quadra poliesportiva",
  "Quadra de tenis",
  "Pet place",
  "Coworking",
  "Mercado interno",
  "Elevador",
  "Bicicletario",
  "Vaga para visitante",
  "Sauna",
  "Area verde",
];

function toNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function parseCondominiumFeatures(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.filter(item => typeof item === "string");
    return Array.from(new Set(normalized));
  } catch {
    return [];
  }
}

function mapCondominiumToForm(condominium: CondominiumListItem): CondominiumFormState {
  return {
    nome: condominium.nome,
    tipo: condominium.tipo,
    endereco: condominium.endereco,
    numero: condominium.numero ?? "",
    complemento: condominium.complemento ?? "",
    bairro: condominium.bairro ?? "",
    cidade: condominium.cidade,
    estado: condominium.estado,
    cep: condominium.cep ?? "",
    referencia: condominium.referencia ?? "",
    valorCondominio:
      typeof condominium.valorCondominio === "number"
        ? formatMoneyFromCentsValue(condominium.valorCondominio)
        : "",
    valorIptu:
      typeof condominium.valorIptu === "number"
        ? formatMoneyFromCentsValue(condominium.valorIptu)
        : "",
    cnpj: condominium.cnpj ?? "",
    administradoraNome: condominium.administradoraNome ?? "",
    administradoraContato: condominium.administradoraContato ?? "",
    caracteristicas: parseCondominiumFeatures(condominium.caracteristicas),
    observacoes: condominium.observacoes ?? "",
  };
}

export default function Condominios() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "administrativo";

  const [form, setForm] = useState<CondominiumFormState>(INITIAL_FORM);
  const [editingCondominiumId, setEditingCondominiumId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [inactiveSearch, setInactiveSearch] = useState("");
  const [inactiveModalOpen, setInactiveModalOpen] = useState(false);
  const [tipoFilter, setTipoFilter] = useState<"todos" | CondominiumType>("todos");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [isFormCardOpen, setIsFormCardOpen] = useState(false);
  const [isLocationSectionOpen, setIsLocationSectionOpen] = useState(true);
  const [isCharacteristicsSectionOpen, setIsCharacteristicsSectionOpen] = useState(true);
  const cepTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cepTimeoutRef.current !== null) {
        window.clearTimeout(cepTimeoutRef.current);
      }
    };
  }, []);

  const condominiumsQuery = trpc.condominios.list.useQuery(
    {
      search: search.trim() || undefined,
      tipo: tipoFilter === "todos" ? undefined : tipoFilter,
      limit: 200,
    },
    {
      enabled: !!user && (user.role === "corretor" || user.role === "administrativo"),
    }
  );
  const inactiveCondominiumsQuery = trpc.condominios.list.useQuery(
    {
      search: inactiveSearch.trim() || undefined,
      includeInactive: true,
      limit: 300,
    },
    {
      enabled: !!isAdmin && inactiveModalOpen,
    }
  );

  const createCondominium = trpc.condominios.create.useMutation({
    onSuccess: async () => {
      await utils.condominios.list.invalidate();
      toast.success("Condominio cadastrado com sucesso.");
      setForm(INITIAL_FORM);
      setCepError("");
      setCepLoading(false);
      setIsFormCardOpen(false);
      setIsLocationSectionOpen(true);
      setIsCharacteristicsSectionOpen(true);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel cadastrar o condominio.");
    },
  });

  const updateCondominium = trpc.condominios.update.useMutation({
    onSuccess: async () => {
      await utils.condominios.list.invalidate();
      toast.success("Condominio atualizado com sucesso.");
      setForm(INITIAL_FORM);
      setEditingCondominiumId(null);
      setCepError("");
      setCepLoading(false);
      setIsFormCardOpen(false);
      setIsLocationSectionOpen(true);
      setIsCharacteristicsSectionOpen(true);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar o condominio.");
    },
  });

  const updateCondominiumStatus = trpc.condominios.updateStatus.useMutation({
    onSuccess: async (_, variables) => {
      await utils.condominios.list.invalidate();
      toast.success(
        variables.isAtivo === 1
          ? "Condominio reativado com sucesso."
          : "Condominio inativado com sucesso."
      );
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel alterar o status do condominio.");
    },
  });
  const deleteCondominium = trpc.condominios.delete.useMutation({
    onSuccess: async (result, variables) => {
      await utils.condominios.list.invalidate();
      if (editingCondominiumId === variables.id) {
        setEditingCondominiumId(null);
        setForm(INITIAL_FORM);
        setCepError("");
        setCepLoading(false);
        setIsFormCardOpen(false);
        setIsLocationSectionOpen(true);
        setIsCharacteristicsSectionOpen(true);
      }

      const detachedCount = result?.detachedPropertiesCount ?? 0;
      if (detachedCount > 0) {
        toast.success(
          `Condominio excluido com sucesso. ${detachedCount} imovel(is) foram desvinculados.`
        );
        return;
      }

      toast.success("Condominio excluido com sucesso.");
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel excluir o condominio.");
    },
  });

  const isSaving = createCondominium.isPending || updateCondominium.isPending;
  const hasCondominiums = (condominiumsQuery.data?.length ?? 0) > 0;
  const inactiveCondominiums = useMemo(
    () => (inactiveCondominiumsQuery.data ?? []).filter(item => item.isAtivo !== 1),
    [inactiveCondominiumsQuery.data]
  );

  const summaryText = useMemo(() => {
    const total = condominiumsQuery.data?.length ?? 0;
    return total === 1 ? "1 condominio encontrado" : `${total} condominios encontrados`;
  }, [condominiumsQuery.data]);

  const handleSubmit = () => {
    if (!form.nome.trim() || !form.endereco.trim() || !form.cidade.trim() || !form.estado.trim()) {
      toast.error("Preencha nome, endereco, cidade e estado.");
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      endereco: form.endereco.trim(),
      numero: toNullableString(form.numero),
      complemento: toNullableString(form.complemento),
      bairro: toNullableString(form.bairro),
      cidade: form.cidade.trim(),
      estado: form.estado.trim().toUpperCase(),
      cep: toNullableString(form.cep),
      referencia: toNullableString(form.referencia),
      valorCondominio: parseMoneyCentsInput(form.valorCondominio),
      valorIptu: parseMoneyCentsInput(form.valorIptu),
      cnpj: toNullableString(form.cnpj),
      administradoraNome: toNullableString(form.administradoraNome),
      administradoraContato: toNullableString(form.administradoraContato),
      caracteristicas: form.caracteristicas,
      observacoes: toNullableString(form.observacoes),
    };

    if (editingCondominiumId) {
      updateCondominium.mutate({
        id: editingCondominiumId,
        ...payload,
      });
      return;
    }

    createCondominium.mutate(payload);
  };

  const handleStartEdit = (condominium: CondominiumListItem) => {
    setEditingCondominiumId(condominium.id);
    setForm(mapCondominiumToForm(condominium));
    setCepError("");
    setCepLoading(false);
    setIsFormCardOpen(true);
    setIsLocationSectionOpen(true);
    setIsCharacteristicsSectionOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCepChange = async (value: string) => {
    const formattedValue = formatZipCode(value);
    setForm(current => ({ ...current, cep: formattedValue }));
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

      if (result.status === "success") {
        const dados = result.data;
        setForm(current => ({
          ...current,
          cep: formattedValue,
          endereco: dados.endereco || current.endereco,
          bairro: dados.bairro || current.bairro,
          cidade: dados.cidade || current.cidade,
          estado: dados.estado || current.estado,
        }));
        setCepError("");
      } else {
        setCepError(
          result.status === "not_found"
            ? "CEP nao encontrado"
            : "Servico de CEP indisponivel no momento"
        );
      }

      setCepLoading(false);
    }, 500);
  };

  const handleDeleteCondominium = (condominiumId: number) => {
    if (!window.confirm("Deseja realmente excluir este condominio? Esta acao nao pode ser desfeita.")) {
      return;
    }

    deleteCondominium.mutate({ id: condominiumId });
  };

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-16">
        <div className="container py-8 md:py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Condominios
            </h1>
            <p className="mt-2 text-slate-600">
              Centralize dados do condominio para agilizar o cadastro de novos imoveis.
            </p>
          </div>

          <Card className="mb-8 rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
            <CardHeader>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 text-left"
                onClick={() => setIsFormCardOpen(current => !current)}
                aria-expanded={isFormCardOpen}
              >
                <CardTitle className="text-lg md:text-xl">
                  {editingCondominiumId ? "Editar Condominio" : "Cadastrar Novo Condominio"}
                </CardTitle>
                {isFormCardOpen ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                )}
              </button>
            </CardHeader>
            {isFormCardOpen ? (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="space-y-2 md:col-span-6 xl:col-span-5">
                  <Label htmlFor="cond-nome">Nome do condominio *</Label>
                  <Input
                    id="cond-nome"
                    value={form.nome}
                    onChange={event => setForm(current => ({ ...current, nome: event.target.value }))}
                    placeholder="Ex: Residencial Bosque Verde"
                  />
                </div>

                <div className="space-y-2 md:col-span-3 xl:col-span-2">
                  <Label htmlFor="cond-tipo">Tipo *</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={value =>
                      setForm(current => ({ ...current, tipo: value as CondominiumType }))
                    }
                  >
                    <SelectTrigger id="cond-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartamento">Apartamento</SelectItem>
                      <SelectItem value="casa">Casa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="cond-cnpj">CNPJ</Label>
                  <Input
                    id="cond-cnpj"
                    value={form.cnpj}
                    onChange={event => setForm(current => ({ ...current, cnpj: event.target.value }))}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-2 md:col-span-6 xl:col-span-4">
                  <Label htmlFor="cond-admin-nome">Administradora</Label>
                  <Input
                    id="cond-admin-nome"
                    value={form.administradoraNome}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        administradoraNome: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-6 xl:col-span-3">
                  <Label htmlFor="cond-admin-contato">Contato da administradora</Label>
                  <Input
                    id="cond-admin-contato"
                    value={form.administradoraContato}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        administradoraContato: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-12 xl:col-span-5">
                  <Label htmlFor="cond-referencia">Referencia</Label>
                  <Input
                    id="cond-referencia"
                    value={form.referencia}
                    onChange={event =>
                      setForm(current => ({ ...current, referencia: event.target.value }))
                    }
                    placeholder="Ponto de referencia para facilitar visitas"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => setIsLocationSectionOpen(current => !current)}
                >
                  <span className="text-sm font-semibold text-slate-900">Localizacao</span>
                  {isLocationSectionOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>

                {isLocationSectionOpen ? (
                  <div className="grid grid-cols-1 gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-12">
                    <div className="space-y-2 md:col-span-3">
                      <Label htmlFor="cond-cep">CEP</Label>
                      <div className="relative">
                        <Input
                          id="cond-cep"
                          value={form.cep}
                          onChange={event => handleCepChange(event.target.value)}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                        {cepLoading ? (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                          </div>
                        ) : null}
                      </div>
                      {cepError ? <p className="text-xs text-red-600">{cepError}</p> : null}
                    </div>

                    <div className="space-y-2 md:col-span-6">
                      <Label htmlFor="cond-endereco">Endereco *</Label>
                      <Input
                        id="cond-endereco"
                        value={form.endereco}
                        onChange={event =>
                          setForm(current => ({ ...current, endereco: event.target.value }))
                        }
                        placeholder="Ex: Avenida das Flores"
                        disabled={cepLoading}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-3">
                      <Label htmlFor="cond-numero">Numero</Label>
                      <Input
                        id="cond-numero"
                        value={form.numero}
                        onChange={event => setForm(current => ({ ...current, numero: event.target.value }))}
                        placeholder="Ex: 1200"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-4">
                      <Label htmlFor="cond-bairro">Bairro</Label>
                      <Input
                        id="cond-bairro"
                        value={form.bairro}
                        onChange={event => setForm(current => ({ ...current, bairro: event.target.value }))}
                        disabled={cepLoading}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-5">
                      <Label htmlFor="cond-cidade">Cidade *</Label>
                      <Input
                        id="cond-cidade"
                        value={form.cidade}
                        onChange={event => setForm(current => ({ ...current, cidade: event.target.value }))}
                        disabled={cepLoading}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-3">
                      <Label htmlFor="cond-estado">Estado *</Label>
                      <Input
                        id="cond-estado"
                        value={form.estado}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            estado: event.target.value.toUpperCase(),
                          }))
                        }
                        maxLength={2}
                        placeholder="SP"
                        disabled={cepLoading}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => setIsCharacteristicsSectionOpen(current => !current)}
                >
                  <span className="text-sm font-semibold text-slate-900">Caracteristicas</span>
                  {isCharacteristicsSectionOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>

                {isCharacteristicsSectionOpen ? (
                  <div className="grid grid-cols-1 gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-12">
                    <div className="space-y-2 md:col-span-4">
                      <Label htmlFor="cond-complemento">Complemento</Label>
                      <Input
                        id="cond-complemento"
                        value={form.complemento}
                        onChange={event =>
                          setForm(current => ({ ...current, complemento: event.target.value }))
                        }
                        placeholder="Ex: Torre unica"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-4">
                      <Label htmlFor="cond-valor">Valor de condominio</Label>
                      <MoneyInput
                        id="cond-valor"
                        value={form.valorCondominio}
                        onValueChange={value =>
                          setForm(current => ({ ...current, valorCondominio: value }))
                        }
                        placeholder="R$ 0,00"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-4">
                      <Label htmlFor="cond-iptu">IPTU medio</Label>
                      <MoneyInput
                        id="cond-iptu"
                        value={form.valorIptu}
                        onValueChange={value => setForm(current => ({ ...current, valorIptu: value }))}
                        placeholder="R$ 0,00"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-12">
                      <Label>Itens do condominio</Label>
                      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {CONDOMINIUM_FEATURE_OPTIONS.map(feature => {
                          const checked = form.caracteristicas.includes(feature);
                          return (
                            <label
                              key={feature}
                              className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={event =>
                                  setForm(current => ({
                                    ...current,
                                    caracteristicas: event.target.checked
                                      ? [...current.caracteristicas, feature]
                                      : current.caracteristicas.filter(item => item !== feature),
                                  }))
                                }
                              />
                              {feature}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-12">
                      <Label htmlFor="cond-observacoes">Observacoes</Label>
                      <textarea
                        id="cond-observacoes"
                        value={form.observacoes}
                        onChange={event =>
                          setForm(current => ({ ...current, observacoes: event.target.value }))
                        }
                        className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm"
                        placeholder="Regras, facilidades, dados de portaria, etc."
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSubmit}
                  className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                  disabled={isSaving}
                >
                  {editingCondominiumId ? "Salvar alteracoes" : "Cadastrar condominio"}
                </Button>
                {editingCondominiumId ? (
                  <Button
                    variant="outline"
                    className="rounded-full border-slate-200"
                    onClick={() => {
                      setEditingCondominiumId(null);
                      setForm(INITIAL_FORM);
                      setCepError("");
                      setCepLoading(false);
                      setIsFormCardOpen(false);
                      setIsLocationSectionOpen(true);
                      setIsCharacteristicsSectionOpen(true);
                    }}
                    disabled={isSaving}
                  >
                    Cancelar edicao
                  </Button>
                ) : null}
              </div>
            </CardContent>
            ) : null}
          </Card>

          <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Pesquisar por nome, cidade, endereco, bairro, CNPJ..."
                    className="pl-9"
                  />
                </div>
                <div className="hidden md:block" />
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-start">
                {isAdmin ? (
                  <div className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:h-10 md:max-w-[360px] md:py-0">
                    <div className="flex min-h-6 items-center justify-between gap-3 md:h-full">
                      <p className="text-sm text-slate-700">Mostrar condominios inativos</p>
                      <Dialog open={inactiveModalOpen} onOpenChange={setInactiveModalOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-slate-200"
                          >
                            Mostrar inativos
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border-white/80 bg-[#f7f6f2] sm:max-w-[520px] lg:max-w-[520px]">
                          <DialogHeader>
                            <DialogTitle>Condominios inativos</DialogTitle>
                            <DialogDescription>
                              Consulte os condominios inativados e pesquise pelo nome, cidade ou endereco.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <Input
                                value={inactiveSearch}
                                onChange={event => setInactiveSearch(event.target.value)}
                                placeholder="Pesquisar inativos..."
                                className="pl-9"
                              />
                            </div>

                            {inactiveCondominiumsQuery.isLoading ? (
                              <p className="text-sm text-slate-500">Carregando condominios inativos...</p>
                            ) : inactiveCondominiums.length > 0 ? (
                              <div className="space-y-2">
                                {inactiveCondominiums.map(item => (
                                  <div
                                    key={item.id}
                                    className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900">{item.nome}</p>
                                      <p className="text-xs text-slate-600">
                                        {item.cidade}/{item.estado} • {item.tipo}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-600">
                                        {item.endereco}
                                        {item.numero ? `, ${item.numero}` : ""}
                                        {item.bairro ? ` - ${item.bairro}` : ""}
                                      </p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-fit shrink-0 rounded-full border-emerald-200 px-3 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                      onClick={() =>
                                        updateCondominiumStatus.mutate({
                                          id: item.id,
                                          isAtivo: 1,
                                        })
                                      }
                                      disabled={updateCondominiumStatus.isPending}
                                    >
                                      <Power className="mr-1.5 h-3.5 w-3.5" />
                                      Ativar
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">Nenhum condominio inativo encontrado.</p>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ) : (
                  <div className="hidden md:block" />
                )}

                <div className="w-full md:w-[220px]">
                  <Select
                    value={tipoFilter}
                    onValueChange={value => setTipoFilter(value as "todos" | CondominiumType)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      <SelectItem value="apartamento">Apartamento</SelectItem>
                      <SelectItem value="casa">Casa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-sm text-slate-600">{summaryText}</div>

              {condominiumsQuery.isLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Carregando condominios...
                </div>
              ) : hasCondominiums ? (
                <div className="space-y-3">
                  {condominiumsQuery.data?.map(condominium => (
                    <div
                      key={condominium.id}
                      className={`rounded-2xl border p-4 ${
                        condominium.isAtivo === 1
                          ? "border-slate-200 bg-white"
                          : "border-amber-200 bg-amber-50/60"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-950">{condominium.nome}</p>
                          <p className="text-sm text-slate-600">
                            {condominium.cidade}/{condominium.estado} • {condominium.tipo}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {condominium.endereco}
                            {condominium.numero ? `, ${condominium.numero}` : ""}
                            {condominium.bairro ? ` - ${condominium.bairro}` : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-slate-200"
                            onClick={() => handleStartEdit(condominium)}
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          {isAdmin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full border-slate-200"
                              onClick={() =>
                                updateCondominiumStatus.mutate({
                                  id: condominium.id,
                                  isAtivo: condominium.isAtivo === 1 ? 0 : 1,
                                })
                              }
                              disabled={updateCondominiumStatus.isPending}
                            >
                              <Power className="mr-2 h-4 w-4" />
                              {condominium.isAtivo === 1 ? "Inativar" : "Reativar"}
                            </Button>
                          ) : null}
                          {isAdmin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                              onClick={() => handleDeleteCondominium(condominium.id)}
                              disabled={deleteCondominium.isPending}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-600">
                  <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                  Nenhum condominio encontrado para os filtros atuais.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
