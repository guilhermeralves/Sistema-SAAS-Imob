import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Layout from "@/components/Layout";
import ProtectedPropertyImage from "@/components/ProtectedPropertyImage";
import MoneyInput from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCep } from "@/lib/cep";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { formatMoneyFromCentsValue, parseMoneyCentsInput } from "@/lib/money";
import { formatPhoneNumber } from "@/lib/phone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  saveNewPropertyDraft,
  saveNewPropertyDraftPhotos,
} from "@/lib/property-draft";
import {
  Building2,
  MapPin,
  Bed,
  Bath,
  Car,
  Search,
  SlidersHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
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
    rawValues.push("locacao", "loca��o");
  } else if (property.finalidade === "venda") {
    rawValues.push("venda");
  }

  return normalizeSearchValue(rawValues.join(" "));
}

export default function Imoveis() {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: imoveis, isLoading } = trpc.properties.list.useQuery();
  const searchParams = new URLSearchParams(
    typeof window !== "undefined"
      ? window.location.search
      : (location.split("?")[1] ?? "")
  );
  const isRentalProposalSelectionMode =
    searchParams.get("selecionarLocacao") === "1";
  const canManageProperties =
    isAuthenticated &&
    (user?.role === "corretor" || user?.role === "administrativo");
  // Estado para controlar o dialog (Aberto ou fechado)
  const [newPropertyOpen, setNewPropertyOpen] = useState(false);
  // Estado para armazenar os dados do formulario
  const [newPropertyData, setNewPropertyData] = useState({
    titulo: "",
    descricao: "",
    tipo: "apartamento",
    finalidade: "venda",
    idCorretor: "",
    emCondominio: "nao",
    tipoCondominio: "",
    idCondominio: "",
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
    parceria: "nao",
    parceriaNome: "",
    parceriaTelefone: "",
    parceriaReferencia: "",
    ownerName: "",
    ownerEmail: "",
    ownerCpf: "",
    ownerPhone: "",
    owners: [
      {
        name: "",
        email: "",
        cpf: "",
        phone: "",
      },
    ],
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

  const { data: adminUsers } = trpc.admin.users.useQuery(undefined, {
    enabled: user?.role === "administrativo",
  });
  const shouldLoadCondominiums =
    canManageProperties &&
    newPropertyData.emCondominio === "sim" &&
    (newPropertyData.tipoCondominio === "casa" ||
      newPropertyData.tipoCondominio === "apartamento");

  const { data: condominios } = trpc.condominios.list.useQuery(
    {
      tipo:
        newPropertyData.tipoCondominio === "casa" ||
        newPropertyData.tipoCondominio === "apartamento"
          ? newPropertyData.tipoCondominio
          : undefined,
      limit: 200,
    },
    {
      enabled: shouldLoadCondominiums,
    }
  );
  const [condominioSearch, setCondominioSearch] = useState("");

  const activeResponsibleUsers =
    adminUsers?.filter(
      candidate =>
        (candidate.role === "corretor" || candidate.role === "administrativo") &&
        candidate.isActive === 1 &&
        !(candidate.role === "administrativo" && candidate.registrationSource === "bootstrap")
    ) || [];
  const filteredCondominios = useMemo(() => {
    const normalizedTerm = normalizeSearchValue(condominioSearch.trim());
    const normalizedTerms = normalizedTerm.split(/\s+/).filter(Boolean);

    const getSearchText = (
      condominio: NonNullable<typeof condominios>[number]
    ) =>
      normalizeSearchValue(
        [
          condominio.nome,
          condominio.endereco,
          condominio.bairro ?? "",
          condominio.cidade,
          condominio.estado,
          condominio.cep ?? "",
          condominio.cnpj ?? "",
          condominio.referencia ?? "",
        ].join(" ")
      );

    const getRelevanceScore = (
      condominio: NonNullable<typeof condominios>[number]
    ) => {
      const searchableText = getSearchText(condominio);
      const normalizedName = normalizeSearchValue(condominio.nome);

      return normalizedTerms.reduce((score, term) => {
        if (normalizedName === term) return score + 120;
        if (normalizedName.startsWith(term)) return score + 90;
        if (normalizedName.includes(term)) return score + 60;
        if (searchableText.includes(term)) return score + 25;
        return score;
      }, 0);
    };

    const sortedCondominios = [...(condominios ?? [])].sort((a, b) => {
      if (normalizedTerms.length > 0) {
        const relevanceDiff = getRelevanceScore(b) - getRelevanceScore(a);
        if (relevanceDiff !== 0) return relevanceDiff;
      }

      return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    });

    return sortedCondominios
      .filter(condominio => {
        if (normalizedTerms.length === 0) return true;
        const searchableText = normalizeSearchValue(
          [
            condominio.nome,
            condominio.endereco,
            condominio.bairro ?? "",
            condominio.cidade,
            condominio.estado,
            condominio.cep ?? "",
            condominio.cnpj ?? "",
            condominio.referencia ?? "",
          ].join(" ")
        );
        return normalizedTerms.every(term => searchableText.includes(term));
      })
      .slice(0, 3);
  }, [condominios, condominioSearch]);
  const selectedCondominio = useMemo(() => {
    if (!newPropertyData.idCondominio) return null;
    return (
      (condominios ?? []).find(
        condominio => condominio.id === Number(newPropertyData.idCondominio)
      ) ?? null
    );
  }, [condominios, newPropertyData.idCondominio]);
  const shouldShowCondominioResults =
    !selectedCondominio || condominioSearch.trim().length > 0;

  const handleProceedToPhotoStep = () => {
    const isPartnership = newPropertyData.parceria === "sim";
    const owners = newPropertyData.owners?.length
      ? newPropertyData.owners
      : [
          {
            name: newPropertyData.ownerName,
            email: newPropertyData.ownerEmail,
            cpf: newPropertyData.ownerCpf,
            phone: newPropertyData.ownerPhone,
          },
        ];
    const normalizedOwners = owners.map(owner => ({
      ...owner,
      cpf: owner.cpf ? formatCpf(normalizeCpf(owner.cpf)) : "",
    }));
    const primaryOwner = normalizedOwners[0];

    // Valida campos obrigatorios
    if (
      !newPropertyData.titulo ||
      !newPropertyData.valor ||
      !newPropertyData.endereco
    ) {
      toast.error("Preencha t�tulo, valor e endere�o");
      return;
    }

    if (user?.role === "administrativo" && !newPropertyData.idCorretor) {
      toast.error("Selecione o responsável pelo imóvel.");
      return;
    }

    if (newPropertyData.emCondominio === "sim") {
      if (!newPropertyData.tipoCondominio) {
        toast.error("Selecione o tipo do condominio.");
        return;
      }

      if (!newPropertyData.idCondominio) {
        toast.error("Selecione o condominio para continuar.");
        return;
      }
    }

    if (isPartnership) {
      if (
        !newPropertyData.parceriaNome.trim() ||
        !newPropertyData.parceriaTelefone.trim()
      ) {
        toast.error("Informe o nome e o telefone da imobiliaria parceira.");
        return;
      }
    } else if (
      !primaryOwner?.name ||
      !primaryOwner.phone
    ) {
      toast.error("Preencha os dados obrigatorios do proprietario principal.");
      return;
    }

    if (!isPartnership) {
      const invalidOwnerIndex = normalizedOwners.findIndex(
        owner => owner.cpf && !isValidCpf(owner.cpf)
      );
      if (invalidOwnerIndex >= 0) {
        toast.error(
          `CPF do proprietario ${invalidOwnerIndex + 1} invalido. Confira os digitos informados.`
        );
        return;
      }
    }

    saveNewPropertyDraft({
      ...newPropertyData,
      ownerName: isPartnership ? "" : primaryOwner.name,
      ownerEmail: isPartnership ? "" : primaryOwner.email,
      ownerCpf: isPartnership ? "" : primaryOwner.cpf,
      ownerPhone: isPartnership ? "" : primaryOwner.phone,
      owners: isPartnership ? [] : normalizedOwners,
    });
    saveNewPropertyDraftPhotos([]);
    setNewPropertyOpen(false);
    setLocation("/imoveis/novo/preview");
  };

  const handleSelectCondominio = (condominioIdValue: string) => {
    if (condominioIdValue === "empty") {
      setNewPropertyData(current => ({
        ...current,
        idCondominio: "",
      }));
      return;
    }

    const selectedCondominio = (condominios ?? []).find(
      item => item.id === Number(condominioIdValue)
    );

    if (!selectedCondominio) {
      toast.error("Condominio selecionado nao encontrado.");
      return;
    }

    setNewPropertyData(current => ({
      ...current,
      idCondominio: String(selectedCondominio.id),
      emCondominio: "sim",
      tipoCondominio: selectedCondominio.tipo,
      tipo: selectedCondominio.tipo,
      endereco: selectedCondominio.endereco,
      numero: selectedCondominio.numero ?? current.numero,
      bairro: selectedCondominio.bairro ?? current.bairro,
      cidade: selectedCondominio.cidade,
      estado: selectedCondominio.estado,
      cep: selectedCondominio.cep ?? current.cep,
    }));
    setCepError("");
  };

  const updateOwnerDraft = (
    index: number,
    field: "name" | "email" | "cpf" | "phone",
    value: string
  ) => {
    setNewPropertyData(current => {
      const owners = current.owners?.length
        ? [...current.owners]
        : [
            {
              name: current.ownerName,
              email: current.ownerEmail,
              cpf: current.ownerCpf,
              phone: current.ownerPhone,
            },
          ];
      owners[index] = {
        ...owners[index],
        [field]:
          field === "cpf"
            ? formatCpf(value)
            : field === "phone"
              ? formatPhoneNumber(value)
              : value,
      };
      const primaryOwner = owners[0];

      return {
        ...current,
        owners,
        ownerName: primaryOwner.name,
        ownerEmail: primaryOwner.email,
        ownerCpf: primaryOwner.cpf,
        ownerPhone: primaryOwner.phone,
      };
    });
  };

  const addOwnerDraft = () => {
    setNewPropertyData(current => {
      const owners = current.owners?.length
        ? current.owners
        : [
            {
              name: current.ownerName,
              email: current.ownerEmail,
              cpf: current.ownerCpf,
              phone: current.ownerPhone,
            },
          ];

      if (owners.length >= 3) {
        toast.error("E possivel vincular ate 3 proprietarios por imovel.");
        return current;
      }

      return {
        ...current,
        owners: [...owners, { name: "", email: "", cpf: "", phone: "" }],
      };
    });
  };

  const removeOwnerDraft = (index: number) => {
    setNewPropertyData(current => {
      const owners = current.owners?.length
        ? [...current.owners]
        : [
            {
              name: current.ownerName,
              email: current.ownerEmail,
              cpf: current.ownerCpf,
              phone: current.ownerPhone,
            },
          ];

      if (owners.length === 1) return current;

      owners.splice(index, 1);
      const primaryOwner = owners[0];

      return {
        ...current,
        owners,
        ownerName: primaryOwner.name,
        ownerEmail: primaryOwner.email,
        ownerCpf: primaryOwner.cpf,
        ownerPhone: primaryOwner.phone,
      };
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
        setNewPropertyData(prev => ({
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
            ? "CEP n�o encontrado"
            : "Servi�o de CEP indispon�vel no momento"
        );
      }

      setCepLoading(false);
    }, 500);
  };
  // ========== FIM DA FUNCAO ==========

  const [showFilters, setShowFilters] = useState(false);
  const [selectedRentalProperty, setSelectedRentalProperty] = useState<
    NonNullable<typeof imoveis>[number] | null
  >(null);
  const {
    data: pendingProposalForSelected,
    isFetching: checkingPendingProposal,
  } = trpc.rentalProposals.pendingForProperty.useQuery(
    { propertyId: selectedRentalProperty?.id ?? 0 },
    { enabled: selectedRentalProperty !== null }
  );
  const [filters, setFilters] = useState({
    tipo: "todos",
    finalidade: isRentalProposalSelectionMode ? "locacao" : "todos",
    cidade: "",
    bairro: "",
    quartos: "todos",
    banheiros: "todos",
    vagas: "todos",
    valorMin: "",
    valorMax: "",
    search: "",
  });

  useEffect(() => {
    if (!isRentalProposalSelectionMode) return;
    setFilters(current => ({
      ...current,
      finalidade: "locacao",
    }));
  }, [isRentalProposalSelectionMode]);

  // Aplicar filtros
  const imoveisFiltrados = imoveis?.filter(imovel => {
    const normalizedCidade = normalizeSearchValue(filters.cidade);
    const normalizedBairro = normalizeSearchValue(filters.bairro);
    const searchTerms = normalizeSearchValue(filters.search)
      .split(/\s+/)
      .filter(Boolean);

    if (filters.tipo !== "todos" && imovel.tipo !== filters.tipo) return false;
    if (
      filters.finalidade === "locacao" &&
      imovel.finalidade !== "locacao" &&
      imovel.finalidade !== "ambos"
    )
      return false;
    if (
      filters.finalidade !== "todos" &&
      filters.finalidade !== "locacao" &&
      imovel.finalidade !== filters.finalidade
    )
      return false;
    if (
      filters.cidade &&
      !normalizeSearchValue(imovel.cidade).includes(normalizedCidade)
    )
      return false;
    if (
      filters.bairro &&
      !normalizeSearchValue(imovel.bairro || "").includes(normalizedBairro)
    )
      return false;
    if (
      filters.quartos !== "todos" &&
      (imovel.quartos ?? 0) !== Number(filters.quartos)
    )
      return false;
    if (
      filters.banheiros !== "todos" &&
      (imovel.banheiros ?? 0) !== Number(filters.banheiros)
    )
      return false;
    if (
      filters.vagas !== "todos" &&
      (imovel.vagas ?? 0) !== Number(filters.vagas)
    )
      return false;
    if (
      filters.valorMin &&
      imovel.valor < (parseMoneyCentsInput(filters.valorMin) ?? 0)
    )
      return false;
    if (
      filters.valorMax &&
      imovel.valor > (parseMoneyCentsInput(filters.valorMax) ?? 0)
    )
      return false;

    if (searchTerms.length > 0) {
      const searchableText = buildPropertySearchText(
        imovel as Record<string, unknown>
      );
      if (!searchTerms.every(term => searchableText.includes(term)))
        return false;
    }

    return true;
  });

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
        <div className="container py-8 md:py-10">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                {isRentalProposalSelectionMode
                  ? "Imóveis para Locação"
                  : "Imóveis Disponíveis"}
              </h1>
              <p className="mt-2 text-slate-600">
                {isRentalProposalSelectionMode
                  ? "Escolha um imóvel para iniciar a proposta de Locação"
                  : "Encontre o imóvel perfeito para você"}
              </p>
            </div>

            {/* Botao que abre o dialog */}
            {canManageProperties && !isRentalProposalSelectionMode ? (
              <Dialog open={newPropertyOpen} onOpenChange={setNewPropertyOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800">
                    <Plus className="h-4 w-4" />
                    Novo Imóvel
                  </Button>
                </DialogTrigger>

                {/* Conteudo do dialog */}
                <DialogContent
                  className="max-h-[90vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6 lg:max-w-4xl"
                  onOpenAutoFocus={event => event.preventDefault()}
                >
                  <DialogHeader className="space-y-3 pb-2">
                    <div className="inline-flex w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                      Cadastro Imobiliário
                    </div>
                    <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                      Cadastrar Novo Imóvel
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)] sm:p-5">
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-slate-950">
                          Dados principais
                        </h3>
                        <p className="text-sm text-slate-600">
                          Identificação, finalidade e valores do imóvel.
                        </p>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-6">
                        {/* Campo Titulo */}
                        <div className="space-y-1 sm:space-y-2 lg:col-span-4">
                          <Label
                            htmlFor="titulo"
                            className="text-sm sm:text-base"
                          >
                            Título *
                          </Label>
                          <Input
                            id="titulo"
                            value={newPropertyData.titulo}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                titulo: e.target.value,
                              })
                            }
                            placeholder="Ex: Apartamento 3 Quartos no Centro"
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                          />
                        </div>

                        <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                          <Label
                            htmlFor="tipo"
                            className="text-sm sm:text-base"
                          >
                            Tipo *
                          </Label>
                          <select
                            id="tipo"
                            value={newPropertyData.tipo}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                tipo: e.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white/90 p-3 text-sm shadow-sm sm:text-base"
                          >
                            <option value="apartamento">Apartamento</option>
                            <option value="casa">Casa</option>
                            <option value="terreno">Terreno</option>
                            <option value="comercial">Comercial</option>
                          </select>
                        </div>

                        {/* Campo Descricao */}
                        <div className="space-y-1 sm:space-y-2 lg:col-span-6">
                          <Label
                            htmlFor="descricao"
                            className="text-sm sm:text-base"
                          >
                            Descrição
                          </Label>
                          <textarea
                            id="descricao"
                            value={newPropertyData.descricao}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                descricao: e.target.value,
                              })
                            }
                            placeholder="Descrição sobre o imóvel"
                            className="w-full resize-none rounded-2xl border border-slate-200 bg-white/90 p-3 text-sm shadow-sm sm:text-base"
                            rows={3}
                          />
                        </div>

                        <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                          <Label
                            htmlFor="finalidade"
                            className="text-sm sm:text-base"
                          >
                            Finalidade *
                          </Label>
                          <select
                            id="finalidade"
                            value={newPropertyData.finalidade}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                finalidade: e.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white/90 p-3 text-sm shadow-sm sm:text-base"
                          >
                            <option value="venda">Venda</option>
                            <option value="locacao">Locação</option>
                          </select>
                        </div>

                        <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                          <Label
                            htmlFor="valor"
                            className="text-sm sm:text-base"
                          >
                            Valor (R$) *
                          </Label>
                          <MoneyInput
                            id="valor"
                            value={newPropertyData.valor}
                            onValueChange={value =>
                              setNewPropertyData({
                                ...newPropertyData,
                                valor: value,
                              })
                            }
                            placeholder="R$ 0,00"
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                          />
                        </div>

                        <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                          <Label
                            htmlFor="idCorretor"
                            className="text-sm sm:text-base"
                          >
                            Responsável pelo imóvel *
                          </Label>
                          {user?.role === "administrativo" ? (
                            <Select
                              value={newPropertyData.idCorretor || "empty"}
                              onValueChange={value =>
                                setNewPropertyData({
                                  ...newPropertyData,
                                  idCorretor: value === "empty" ? "" : value,
                                })
                              }
                            >
                              <SelectTrigger
                                id="idCorretor"
                                className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                              >
                                <SelectValue placeholder="Selecione o responsável pelo imóvel" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="empty">Selecione</SelectItem>
                                {activeResponsibleUsers.map(broker => (
                                  <SelectItem
                                    key={broker.id}
                                    value={String(broker.id)}
                                  >
                                    {broker.name || broker.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={user?.name || user?.email || "Responsável"}
                              disabled
                              className="rounded-2xl border-slate-200 bg-white/80 text-sm shadow-sm sm:text-base"
                            />
                          )}
                        </div>

                        <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                          <Label
                            htmlFor="emCondominio"
                            className="text-sm sm:text-base"
                          >
                            E de condominio? *
                          </Label>
                          <Select
                            value={newPropertyData.emCondominio}
                            onValueChange={value => {
                              if (value === "sim") {
                                setNewPropertyData(current => ({
                                  ...current,
                                  emCondominio: "sim",
                                }));
                                return;
                              }

                              setNewPropertyData(current => ({
                                ...current,
                                emCondominio: "nao",
                                tipoCondominio: "",
                                idCondominio: "",
                              }));
                              setCondominioSearch("");
                            }}
                          >
                            <SelectTrigger
                              id="emCondominio"
                              className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nao">Nao</SelectItem>
                              <SelectItem value="sim">Sim</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {newPropertyData.emCondominio === "sim" ? (
                          <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                            <Label
                              htmlFor="tipoCondominio"
                              className="text-sm sm:text-base"
                            >
                              Tipo no condominio *
                            </Label>
                            <Select
                              value={newPropertyData.tipoCondominio || "empty"}
                              onValueChange={value => {
                                if (value === "empty") {
                                  setNewPropertyData(current => ({
                                    ...current,
                                    tipoCondominio: "",
                                    idCondominio: "",
                                  }));
                                  return;
                                }

                                setNewPropertyData(current => ({
                                  ...current,
                                  tipoCondominio: value,
                                  tipo: value,
                                  idCondominio: "",
                                }));
                                setCondominioSearch("");
                              }}
                            >
                              <SelectTrigger
                                id="tipoCondominio"
                                className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                              >
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="empty">Selecione</SelectItem>
                                <SelectItem value="apartamento">
                                  Apartamento
                                </SelectItem>
                                <SelectItem value="casa">Casa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}

                        {newPropertyData.emCondominio === "sim" ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 lg:col-span-6">
                            <div className="space-y-3">
                              <div className="space-y-1 sm:space-y-2">
                                <Label
                                  htmlFor="condominio-search"
                                  className="text-sm sm:text-base"
                                >
                                  Pesquisar condominio
                                </Label>
                                <Input
                                  id="condominio-search"
                                  value={condominioSearch}
                                  onChange={event =>
                                    setCondominioSearch(event.target.value)
                                  }
                                  placeholder="Nome, cidade, bairro, endereco, CNPJ..."
                                  className="rounded-2xl border-slate-200 bg-white text-sm shadow-sm sm:text-base"
                                  disabled={!newPropertyData.tipoCondominio}
                                />
                              </div>

                              {selectedCondominio ? (
                                <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="font-semibold">
                                      {selectedCondominio.nome}
                                    </p>
                                    <p className="text-emerald-900/75">
                                      {selectedCondominio.endereco}
                                      {selectedCondominio.numero
                                        ? `, ${selectedCondominio.numero}`
                                        : ""}
                                      {selectedCondominio.bairro
                                        ? ` - ${selectedCondominio.bairro}`
                                        : ""}
                                      , {selectedCondominio.cidade}/
                                      {selectedCondominio.estado}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 rounded-full border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                                    onClick={() =>
                                      setNewPropertyData(current => ({
                                        ...current,
                                        idCondominio: "",
                                      }))
                                    }
                                  >
                                    Trocar
                                  </Button>
                                </div>
                              ) : null}

                              {shouldShowCondominioResults ? (
                                <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                                  {!newPropertyData.tipoCondominio ? (
                                    <p className="px-3 py-4 text-sm text-slate-500">
                                      Selecione primeiro o tipo do condomínio.
                                    </p>
                                  ) : filteredCondominios.length > 0 ? (
                                    <div className="space-y-2">
                                      {filteredCondominios.map(condominio => {
                                        const isSelected =
                                          newPropertyData.idCondominio ===
                                          String(condominio.id);

                                        return (
                                          <button
                                            key={condominio.id}
                                            type="button"
                                            className={`w-full rounded-xl border p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50 ${
                                              isSelected
                                                ? "border-emerald-300 bg-emerald-50"
                                                : "border-transparent bg-white"
                                            }`}
                                            onClick={() =>
                                              handleSelectCondominio(
                                                String(condominio.id)
                                              )
                                            }
                                          >
                                            <span className="block text-sm font-semibold text-slate-950">
                                              {condominio.nome}
                                            </span>
                                            <span className="mt-1 block text-xs text-slate-600">
                                              {condominio.endereco}
                                              {condominio.numero
                                                ? `, ${condominio.numero}`
                                                : ""}
                                              {condominio.bairro
                                                ? ` - ${condominio.bairro}`
                                                : ""}
                                              , {condominio.cidade}/
                                              {condominio.estado}
                                              {condominio.cep
                                                ? ` • ${condominio.cep}`
                                                : ""}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="px-3 py-4 text-sm text-slate-500">
                                      Nenhum condomínio encontrado para a busca
                                      atual.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Campos de Caracteristicas (Grid) */}
                    <div className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)] sm:p-5">
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-slate-950">
                          Características e localização
                        </h3>
                        <p className="text-sm text-slate-600">
                          Medidas, cômodos e endereço usado na divulgação.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:max-w-3xl">
                        <div className="space-y-1 sm:space-y-2">
                          <Label
                            htmlFor="area"
                            className="text-sm sm:text-base"
                          >
                            Área (m²)
                          </Label>
                          <Input
                            id="area"
                            type="number"
                            value={newPropertyData.area}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                area: e.target.value,
                              })
                            }
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                          />
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <Label
                            htmlFor="quartos"
                            className="text-sm sm:text-base"
                          >
                            Quartos
                          </Label>
                          <Input
                            id="quartos"
                            type="number"
                            value={newPropertyData.quartos}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                quartos: e.target.value,
                              })
                            }
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                          />
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <Label
                            htmlFor="banheiros"
                            className="text-sm sm:text-base"
                          >
                            Banheiros
                          </Label>
                          <Input
                            id="banheiros"
                            type="number"
                            value={newPropertyData.banheiros}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                banheiros: e.target.value,
                              })
                            }
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                          />
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <Label
                            htmlFor="vagas"
                            className="text-sm sm:text-base"
                          >
                            Vagas
                          </Label>
                          <Input
                            id="vagas"
                            type="number"
                            value={newPropertyData.vagas}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                vagas: e.target.value,
                              })
                            }
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                          />
                        </div>
                      </div>
                      <div className="mt-5 grid gap-4 lg:grid-cols-6">
                        <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                          <Label htmlFor="cep" className="text-sm sm:text-base">
                            CEP
                          </Label>
                          <div className="relative">
                            <Input
                              id="cep"
                              value={newPropertyData.cep}
                              onChange={e => handleCepChange(e.target.value)}
                              placeholder="01310-100"
                              className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                              maxLength={9}
                            />
                            {cepLoading && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                              </div>
                            )}
                          </div>
                          {cepError && (
                            <p className="text-red-500 text-xs sm:text-sm mt-1">
                              {cepError}
                            </p>
                          )}
                        </div>
                        {/* Campos de Localizacao */}
                        <div className="space-y-1 sm:space-y-2 lg:col-span-4">
                          <Label
                            htmlFor="endereco"
                            className="text-sm sm:text-base"
                          >
                            Endereço *
                          </Label>
                          <Input
                            id="endereco"
                            value={newPropertyData.endereco}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                endereco: e.target.value,
                              })
                            }
                            placeholder="Ex: Rua Principal, 123"
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                            disabled={cepLoading}
                          />
                        </div>

                        <div className="space-y-1 sm:space-y-2 lg:col-span-1">
                          <Label
                            htmlFor="numero"
                            className="text-sm sm:text-base"
                          >
                            Número
                          </Label>
                          <Input
                            id="numero"
                            value={newPropertyData.numero}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                numero: e.target.value,
                              })
                            }
                            placeholder="Ex: 123"
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                          />
                        </div>
                        <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                          <Label
                            htmlFor="bairro"
                            className="text-sm sm:text-base"
                          >
                            Bairro
                          </Label>
                          <Input
                            id="bairro"
                            value={newPropertyData.bairro}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                bairro: e.target.value,
                              })
                            }
                            placeholder="Ex: Centro"
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                            disabled={cepLoading}
                          />
                        </div>
                        <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                          <Label
                            htmlFor="cidade"
                            className="text-sm sm:text-base"
                          >
                            Cidade
                          </Label>
                          <Input
                            id="cidade"
                            value={newPropertyData.cidade}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                cidade: e.target.value,
                              })
                            }
                            placeholder="Ex: São Paulo"
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                            disabled={cepLoading}
                          />
                        </div>
                        <div className="space-y-1 sm:space-y-2 lg:col-span-1">
                          <Label
                            htmlFor="estado"
                            className="text-sm sm:text-base"
                          >
                            Estado
                          </Label>
                          <Input
                            id="estado"
                            value={newPropertyData.estado}
                            onChange={e =>
                              setNewPropertyData({
                                ...newPropertyData,
                                estado: e.target.value,
                              })
                            }
                            placeholder="SP"
                            maxLength={2}
                            className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                            disabled={cepLoading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-emerald-100/70 bg-[linear-gradient(180deg,rgba(245,250,247,0.95),rgba(255,255,255,0.92))] p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)] sm:p-5">
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-slate-950">
                          Proprietário ou parceria
                        </h3>
                        <p className="text-sm text-slate-600">
                          Nome e telefone são obrigatórios. CPF e e-mail ajudam
                          a reaproveitar cadastros existentes.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="max-w-xs space-y-1 sm:space-y-2">
                          <Label
                            htmlFor="parceria"
                            className="text-sm sm:text-base"
                          >
                            Parceria
                          </Label>
                          <Select
                            value={newPropertyData.parceria}
                            onValueChange={value =>
                              setNewPropertyData(current => ({
                                ...current,
                                parceria: value,
                              }))
                            }
                          >
                            <SelectTrigger
                              id="parceria"
                              className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nao">Não</SelectItem>
                              <SelectItem value="sim">Sim</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {newPropertyData.parceria === "sim" ? (
                          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-6">
                              <div className="space-y-1 sm:space-y-2 lg:col-span-3">
                                <Label
                                  htmlFor="parceriaNome"
                                  className="text-sm sm:text-base"
                                >
                                  Nome da imobiliária *
                                </Label>
                                <Input
                                  id="parceriaNome"
                                  value={newPropertyData.parceriaNome}
                                  onChange={e =>
                                    setNewPropertyData({
                                      ...newPropertyData,
                                      parceriaNome: e.target.value,
                                    })
                                  }
                                  className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                                />
                              </div>
                              <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                                <Label
                                  htmlFor="parceriaTelefone"
                                  className="text-sm sm:text-base"
                                >
                                  Telefone *
                                </Label>
                                <Input
                                  id="parceriaTelefone"
                                  value={newPropertyData.parceriaTelefone}
                                  onChange={e =>
                                    setNewPropertyData({
                                      ...newPropertyData,
                                      parceriaTelefone: formatPhoneNumber(
                                        e.target.value
                                      ),
                                    })
                                  }
                                  className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                                />
                              </div>
                              <div className="space-y-1 sm:space-y-2 lg:col-span-1">
                                <Label
                                  htmlFor="parceriaReferencia"
                                  className="text-sm sm:text-base"
                                >
                                  Referência
                                </Label>
                                <Input
                                  id="parceriaReferencia"
                                  value={newPropertyData.parceriaReferencia}
                                  onChange={e =>
                                    setNewPropertyData({
                                      ...newPropertyData,
                                      parceriaReferencia: e.target.value,
                                    })
                                  }
                                  className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(newPropertyData.owners?.length
                              ? newPropertyData.owners
                              : [
                                  {
                                    name: newPropertyData.ownerName,
                                    email: newPropertyData.ownerEmail,
                                    cpf: newPropertyData.ownerCpf,
                                    phone: newPropertyData.ownerPhone,
                                  },
                                ]
                            ).map((owner, index) => (
                              <div
                                key={index}
                                className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm"
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-slate-950">
                                    Proprietário {index + 1}
                                    {index === 0 ? " *" : ""}
                                  </p>
                                  {index > 0 ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 rounded-full bg-white text-rose-700 hover:bg-rose-50"
                                      onClick={() => removeOwnerDraft(index)}
                                      aria-label={`Remover proprietário ${index + 1}`}
                                      title={`Remover proprietário ${index + 1}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-6">
                                  <div className="space-y-1 sm:space-y-2 lg:col-span-4">
                                    <Label
                                      htmlFor={`ownerName-${index}`}
                                      className="text-sm sm:text-base"
                                    >
                                      Nome e sobrenome {index === 0 ? "*" : ""}
                                    </Label>
                                    <Input
                                      id={`ownerName-${index}`}
                                      value={owner.name}
                                      onChange={e =>
                                        updateOwnerDraft(
                                          index,
                                          "name",
                                          e.target.value
                                        )
                                      }
                                      className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                                    />
                                  </div>
                                  <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                                    <Label
                                      htmlFor={`ownerCpf-${index}`}
                                      className="text-sm sm:text-base"
                                    >
                                      CPF
                                    </Label>
                                    <Input
                                      id={`ownerCpf-${index}`}
                                      inputMode="numeric"
                                      maxLength={14}
                                      value={owner.cpf}
                                      onChange={e =>
                                        updateOwnerDraft(
                                          index,
                                          "cpf",
                                          e.target.value
                                        )
                                      }
                                      className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                                    />
                                  </div>
                                  <div className="space-y-1 sm:space-y-2 lg:col-span-4">
                                    <Label
                                      htmlFor={`ownerEmail-${index}`}
                                      className="text-sm sm:text-base"
                                    >
                                      E-mail
                                    </Label>
                                    <Input
                                      id={`ownerEmail-${index}`}
                                      type="email"
                                      value={owner.email}
                                      onChange={e =>
                                        updateOwnerDraft(
                                          index,
                                          "email",
                                          e.target.value
                                        )
                                      }
                                      className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                                    />
                                  </div>
                                  <div className="space-y-1 sm:space-y-2 lg:col-span-2">
                                    <Label
                                      htmlFor={`ownerPhone-${index}`}
                                      className="text-sm sm:text-base"
                                    >
                                      Telefone {index === 0 ? "*" : ""}
                                    </Label>
                                    <Input
                                      id={`ownerPhone-${index}`}
                                      value={owner.phone}
                                      onChange={e =>
                                        updateOwnerDraft(
                                          index,
                                          "phone",
                                          e.target.value
                                        )
                                      }
                                      className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            {(newPropertyData.owners?.length ?? 1) < 3 ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full bg-white"
                                onClick={addOwnerDraft}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar proprietário
                              </Button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Botao de Criar */}
                    <Button
                      onClick={handleProceedToPhotoStep}
                      className="mt-2 w-full rounded-full bg-emerald-700 py-3 text-sm text-white shadow-[0_18px_40px_-28px_rgba(4,120,87,0.75)] transition-all hover:bg-emerald-800 sm:mt-4 sm:text-base"
                    >
                      Adicionar Fotos
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>

          {/* Filtros */}
          <Card className="mb-8 rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardContent className="p-6 md:p-7">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
                  <SlidersHorizontal className="h-5 w-5" />
                  Filtros
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="rounded-full md:hidden"
                >
                  {showFilters ? "Ocultar" : "Mostrar"}
                </Button>
              </div>

              <div
                className={`grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-12 ${showFilters ? "" : "hidden md:grid"}`}
              >
                <div className="space-y-1.5 xl:col-span-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={filters.tipo}
                    onValueChange={value =>
                      setFilters({ ...filters, tipo: value })
                    }
                  >
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
                  <Select
                    value={filters.finalidade}
                    onValueChange={value =>
                      setFilters({ ...filters, finalidade: value })
                    }
                  >
                    <SelectTrigger id="finalidade" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FINALIDADES.map(finalidade => (
                        <SelectItem
                          key={finalidade.value}
                          value={finalidade.value}
                        >
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
                    onChange={e =>
                      setFilters({ ...filters, cidade: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5 xl:col-span-4">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    className="h-11"
                    id="bairro"
                    placeholder="Ex: Centro"
                    value={filters.bairro}
                    onChange={e =>
                      setFilters({ ...filters, bairro: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5 xl:col-span-3">
                  <Label htmlFor="valorMin">Valor Mínimo</Label>
                  <MoneyInput
                    className="h-11"
                    id="valorMin"
                    value={filters.valorMin}
                    onValueChange={value =>
                      setFilters({ ...filters, valorMin: value })
                    }
                  />
                </div>

                <div className="space-y-1.5 xl:col-span-3">
                  <Label htmlFor="valorMax">Valor Máximo</Label>
                  <MoneyInput
                    className="h-11"
                    id="valorMax"
                    value={filters.valorMax}
                    onValueChange={value =>
                      setFilters({ ...filters, valorMax: value })
                    }
                  />
                </div>

                <div className="space-y-1.5 xl:col-span-2">
                  <Label htmlFor="quartos-filtro">Quartos</Label>
                  <Select
                    value={filters.quartos}
                    onValueChange={value =>
                      setFilters({ ...filters, quartos: value })
                    }
                  >
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
                  <Select
                    value={filters.banheiros}
                    onValueChange={value =>
                      setFilters({ ...filters, banheiros: value })
                    }
                  >
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
                  <Select
                    value={filters.vagas}
                    onValueChange={value =>
                      setFilters({ ...filters, vagas: value })
                    }
                  >
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

              <div
                className={`relative mt-4 ${showFilters ? "" : "hidden md:block"}`}
              >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={event =>
                    setFilters({ ...filters, search: event.target.value })
                  }
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
                  onClick={() =>
                    setFilters({
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
                    })
                  }
                  className="mt-4 rounded-full border-slate-200 bg-white"
                >
                  Limpar Filtros
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Resultados */}
          <div className="mb-5 text-sm text-slate-600">
            {imoveisFiltrados?.length || 0}{" "}
            {imoveisFiltrados?.length === 1
              ? "imóvel encontrado"
              : "imóveis encontrados"}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card
                  key={i}
                  className="overflow-hidden rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]"
                >
                  <div className="h-56 bg-muted animate-pulse" />
                  <CardContent className="p-5">
                    <div className="mb-3 h-4 rounded bg-muted animate-pulse" />
                    <div className="mb-5 h-3 w-2/3 rounded bg-muted animate-pulse" />
                    <div className="h-8 w-28 rounded bg-muted animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : imoveisFiltrados && imoveisFiltrados.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {imoveisFiltrados.map(imovel => {
                const fotos = imovel.fotos ? JSON.parse(imovel.fotos) : [];
                const primeiraFoto = fotos[0] || "/placeholder-property.jpg";
                const propertyCard = (
                  <Card className="h-full cursor-pointer overflow-hidden rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-42px_rgba(15,23,42,0.52)]">
                    <div className="relative h-56 overflow-hidden">
                      <ProtectedPropertyImage
                        src={primeiraFoto}
                        variant="thumb"
                        alt={imovel.titulo}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-slate-950/80 px-3 py-1 text-sm font-semibold text-white backdrop-blur">
                        {imovel.finalidade === "venda"
                          ? "Venda"
                          : imovel.finalidade === "locacao"
                            ? "Locação"
                            : "Venda/Locação"}
                      </div>
                      {imovel.destaque === 1 && (
                        <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-amber-500/90 px-3 py-1 text-sm font-semibold text-white backdrop-blur">
                          Destaque
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <h3 className="mb-2 line-clamp-1 text-lg font-semibold text-slate-950">
                        {imovel.titulo}
                      </h3>
                      <div className="mb-4 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {imovel.bairro ? `${imovel.bairro}, ` : ""}
                          {imovel.cidade}, {imovel.estado}
                        </span>
                      </div>
                      <div className="mb-5 flex items-center gap-4 text-sm text-slate-600">
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
                      <div className="text-2xl font-semibold tracking-tight text-emerald-800">
                        {formatMoneyFromCentsValue(
                          imovel.valorLocacao || imovel.valor
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );

                return isRentalProposalSelectionMode ? (
                  <button
                    key={imovel.id}
                    type="button"
                    className="block h-full text-left"
                    onClick={() => setSelectedRentalProperty(imovel)}
                  >
                    {propertyCard}
                  </button>
                ) : (
                  <Link key={imovel.id} href={`/imoveis/${imovel.id}`}>
                    {propertyCard}
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="rounded-[32px] border-white/70 bg-white/90 p-12 text-center shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <Search className="mx-auto mb-4 h-12 w-12 text-slate-400" />
              <h3 className="mb-2 text-lg font-semibold text-slate-950">
                Nenhum imóvel encontrado
              </h3>
              <p className="mb-4 text-slate-500">
                Tente ajustar os filtros para encontrar mais resultados
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
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
                  })
                }
                className="rounded-full border-slate-200 bg-white"
              >
                Limpar Filtros
              </Button>
            </Card>
          )}

          <Dialog
            open={selectedRentalProperty !== null}
            onOpenChange={open => !open && setSelectedRentalProperty(null)}
          >
            <DialogContent className="!w-[460px] !max-w-[calc(100%-2rem)] rounded-[24px] border-white/80 bg-[#f7f6f2] p-4 sm:!max-w-[460px] sm:p-5">
              {pendingProposalForSelected ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Imóvel já possui proposta de locação</DialogTitle>
                    <DialogDescription>
                      O imóvel
                      {selectedRentalProperty ? ` "${selectedRentalProperty.titulo}"` : ""} já
                      está vinculado a uma proposta de locação ou rascunho pendente
                      {pendingProposalForSelected.referenceCode
                        ? ` (${pendingProposalForSelected.referenceCode})`
                        : ""}
                      . Não é possível iniciar outra proposta para o mesmo imóvel enquanto ela não for finalizada ou cancelada.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full bg-white"
                      onClick={() => setSelectedRentalProperty(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                      onClick={() => {
                        setLocation(
                          `/admin/modulos/locacoes/propostas/${pendingProposalForSelected.id}`
                        );
                      }}
                    >
                      Visualizar proposta
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Selecionar imóvel para locação?</DialogTitle>
                    <DialogDescription>
                      {selectedRentalProperty
                        ? `Deseja selecionar o imóvel "${selectedRentalProperty.titulo}" para iniciar a proposta de locação?`
                        : "Confirme o imóvel selecionado para iniciar a proposta de locação."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full bg-white"
                      onClick={() => setSelectedRentalProperty(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                      disabled={checkingPendingProposal}
                      onClick={() => {
                        if (!selectedRentalProperty) return;
                        setLocation(
                          `/admin/modulos/locacoes/nova?propertyId=${selectedRentalProperty.id}`
                        );
                      }}
                    >
                      {checkingPendingProposal ? "Verificando..." : "Confirmar seleção"}
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
}
