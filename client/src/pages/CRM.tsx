import { useState } from "react";
import Layout from "@/components/Layout";
import { useEffect } from "react";
import { useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCpf, isValidCpf } from "@/lib/cpf";
import { trpc } from "@/lib/trpc";
import { Users, Plus, Phone, Mail, MessageSquare, FileText, Search, User, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

/**
 * Página de CRM
 * 
 * Sistema de gestão de leads com pipeline para corretores e administrativos.
 * 
 * EDIÇÃO:
 * - Para modificar os status do pipeline: edite LEAD_STATUS_OPTIONS
 * - Para alterar filtros/cores dos cards: edite LEAD_FILTER_OPTIONS
 */

// ========== ÁREA DE EDIÇÃO - PIPELINE ==========
const LEAD_STATUS_OPTIONS = [
  { value: "novo", label: "Novos Leads", color: "bg-blue-100 text-blue-700" },
  { value: "atendimento", label: "Em Atendimento", color: "bg-purple-100 text-purple-700" },
  { value: "proposta", label: "Proposta", color: "bg-yellow-100 text-yellow-700" },
  { value: "negociacao", label: "Negociação", color: "bg-orange-100 text-orange-700" },
  { value: "fechado", label: "Fechado", color: "bg-green-100 text-green-700" },
  { value: "perdidos", label: "Perdidos", color: "bg-red-100 text-red-700" },
];
const LEAD_FILTER_OPTIONS = [
  { value: "todos", label: "Todos os Leads", color: "bg-emerald-100 text-emerald-700" },
  ...LEAD_STATUS_OPTIONS,
];

const MANUAL_ORIGIN_OPTIONS = [
  { value: "indicacao", label: "Indicação" },
  { value: "cliente_presencial", label: "Cliente Presencial" },
  { value: "outros", label: "Outros" },
];
// ========== FIM DA ÁREA DE EDIÇÃO ==========

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";
const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";
const BUSINESS_TIMEZONE = "America/Sao_Paulo";
const ASSIGNMENT_TIMEOUT_MINUTES = 15;
const ATTENDANCE_TIMEOUT_MINUTES = 40;

function formatDateTime(date: Date | string | null) {
  if (!date) return "Data não disponível";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Data inválida";
  }

  return (
    parsedDate.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }) +
    " às " +
    parsedDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    })
  );
}

function getLeadOriginLabel(origin: string | null | undefined) {
  switch (origin) {
    case "site":
      return "Site";
    case "whatsapp":
      return "WhatsApp";
    case "trafego_pago":
      return "Tráfego Pago";
    case "indicacao":
      return "Cadastro manual • Indicação";
    case "cliente_presencial":
      return "Cadastro manual • Cliente Presencial";
    case "outros":
      return "Cadastro manual • Outros";
    case "manual":
      return "Cadastro manual";
    default:
      return origin?.trim() || "Não informada";
  }
}

function getAgeFromBirthDate(value: Date | string | null | undefined) {
  if (!value) return null;

  let birthDate: Date | null = null;

  if (value instanceof Date) {
    birthDate = Number.isNaN(value.getTime()) ? null : value;
  } else if (typeof value === "string") {
    const rawValue = value.trim();
    const isoDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const brDateMatch = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      birthDate = new Date(Number(year), Number(month) - 1, Number(day));
    } else if (brDateMatch) {
      const [, day, month, year] = brDateMatch;
      birthDate = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      const parsedDate = new Date(rawValue);
      birthDate = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
  }

  if (!birthDate) {
    return null;
  }

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function getSaoPauloWeekdayAndTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find(part => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? "0");

  return { weekday, hour, minute };
}

function isBusinessTime(date: Date) {
  const { weekday, hour, minute } = getSaoPauloWeekdayAndTime(date);
  const totalMinutes = hour * 60 + minute;

  if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday)) {
    return totalMinutes >= 9 * 60 && totalMinutes < 18 * 60;
  }

  if (weekday === "Sat") {
    return totalMinutes >= 9 * 60 && totalMinutes < 13 * 60;
  }

  return false;
}

function findNextBusinessMinute(fromDate: Date) {
  const cursor = new Date(fromDate.getTime());
  for (let i = 0; i < 60 * 24 * 10; i += 1) {
    if (isBusinessTime(cursor)) return cursor;
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }
  return cursor;
}

function addBusinessMinutes(startDate: Date, minutes: number) {
  const cursor = isBusinessTime(startDate)
    ? new Date(startDate.getTime())
    : findNextBusinessMinute(startDate);

  let remaining = Math.max(0, minutes);
  while (remaining > 0) {
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
    if (isBusinessTime(cursor)) {
      remaining -= 1;
    }
  }

  return cursor;
}

function businessMinutesUntil(fromDate: Date, toDate: Date) {
  if (fromDate >= toDate) return 0;

  const cursor = new Date(fromDate.getTime());
  let minutes = 0;

  for (let i = 0; i < 60 * 24 * 10; i += 1) {
    if (cursor >= toDate) break;
    if (isBusinessTime(cursor)) minutes += 1;
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }

  return minutes;
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLeadTimeStatus(
  lead: {
    status: string;
    idResponsavel: number | null;
    createdAt?: Date | string | null;
    assignmentCycleStartedAt?: Date | string | null;
    assignedAt?: Date | string | null;
    attendedAt?: Date | string | null;
  },
  now: Date
) {
  if (lead.status === "fechado" || lead.status === "perdidos") {
    return { label: "Encerrado", className: "bg-slate-100 text-slate-600" };
  }

  if (lead.status === "atendimento" || lead.attendedAt) {
    return { label: "Atendido", className: "bg-emerald-100 text-emerald-700" };
  }

  if (!lead.idResponsavel) {
    const baseDate = toDate(lead.assignmentCycleStartedAt) ?? toDate(lead.createdAt) ?? now;
    const deadline = addBusinessMinutes(baseDate, ASSIGNMENT_TIMEOUT_MINUTES);

    if (now >= deadline) {
      return { label: "Atrasado", className: "bg-rose-100 text-rose-700" };
    }

    if (!isBusinessTime(now)) {
      return { label: "Pausado", className: "bg-slate-100 text-slate-600" };
    }

    const minutesLeft = businessMinutesUntil(now, deadline);
    return { label: `Direcionar ${minutesLeft} min`, className: "bg-amber-100 text-amber-700" };
  }

  const baseDate =
    toDate(lead.assignedAt) ??
    toDate(lead.assignmentCycleStartedAt) ??
    toDate(lead.createdAt) ??
    now;
  const deadline = addBusinessMinutes(baseDate, ATTENDANCE_TIMEOUT_MINUTES);

  if (now >= deadline) {
    return { label: "Atrasado", className: "bg-rose-100 text-rose-700" };
  }

  if (!isBusinessTime(now)) {
    return { label: "Pausado", className: "bg-slate-100 text-slate-600" };
  }

  const minutesLeft = businessMinutesUntil(now, deadline);
  return { label: `Atender ${minutesLeft} min`, className: "bg-sky-100 text-sky-700" };
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildLeadSearchText(lead: {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: string;
  origem: string | null;
  idResponsavel: number | null;
  createdAt: string | Date | null;
}) {
  const values = [
    String(lead.id),
    lead.nome,
    lead.email ?? "",
    lead.telefone ?? "",
    lead.status,
    getLeadOriginLabel(lead.origem),
    lead.idResponsavel ? `id ${lead.idResponsavel}` : "",
    lead.createdAt ? formatDateTime(lead.createdAt) : "",
  ];

  return normalizeSearchValue(values.join(" "));
}

export default function CRM() {
  const { user, loading, isAuthenticated } = useAuth();
  const [clockNow, setClockNow] = useState(() => new Date());
  const [statusSelected, setStatusSelected] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [leadDetailsOpen, setLeadDetailsOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isInteractionsCollapsed, setIsInteractionsCollapsed] = useState(true);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(true);
  const [isFilesCollapsed, setIsFilesCollapsed] = useState(true);

  const [newLeadData, setNewLeadData] = useState({
    nome: "",
    email: "",
    cpf: "",
    telefone: "",
    origem: "",
    interesse: "",
    observacao: "",
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(new Date());
    }, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (leadDetailsOpen) {
      setIsInteractionsCollapsed(true);
      setIsNotesCollapsed(true);
      setIsFilesCollapsed(true);
    }
  }, [leadDetailsOpen, selectedLead?.id]);

  const { data: leads, isLoading, refetch } = trpc.leads.list.useQuery(
    undefined,
    { enabled: isAuthenticated && (user?.role === "corretor" || user?.role === "administrativo") }
  );
  const { data: users } = trpc.admin.users.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
  });

  // Filtrar leads pelo status selecionado
  const leadsFiltrados =
    leads?.filter(lead => (statusSelected === "todos" ? true : lead.status === statusSelected)) || [];
  const showLeadTimeColumn = statusSelected === "todos";
  const normalizedSearchTerm = normalizeSearchValue(searchTerm.trim());
  const corretoresAtivos = useMemo(
    () => users?.filter(candidate => candidate.role === "corretor" && candidate.isActive === 1) || [],
    [users]
  );
  const usersById = useMemo(() => new Map((users ?? []).map(current => [current.id, current])), [users]);
  const leadsFiltradosBuscaPorStatus = useMemo(() => {
    if (!normalizedSearchTerm) return leadsFiltrados;

    return leadsFiltrados.filter(lead => buildLeadSearchText(lead).includes(normalizedSearchTerm));
  }, [leadsFiltrados, normalizedSearchTerm]);


  const { data: notes, refetch: refetchNotes } = trpc.leads.getNotes.useQuery(
    { idLead: selectedLead?.id },
    { enabled: !!selectedLead }
  );

  const { data: files } = trpc.leads.getFiles.useQuery(
    { idLead: selectedLead?.id },
    { enabled: !!selectedLead }
  );
  const { data: interactions, isLoading: loadingInteractions } = trpc.leads.getInteractions.useQuery(
    { idLead: selectedLead?.id },
    { enabled: !!selectedLead }
  );

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead criado com sucesso!");
      refetch();
      setNewLeadOpen(false);
      setNewLeadData({ nome: "", email: "", cpf: "", telefone: "", origem: "", interesse: "", observacao: "" });
    },
    onError: () => {
      toast.error("Erro ao criar lead");
    },
  });

  // Regra que formata telefone conforme o usuário digita
  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  };

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Lead atualizado!");
      refetch();
    },
    onError: error => {
      toast.error(error.message || "Erro ao atualizar lead");
    },
  });

  const addNote = trpc.leads.addNote.useMutation({
    onSuccess: () => {
      toast.success("Anotação adicionada!");
      refetchNotes();
      setNewNote("");
    },
    onError: () => {
      toast.error("Erro ao adicionar anotação");
    },
  });

  const assignLead = trpc.leads.assign.useMutation({
    onSuccess: () => {
      toast.success("Lead atribuído com sucesso!");
      refetch();
    },
    onError: () => {
      toast.error("Erro ao atribuir lead");
    },
  });

  // Regra que valida o email digitado antes de cadastrar o lead
  const isValidEmail = (v: string) => 
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // Mensagem informando que os campos estão vazios ao tentar cadastrar um lead
  const handleCreateLead = () => {
    if (!newLeadData.nome || !newLeadData.email) {
      toast.error("Preencha nome e email");
      return;
    }

    if (!isValidEmail(newLeadData.email)) {
      toast.error("E-mail inválido");
      return;
    }

    if (newLeadData.cpf && !isValidCpf(newLeadData.cpf)) {
      toast.error("CPF inválido. Confira os dígitos informados.");
      return;
    }

    // Formata o nome digitado
    const formattedData = {
      ...newLeadData,
      nome: newLeadData.nome
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    };

    // Envia os dados formatados corretamente para o backend.
    createLead.mutate(formattedData);
  };

  const handleStatusChange = (leadId: number, newStatus: string) => {
    if (!selectedLead?.idResponsavel) {
      toast.warning("Direcione o lead para um responsável antes de alterar o status.");
      return;
    }

    updateLead.mutate(
      { id: leadId, status: newStatus },
      {
        onSuccess: () => {
          refetch();
          
          // Delay ao fechar o dialog para uma sensação melhor de usabilidade.
          setTimeout(() => {
            setLeadDetailsOpen(false);
            setSelectedLead(null); // Limpa o lead selecionado também.
          }, 350);
        },
        onError: () => {
          toast.error("Erro ao atualizar status");
        },
      }
    );
  };

  // Mensagem informando que não é possível adicionar anotação vazia nos detalhes do lead
  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.warning("Digite algo antes de adicionar.");
      return;
    }

    addNote.mutate({ idLead: selectedLead.id, anotacao: newNote });
  };

  const selectedLeadLinkedUser = useMemo(() => {
    if (!selectedLead?.userId) return null;
    return usersById.get(selectedLead.userId) ?? null;
  }, [selectedLead?.userId, usersById]);

  const selectedLeadAge = useMemo(
    () => getAgeFromBirthDate(selectedLead?.birthDate ?? selectedLead?.userBirthDate ?? selectedLeadLinkedUser?.birthDate),
    [selectedLead?.birthDate, selectedLead?.userBirthDate, selectedLeadLinkedUser?.birthDate]
  );

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
            Você precisa estar autenticado para acessar o CRM.
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
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
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
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
      <div className="container py-8 md:py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Gestão de Leads</h1>
            <p className="mt-2 text-slate-600">
              Gerencie seus leads e acompanhe o funil de vendas
            </p>
          </div>
          <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                Novo Lead
              </Button>
            </DialogTrigger>

            <DialogContent
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6"
              onOpenAutoFocus={event => event.preventDefault()}
            >
              <DialogHeader className="space-y-3 pb-2">
                <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">Cadastrar Novo Lead</DialogTitle>
                  <DialogDescription className="text-slate-600">
                  Preencha as informações do lead.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    className={FIELD_CLASS}
                    value={newLeadData.nome}
                    maxLength={40}
                    onChange={event => setNewLeadData({ ...newLeadData, nome: event.target.value })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      className={FIELD_CLASS}
                      value={newLeadData.email}
                      maxLength={35}
                      onChange={event => setNewLeadData({ ...newLeadData, email: event.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      className={FIELD_CLASS}
                      value={newLeadData.telefone}
                      onChange={event =>
                        setNewLeadData({ ...newLeadData, telefone: formatPhone(event.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      className={FIELD_CLASS}
                      value={newLeadData.cpf}
                      inputMode="numeric"
                      maxLength={14}
                      onChange={event =>
                        setNewLeadData({ ...newLeadData, cpf: formatCpf(event.target.value) })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="origem">Origem</Label>
                    <Select
                      value={newLeadData.origem}
                      onValueChange={value => setNewLeadData({ ...newLeadData, origem: value })}
                    >
                      <SelectTrigger id="origem" className={FIELD_CLASS}>
                        <SelectValue placeholder="Selecione a origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_ORIGIN_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interesse">Interesse</Label>
                  <Select
                    value={newLeadData.interesse}
                    onValueChange={value => setNewLeadData({ ...newLeadData, interesse: value })}
                  >
                    <SelectTrigger id="interesse" className={FIELD_CLASS}>
                      <SelectValue placeholder="Selecione o interesse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Locação">Locação</SelectItem>
                      <SelectItem value="Aquisição Imóvel na Planta">Aquisição Imóvel na Planta</SelectItem>
                      <SelectItem value="Aquisição de Imóvel">Aquisição de Imóvel</SelectItem>
                      <SelectItem value="Avaliação de Imóvel">Avaliação de Imóvel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacao">Observação</Label>
                  <Textarea
                    id="observacao"
                    maxLength={400}
                    className={`${FIELD_CLASS} resize-none`}
                    value={newLeadData.observacao}
                    onChange={event => setNewLeadData({ ...newLeadData, observacao: event.target.value })}
                    rows={4}
                  />
                </div>

                <Button onClick={handleCreateLead} className="w-full rounded-full bg-emerald-700 text-white shadow-[0_18px_40px_-28px_rgba(4,120,87,0.75)] hover:bg-emerald-800" disabled={createLead.isPending}>
                  {createLead.isPending ? "Criando..." : "Criar Lead"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
          {LEAD_FILTER_OPTIONS.map((status) => {
            const qtdLeads =
              status.value === "todos"
                ? leads?.length || 0
                : leads?.filter(l => l.status === status.value).length || 0;
            const isSelected = statusSelected === status.value;

            return (
              <Card
                key={status.value}
                className={`min-h-[124px] cursor-pointer rounded-[28px] border-white/70 bg-white/90 transition-all hover:shadow-[0_30px_90px_-42px_rgba(15,23,42,0.52)] ${
                  isSelected
                    ? "ring-2 ring-emerald-700/35 shadow-[0_30px_90px_-42px_rgba(15,23,42,0.52)]"
                    : "shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]"
                }`}
                onClick={() => setStatusSelected(status.value)}
              >
                <CardContent className="flex h-full items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${status.color}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-600">
                        {status.label}
                      </p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                        {qtdLeads}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {user?.role === "administrativo" ? (
          <Card className={`${SURFACE_CARD_CLASS} mb-8`}>
            <CardHeader>
              <CardTitle className="text-slate-950">
                {LEAD_FILTER_OPTIONS.find(s => s.value === statusSelected)?.label}
              </CardTitle>
              <CardDescription className="text-slate-600">
                {leadsFiltradosBuscaPorStatus.length} lead(s) encontrado(s) para o status selecionado
              </CardDescription>
              <div className="relative mt-2 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Pesquisar leads"
                  className={`${FIELD_CLASS} pl-9`}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(item => (
                    <div key={item} className="h-16 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : leadsFiltradosBuscaPorStatus.length > 0 ? (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        {showLeadTimeColumn ? <TableHead>Tempo</TableHead> : null}
                        <TableHead>Origem</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Cadastro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsFiltradosBuscaPorStatus.map(lead => {
                        const responsibleValue = lead.idResponsavel ? String(lead.idResponsavel) : "unassigned";
                        const missingResponsible =
                          lead.idResponsavel !== null &&
                          !corretoresAtivos.some(corretor => corretor.id === lead.idResponsavel);
                        const missingResponsibleLabel = lead.idResponsavel
                          ? usersById.get(lead.idResponsavel)?.name ||
                            usersById.get(lead.idResponsavel)?.email ||
                            `Corretor #${lead.idResponsavel}`
                          : null;
                        const leadTimeStatus = getLeadTimeStatus(lead, clockNow);
                        const leadCreatedAtTooltip = `Lead criado em ${formatDateTime(lead.createdAt)}`;

                        return (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">
                              <button
                                type="button"
                                className="text-left text-slate-950 hover:text-emerald-700 hover:underline"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setLeadDetailsOpen(true);
                                }}
                              >
                                {lead.nome}
                              </button>
                            </TableCell>
                            <TableCell>{lead.email || "—"}</TableCell>
                            <TableCell>{lead.telefone || "—"}</TableCell>
                            <TableCell>
                              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">
                                {lead.status}
                              </span>
                            </TableCell>
                            {showLeadTimeColumn ? (
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/35"
                                      title={leadCreatedAtTooltip}
                                    >
                                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${leadTimeStatus.className}`}>
                                        {leadTimeStatus.label}
                                      </span>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={6}>
                                    {leadCreatedAtTooltip}
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            ) : null}
                            <TableCell className="capitalize">{getLeadOriginLabel(lead.origem)}</TableCell>
                            <TableCell>
                              <Select
                                value={responsibleValue}
                                onValueChange={value =>
                                  assignLead.mutate({
                                    leadId: lead.id,
                                    userId: value === "unassigned" ? null : Number(value),
                                  })
                                }
                              >
                                <SelectTrigger className={`${FIELD_CLASS} w-44`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                                  {corretoresAtivos.map(corretor => (
                                    <SelectItem key={corretor.id} value={String(corretor.id)}>
                                      {corretor.name || corretor.email || `Corretor #${corretor.id}`}
                                    </SelectItem>
                                  ))}
                                  {missingResponsible && missingResponsibleLabel ? (
                                    <SelectItem value={String(lead.idResponsavel)}>{missingResponsibleLabel}</SelectItem>
                                  ) : null}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{formatDateTime(lead.createdAt)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Users className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                  <p className="text-slate-600">
                    {searchTerm ? "Nenhum lead encontrado para essa pesquisa neste status" : "Nenhum lead neste status"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {user?.role !== "administrativo" ? (
          <>
            {/* Pipeline */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-64 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
                <Card className={SURFACE_CARD_CLASS}>
                    <CardHeader>
                      <CardTitle className="text-slate-950">
                        {LEAD_FILTER_OPTIONS.find(s => s.value === statusSelected)?.label}
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        {leadsFiltrados.length} lead(s) encontrado(s) 
                      </CardDescription>
                    </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8">
                        <p className="text-slate-600">Carregando leads...</p>
                      </div>
                    ) : leadsFiltrados.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-600">Nenhum lead neste status</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leadsFiltrados.map((lead) => (
                          <div
                            key={lead.id}
                            className="cursor-pointer rounded-2xl border border-slate-200 bg-white/80 p-4 transition-colors hover:bg-white"
                            onClick={() => {
                              setSelectedLead(lead);
                              setLeadDetailsOpen(true);
                            }}
                          >
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-950">{lead.nome}</h3>
                              <div className="mt-2 flex gap-4 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {lead.telefone}
                                </span>

                                {lead.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {lead.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
            )}
          </>
        ) : null}

        {/* DIALOG DETALHES DO LEAD */}
        <Dialog open={leadDetailsOpen} onOpenChange={setLeadDetailsOpen}>
          <DialogContent className="max-h-[95vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-lg sm:p-6 lg:max-w-[40%]">
            {selectedLead && (
              <>
                <DialogHeader className="max-w-3xl space-y-3 pb-2">
                  <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">{selectedLead.nome}</DialogTitle>
                  <DialogDescription className="text-slate-600">
                    Lead #{selectedLead.id} • Criado em {
                      selectedLead.createdAt
                        ? formatDateTime(selectedLead.createdAt)
                        : "Data não disponível"
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Informações */}
                  <Card className="rounded-[28px] border-white/80 bg-white/90 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                    <CardHeader>
                      <CardTitle className="text-lg text-slate-950">Informações</CardTitle>
                      <p className="text-sm text-slate-600">
                        CPF: {selectedLead.cpf ? formatCpf(selectedLead.cpf) : "Não informado"} • Idade:{" "}
                        {selectedLeadAge !== null ? `${selectedLeadAge} anos` : "Não informada"}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        {selectedLead.email && (
                          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                            <Label>E-mail</Label>
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                              <Mail className="h-4 w-4 text-slate-500" />
                              {selectedLead.email}
                            </p>
                          </div>
                        )}
                        {selectedLead.telefone && (
                          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                            <Label>Telefone</Label>
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                              <Phone className="h-4 w-4 text-slate-500" />
                              {selectedLead.telefone}
                            </p>
                          </div>
                        )}
                        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                          <Label>Origem</Label>
                          <p className="mt-1 text-sm text-slate-600">
                            {getLeadOriginLabel(selectedLead.origem)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={selectedLead.status}
                            disabled={!selectedLead.idResponsavel}
                            onValueChange={(value) => handleStatusChange(selectedLead.id, value) }
                          >
                              <SelectTrigger className={FIELD_CLASS}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                              {LEAD_STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                              </SelectContent>
                          </Select>
                          {!selectedLead.idResponsavel ? (
                            <p className="text-xs text-amber-700">
                              Direcione para um responsável antes de alterar o status.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {(selectedLead.interesse || selectedLead.idImovel) ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label>Interesse</Label>
                            <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                              {selectedLead.interesse}
                            </p>
                          </div>
                          <div>
                            <Label>Referência do Último Imóvel</Label>
                            {selectedLead.idImovel ? (
                              <p className="mt-1 text-sm text-slate-600">
                                <a
                                  href={`/imoveis/${selectedLead.idImovel}`}
                                  className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline md:hidden"
                                >
                                  Código do imóvel #{selectedLead.idImovel}
                                </a>
                                <a
                                  href={`/imoveis/${selectedLead.idImovel}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hidden font-medium text-emerald-700 hover:text-emerald-800 hover:underline md:inline"
                                >
                                  Código do imóvel #{selectedLead.idImovel}
                                </a>
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-slate-500">Não informada</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                      {selectedLead.observacao ? (
                        <div>
                          <Label>Observações do Usuário</Label>
                          <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                            {selectedLead.observacao}
                          </p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Histórico de Interações */}
                  <Card className="rounded-[28px] border-white/80 bg-white/90 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-950">
                        <MessageSquare className="h-5 w-5" />
                        Histórico de Interações
                      </CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setIsInteractionsCollapsed(value => !value)}
                      >
                        {isInteractionsCollapsed ? (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Expandir
                          </>
                        ) : (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Minimizar
                          </>
                        )}
                      </Button>
                    </CardHeader>
                    {isInteractionsCollapsed ? null : (
                      <CardContent>
                        {loadingInteractions ? (
                          <p className="py-2 text-sm text-slate-600">Carregando histórico...</p>
                        ) : interactions && interactions.length > 0 ? (
                          <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-hidden">
                            {interactions.map(interaction => (
                              <div
                                key={interaction.id}
                                className="rounded-2xl border border-slate-200 bg-white/85 px-3 py-2"
                              >
                                <p className="text-sm text-slate-800">{interaction.message}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatDateTime(interaction.createdAt)}
                                  {interaction.idUsuario ? ` • Usuário #${interaction.idUsuario}` : " • Sistema"}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="py-2 text-sm text-slate-600">Nenhuma interação registrada.</p>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Anotações */}
                  <Card className="rounded-[28px] border-white/80 bg-white/90 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-950">
                        <MessageSquare className="h-5 w-5" />
                        Anotações
                      </CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setIsNotesCollapsed(value => !value)}
                      >
                        {isNotesCollapsed ? (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Expandir
                          </>
                        ) : (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Minimizar
                          </>
                        )}
                      </Button>
                    </CardHeader>
                    {isNotesCollapsed ? null : (
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Textarea
                            className={`${FIELD_CLASS} break-all`}
                            placeholder="Adicionar nova anotação..."
                            maxLength={500}
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            rows={3}
                          />
                          <Button className="mt-2 rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={handleAddNote} size="sm" disabled={addNote.isPending}>
                            Adicionar Anotação
                          </Button>
                        </div>

                        {notes && notes.length > 0 ? (
                          <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hidden">
                            {notes.map((note) => (
                              <Card key={note.id} className="break-all rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
                                <CardContent className="p-3">
                                  <p className="text-sm whitespace-pre-line">{note.anotacao}</p>
                                  <p className="mt-4 text-xs text-slate-500">
                                    {formatDateTime(note.createdAt)}
                                  </p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="py-4 text-center text-sm text-slate-600">
                            Nenhuma anotação ainda
                          </p>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Arquivos */}
                  <Card className="rounded-[28px] border-white/80 bg-white/90 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-950">
                        <FileText className="h-5 w-5" />
                        Arquivos
                      </CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setIsFilesCollapsed(value => !value)}
                      >
                        {isFilesCollapsed ? (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Expandir
                          </>
                        ) : (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Minimizar
                          </>
                        )}
                      </Button>
                    </CardHeader>
                    {isFilesCollapsed ? null : (
                      <CardContent>
                        {files && files.length > 0 ? (
                          <div className="space-y-2">
                            {files.map((file) => (
                              <Card key={file.id} className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
                                <CardContent className="p-3 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">{file.nomeArquivo}</p>
                                    <p className="text-xs text-slate-500">
                                      {formatDateTime(file.createdAt)}
                                    </p>
                                  </div>
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={file.urlArquivo} target="_blank" rel="noopener noreferrer">
                                      Ver
                                    </a>
                                  </Button>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="py-4 text-center text-sm text-slate-600">
                            Nenhum arquivo anexado
                          </p>
                        )}
                      </CardContent>
                    )}
                  </Card>
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



