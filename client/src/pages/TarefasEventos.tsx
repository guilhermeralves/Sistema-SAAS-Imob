import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatStoredDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  PlayCircle,
  Plus,
  Search,
  Shield,
  User,
} from "lucide-react";
import { toast } from "sonner";

type RouterOutput = inferRouterOutputs<AppRouter>;
type TaskItem = RouterOutput["tasks"]["list"][number];
type TaskUser = RouterOutput["tasks"]["users"][number];
type TaskNote = RouterOutput["tasks"]["notes"][number];
type TaskTemplate = RouterOutput["tasks"]["templates"][number];

type TaskKind = "tarefa" | "evento";
type TaskSector = "administrativo" | "financeiro" | "atendimento" | "comercial" | "juridico";
type TaskFormStatus = "pendente" | "em_andamento" | "concluida";
type TaskComputedStatus = "pendente" | "em_andamento" | "atrasado" | "concluida";
type ViewMode = "todos" | "minhas";
type KindFilter = "todos" | TaskKind;

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";
const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

const STATUS_LABELS: Record<TaskComputedStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  atrasado: "Atrasado",
  concluida: "Concluida",
};

const KIND_LABELS: Record<TaskKind, string> = {
  tarefa: "Tarefa",
  evento: "Evento",
};

const SECTOR_LABELS: Record<TaskSector, string> = {
  administrativo: "Administrativo",
  financeiro: "Financeiro",
  atendimento: "Atendimento",
  comercial: "Comercial",
  juridico: "Juridico",
};

const SECTOR_OPTIONS: Array<{ value: TaskSector; label: string }> = [
  { value: "administrativo", label: "Administrativo" },
  { value: "financeiro", label: "Financeiro" },
  { value: "atendimento", label: "Atendimento" },
  { value: "comercial", label: "Comercial" },
  { value: "juridico", label: "Juridico" },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;
const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createMonthGrid(baseMonth: Date) {
  const firstDayOfMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
  const startWeekday = firstDayOfMonth.getDay();
  const gridStart = new Date(firstDayOfMonth);
  gridStart.setDate(firstDayOfMonth.getDate() - startWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      key: toDateKey(date),
      inCurrentMonth: date.getMonth() === baseMonth.getMonth(),
    };
  });
}

function getFilterButtonClassName(isActive: boolean) {
  return cn(
    "rounded-full border px-4 py-2 text-sm font-medium transition-all",
    isActive
      ? "border-emerald-700 bg-emerald-700 text-white shadow-[0_14px_30px_-22px_rgba(4,120,87,0.85)] hover:bg-emerald-800"
      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40 hover:text-emerald-800"
  );
}

type TaskFormState = {
  title: string;
  kind: TaskKind;
  sector: TaskSector;
  dueAt: string;
  description: string;
  status: TaskFormStatus;
  assigneeIds: number[];
};

const EMPTY_TASK_FORM: TaskFormState = {
  title: "",
  kind: "tarefa",
  sector: "administrativo",
  dueAt: "",
  description: "",
  status: "pendente",
  assigneeIds: [],
};

type TaskTemplateFormState = {
  name: string;
  kind: TaskKind;
  sector: TaskSector;
  defaultTitle: string;
  defaultDescription: string;
};

const EMPTY_TASK_TEMPLATE_FORM: TaskTemplateFormState = {
  name: "",
  kind: "tarefa",
  sector: "administrativo",
  defaultTitle: "",
  defaultDescription: "",
};

function toDateTimeLocalValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const hours = String(parsedDate.getHours()).padStart(2, "0");
  const minutes = String(parsedDate.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getUserDisplayName(user: TaskUser) {
  return user.name?.trim() || user.email || `Usuario #${user.id}`;
}

function getUserInitials(user: { name: string | null; email: string | null; id: number }) {
  const source = user.name?.trim() || user.email || `U${user.id}`;
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function taskMatchesSearch(task: TaskItem, normalizedTerm: string) {
  if (!normalizedTerm) return true;
  const chunks = [
    task.id,
    task.title,
    task.description || "",
    task.createdBy?.name || "",
    task.createdBy?.email || "",
    task.assignees.map(assignee => assignee.name || assignee.email || "").join(" "),
  ];

  return normalizeSearch(chunks.join(" ")).includes(normalizedTerm);
}

function formatTaskDueDateTime(value: Date | string | null | undefined, fallback = "Data invalida") {
  if (!value) return fallback;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return fallback;

  const datePart = parsedDate.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const timePart = parsedDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  });

  return `${datePart} às ${timePart}`;
}

function TaskColumn({
  title,
  count,
  icon: Icon,
  iconClassName,
  isExpandedMobile,
  onToggleMobile,
  children,
}: {
  title: string;
  count: number;
  icon: typeof Clock3;
  iconClassName: string;
  isExpandedMobile: boolean;
  onToggleMobile: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className={`${SURFACE_CARD_CLASS} rounded-[28px]`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base text-slate-950">
          <span className="inline-flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconClassName}`} />
            {title}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {count}
          </span>
        </CardTitle>
        <div className="md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onToggleMobile}
          >
            {isExpandedMobile ? "Recolher" : "Expandir"}
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "space-y-3",
          isExpandedMobile ? "block" : "hidden md:block"
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

export default function TarefasEventos() {
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const isStaff = user?.role === "administrativo" || user?.role === "corretor";
  const isAdmin = user?.role === "administrativo";
  const currentDate = useMemo(() => new Date(), []);
  const currentYear = currentDate.getFullYear();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [createAssigneeSearchTerm, setCreateAssigneeSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("todos");
  const [kindFilter, setKindFilter] = useState<KindFilter>("todos");
  const [newNote, setNewNote] = useState("");
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [isTemplateSectionExpandedMobile, setIsTemplateSectionExpandedMobile] = useState(false);
  const [isPendingColumnExpandedMobile, setIsPendingColumnExpandedMobile] = useState(false);
  const [isInProgressColumnExpandedMobile, setIsInProgressColumnExpandedMobile] = useState(false);
  const [isOverdueColumnExpandedMobile, setIsOverdueColumnExpandedMobile] = useState(false);
  const [isDoneColumnExpandedMobile, setIsDoneColumnExpandedMobile] = useState(false);
  const [taskTemplateForm, setTaskTemplateForm] = useState<TaskTemplateFormState>(
    EMPTY_TASK_TEMPLATE_FORM
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(currentDate);
  const [isCalendarFilterActive, setIsCalendarFilterActive] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    new Date(currentYear, currentDate.getMonth(), 1)
  );

  const { data: taskItems = [], isLoading: taskItemsLoading } = trpc.tasks.list.useQuery(undefined, {
    enabled: isAuthenticated && isStaff,
    refetchOnWindowFocus: true,
  });

  const { data: taskUsers = [] } = trpc.tasks.users.useQuery(undefined, {
    enabled: isAuthenticated && isStaff,
    refetchOnWindowFocus: true,
  });

  const { data: taskTemplates = [] } = trpc.tasks.templates.useQuery(undefined, {
    enabled: isAuthenticated && isStaff,
    refetchOnWindowFocus: true,
  });

  const selectedTask = useMemo(
    () => taskItems.find(taskItem => taskItem.id === selectedTaskId) ?? null,
    [selectedTaskId, taskItems]
  );
  const canEditSelectedTask = useMemo(() => {
    if (!selectedTask || !user) return false;
    return user.role === "administrativo" || selectedTask.createdByUserId === user.id;
  }, [selectedTask, user]);

  const { data: selectedTaskNotes = [] } = trpc.tasks.notes.useQuery(
    { taskId: selectedTaskId ?? 0 },
    { enabled: isAuthenticated && isStaff && selectedTaskId !== null }
  );

  const createTaskMutation = trpc.tasks.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.summary.invalidate(),
      ]);
      toast.success("Tarefa/Evento criado com sucesso.");
      setTaskForm(EMPTY_TASK_FORM);
      setSelectedTemplateId(null);
      setCreateOpen(false);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel criar a tarefa/evento.");
    },
  });

  const updateTaskMutation = trpc.tasks.update.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.summary.invalidate(),
        selectedTaskId ? utils.tasks.notes.invalidate({ taskId: selectedTaskId }) : Promise.resolve(),
      ]);

      if (result.task.computedStatus === "concluida") {
        toast.success("Tarefa/Evento concluido e mantido no historico dos ultimos 30 dias.");
      } else {
        toast.success("Tarefa/Evento atualizado com sucesso.");
      }
      setDetailsOpen(false);
      setSelectedTaskId(null);
      setTaskForm(EMPTY_TASK_FORM);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar a tarefa/evento.");
    },
  });

  const deleteTaskMutation = trpc.tasks.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.summary.invalidate(),
      ]);
      toast.success("Tarefa/Evento excluido.");
      setSelectedTaskId(null);
      setDetailsOpen(false);
      setTaskForm(EMPTY_TASK_FORM);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel excluir.");
    },
  });

  const addNoteMutation = trpc.tasks.addNote.useMutation({
    onSuccess: async () => {
      if (selectedTaskId !== null) {
        await Promise.all([
          utils.tasks.notes.invalidate({ taskId: selectedTaskId }),
          utils.tasks.list.invalidate(),
        ]);
      }
      toast.success("Observacao adicionada.");
      setNewNote("");
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel adicionar observacao.");
    },
  });

  const createTemplateMutation = trpc.tasks.createTemplate.useMutation({
    onSuccess: async () => {
      await utils.tasks.templates.invalidate();
      toast.success("Registro personalizado criado.");
      setTaskTemplateForm(EMPTY_TASK_TEMPLATE_FORM);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel criar o registro personalizado.");
    },
  });

  const updateTemplateMutation = trpc.tasks.updateTemplate.useMutation({
    onSuccess: async () => {
      await utils.tasks.templates.invalidate();
      toast.success("Registro personalizado atualizado.");
      setEditingTemplateId(null);
      setTaskTemplateForm(EMPTY_TASK_TEMPLATE_FORM);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar o registro personalizado.");
    },
  });

  const deleteTemplateMutation = trpc.tasks.deleteTemplate.useMutation({
    onSuccess: async () => {
      await utils.tasks.templates.invalidate();
      toast.success("Registro personalizado removido.");
      if (selectedTemplateId !== null) {
        setSelectedTemplateId(null);
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel remover o registro personalizado.");
    },
  });

  const selectedCalendarDateKey = useMemo(
    () => toDateKey(selectedCalendarDate),
    [selectedCalendarDate]
  );

  const filteredCreateAssigneeUsers = useMemo(() => {
    const rawTerm = createAssigneeSearchTerm.trim();
    if (!rawTerm) return taskUsers;

    const normalizedTerm = normalizeSearch(rawTerm);

    return taskUsers.filter(taskUser => {
      const displayName = getUserDisplayName(taskUser);
      const email = taskUser.email || "";
      const role = taskUser.role || "";
      return normalizeSearch(`${displayName} ${email} ${role}`).includes(normalizedTerm);
    });
  }, [createAssigneeSearchTerm, taskUsers]);

  const sortedTaskTemplates = useMemo(
    () =>
      [...taskTemplates].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        if (a.sector !== b.sector) return a.sector.localeCompare(b.sector);
        return a.name.localeCompare(b.name);
      }),
    [taskTemplates]
  );

  const filteredTaskItems = useMemo(() => {
    const normalizedTerm = normalizeSearch(searchTerm.trim());

    return taskItems.filter(taskItem => {
      if (viewMode === "minhas") {
        const isMine = taskItem.isAssignedToCurrentUser || taskItem.createdByUserId === user?.id;
        if (!isMine) return false;
      }

      if (kindFilter !== "todos" && taskItem.kind !== kindFilter) {
        return false;
      }

      if (!taskMatchesSearch(taskItem, normalizedTerm)) {
        return false;
      }

      if (isCalendarFilterActive && taskItem.computedStatus !== "concluida") {
        if (!taskItem.dueAt) return false;
        const dueDate = new Date(taskItem.dueAt);
        if (Number.isNaN(dueDate.getTime())) return false;
        if (toDateKey(dueDate) !== selectedCalendarDateKey) return false;
      }

      return true;
    });
  }, [isCalendarFilterActive, kindFilter, searchTerm, selectedCalendarDateKey, taskItems, user?.id, viewMode]);

  const pendingTaskItems = filteredTaskItems.filter(taskItem => taskItem.computedStatus === "pendente");
  const inProgressTaskItems = filteredTaskItems.filter(
    taskItem => taskItem.computedStatus === "em_andamento"
  );
  const overdueTaskItems = filteredTaskItems.filter(taskItem => taskItem.computedStatus === "atrasado");
  const completedTaskItems = filteredTaskItems.filter(taskItem => taskItem.computedStatus === "concluida");

  const calendarMonthGrid = useMemo(() => createMonthGrid(calendarMonth), [calendarMonth]);
  const dayMarkers = useMemo(() => {
    const markers = new Map<string, { hasTask: boolean; hasEvent: boolean }>();

    for (const taskItem of taskItems) {
      if (!taskItem.dueAt) continue;

      const parsedDate = new Date(taskItem.dueAt);
      if (Number.isNaN(parsedDate.getTime())) continue;

      const key = toDateKey(parsedDate);
      const currentMarker = markers.get(key) ?? { hasTask: false, hasEvent: false };

      if (taskItem.kind === "tarefa") currentMarker.hasTask = true;
      if (taskItem.kind === "evento") currentMarker.hasEvent = true;

      markers.set(key, currentMarker);
    }

    return markers;
  }, [taskItems]);

  const goToPreviousMonth = () => {
    setCalendarMonth(current => {
      const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      if (previous.getFullYear() !== currentYear) return current;
      return previous;
    });
  };

  const goToNextMonth = () => {
    setCalendarMonth(current => {
      const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      if (next.getFullYear() !== currentYear) return current;
      return next;
    });
  };

  const isAtFirstMonth = calendarMonth.getMonth() === 0;
  const isAtLastMonth = calendarMonth.getMonth() === 11;

  const toggleAssignee = (userId: number) => {
    setTaskForm(current => {
      const hasUser = current.assigneeIds.includes(userId);
      if (hasUser) {
        return { ...current, assigneeIds: current.assigneeIds.filter(id => id !== userId) };
      }
      return { ...current, assigneeIds: [...current.assigneeIds, userId] };
    });
  };

  const openCreateDialog = () => {
    setTaskForm({
      ...EMPTY_TASK_FORM,
      dueAt: toDateTimeLocalValue(new Date()),
    });
    setSelectedTemplateId(null);
    setCreateAssigneeSearchTerm("");
    setCreateOpen(true);
  };

  const openDetailsDialog = (taskItem: TaskItem) => {
    setSelectedTaskId(taskItem.id);
    setTaskForm({
      title: taskItem.title,
      kind: taskItem.kind,
      sector: taskItem.sector,
      dueAt: toDateTimeLocalValue(taskItem.dueAt),
      description: taskItem.description || "",
      status: taskItem.status,
      assigneeIds: taskItem.assignees.map(assignee => assignee.id),
    });
    setDetailsOpen(true);
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) {
      toast.warning("Informe um nome para a tarefa/evento.");
      return;
    }

    await createTaskMutation.mutateAsync({
      title: taskForm.title,
      kind: taskForm.kind,
      sector: taskForm.sector,
      dueAt: taskForm.dueAt || null,
      description: taskForm.description || null,
      status: taskForm.status === "concluida" ? "pendente" : taskForm.status,
      assigneeIds: taskForm.assigneeIds,
    });
  };

  const handleUpdateTask = async () => {
    if (!selectedTaskId) return;
    if (!canEditSelectedTask) {
      toast.warning("Somente o criador ou um administrador pode alterar esta tarefa/evento.");
      return;
    }

    await updateTaskMutation.mutateAsync({
      id: selectedTaskId,
      dueAt: taskForm.dueAt || null,
      description: taskForm.description || null,
      status: taskForm.status,
      assigneeIds: taskForm.assigneeIds,
    });
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskId) return;
    if (!canEditSelectedTask) {
      toast.warning("Somente o criador ou um administrador pode excluir esta tarefa/evento.");
      return;
    }
    await deleteTaskMutation.mutateAsync({ id: selectedTaskId });
  };

  const handleAddNote = async () => {
    if (!selectedTaskId) return;
    if (!canEditSelectedTask) {
      toast.warning("Somente o criador ou um administrador pode adicionar observacoes.");
      return;
    }
    if (!newNote.trim()) {
      toast.warning("Digite uma observacao antes de adicionar.");
      return;
    }
    await addNoteMutation.mutateAsync({
      taskId: selectedTaskId,
      note: newNote,
    });
  };

  const handleApplyTemplateToTaskForm = (templateIdValue: string) => {
    if (templateIdValue === "none") {
      setSelectedTemplateId(null);
      return;
    }

    const templateId = Number(templateIdValue);
    if (!Number.isInteger(templateId) || templateId <= 0) {
      setSelectedTemplateId(null);
      return;
    }

    const template = taskTemplates.find(item => item.id === templateId);
    if (!template) {
      setSelectedTemplateId(null);
      return;
    }

    setSelectedTemplateId(template.id);
    setTaskForm(current => ({
      ...current,
      kind: template.kind,
      sector: template.sector,
      title: template.defaultTitle,
      description: template.defaultDescription || "",
    }));
  };

  const handleSaveTemplate = async () => {
    if (!taskTemplateForm.name.trim() || !taskTemplateForm.defaultTitle.trim()) {
      toast.warning("Preencha nome e titulo padrao do registro.");
      return;
    }

    const payload = {
      name: taskTemplateForm.name.trim(),
      kind: taskTemplateForm.kind,
      sector: taskTemplateForm.sector,
      defaultTitle: taskTemplateForm.defaultTitle.trim(),
      defaultDescription: taskTemplateForm.defaultDescription.trim() || null,
    } as const;

    if (editingTemplateId) {
      await updateTemplateMutation.mutateAsync({
        id: editingTemplateId,
        ...payload,
      });
      return;
    }

    await createTemplateMutation.mutateAsync(payload);
  };

  const handleEditTemplate = (template: TaskTemplate) => {
    setEditingTemplateId(template.id);
    setTaskTemplateForm({
      name: template.name,
      kind: template.kind,
      sector: template.sector,
      defaultTitle: template.defaultTitle,
      defaultDescription: template.defaultDescription || "",
    });
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
            Voce precisa estar autenticado para acessar tarefas e eventos.
          </p>
          <Button asChild>
            <a href={getLoginUrl()}>Fazer Login</a>
          </Button>
        </div>
      </Layout>
    );
  }

  if (!isStaff) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Negado</h1>
          <p className="mb-6 text-muted-foreground">
            Esta area esta disponivel somente para corretores e administrativos.
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
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Tarefas e Eventos
              </h1>
              <p className="mt-2 text-slate-600">
                Organize demandas atuais, vincule usuários e acompanhe o que precisa de ação.
              </p>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Novo Registro
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-xl lg:max-w-xl sm:p-6">
                <DialogHeader className="space-y-3 pb-2">
                  <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                    Criar Novo Registro
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    Vincule usuarios e acompanhe a demanda ate a conclusao.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="task-template">Registro personalizado</Label>
                    <Select
                      value={selectedTemplateId ? String(selectedTemplateId) : "none"}
                      onValueChange={handleApplyTemplateToTaskForm}
                    >
                      <SelectTrigger id="task-template" className={FIELD_CLASS}>
                        <SelectValue placeholder="Selecione um modelo pronto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem modelo</SelectItem>
                        {sortedTaskTemplates.map(template => (
                          <SelectItem key={template.id} value={String(template.id)}>
                            {template.name} • {KIND_LABELS[template.kind]} • {SECTOR_LABELS[template.sector]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-title">Nome</Label>
                    <Input
                      id="task-title"
                      className={FIELD_CLASS}
                      value={taskForm.title}
                      onChange={event => setTaskForm(current => ({ ...current, title: event.target.value }))}
                      placeholder="Ex: Ajustar contrato do imovel #128"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="task-kind">Tipo</Label>
                      <Select
                        value={taskForm.kind}
                        onValueChange={value =>
                          setTaskForm(current => ({ ...current, kind: value as TaskKind }))
                        }
                      >
                        <SelectTrigger id="task-kind" className={FIELD_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tarefa">Tarefa</SelectItem>
                          <SelectItem value="evento">Evento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-sector">Setor</Label>
                      <Select
                        value={taskForm.sector}
                        onValueChange={value =>
                          setTaskForm(current => ({ ...current, sector: value as TaskSector }))
                        }
                      >
                        <SelectTrigger id="task-sector" className={FIELD_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTOR_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-status">Status inicial</Label>
                      <Select
                        value={taskForm.status}
                        onValueChange={value =>
                          setTaskForm(current => ({
                            ...current,
                            status: value as Exclude<TaskFormStatus, "concluida">,
                          }))
                        }
                      >
                        <SelectTrigger id="task-status" className={FIELD_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-due">Data e horario</Label>
                    <Input
                      id="task-due"
                      type="datetime-local"
                      className={FIELD_CLASS}
                      value={taskForm.dueAt}
                      onChange={event => setTaskForm(current => ({ ...current, dueAt: event.target.value }))}
                    />
                    <p className="text-xs text-slate-500">
                      Para eventos, data e horario sao obrigatorios. Tarefas sem data nao entram em "Atrasados".
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Usuarios vinculados</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className={`${FIELD_CLASS} pl-9`}
                        placeholder="Buscar usuario vinculado..."
                        value={createAssigneeSearchTerm}
                        onChange={event => setCreateAssigneeSearchTerm(event.target.value)}
                      />
                    </div>
                    <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto scrollbar-hidden rounded-2xl border border-slate-200 bg-white/80 p-3 sm:grid-cols-2">
                      {filteredCreateAssigneeUsers.map(taskUser => {
                        const isSelected = taskForm.assigneeIds.includes(taskUser.id);
                        return (
                          <button
                            key={taskUser.id}
                            type="button"
                            onClick={() => toggleAssignee(taskUser.id)}
                            className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                              isSelected
                                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <p className="font-medium">{getUserDisplayName(taskUser)}</p>
                            <p className="text-xs text-slate-500">#{taskUser.id} • {taskUser.role}</p>
                          </button>
                        );
                      })}
                      {filteredCreateAssigneeUsers.length === 0 ? (
                        <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-500">
                          Nenhum usuario encontrado para esta busca.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-description">Observações</Label>
                    <Textarea
                      id="task-description"
                      className={`${FIELD_CLASS} resize-none`}
                      value={taskForm.description}
                      onChange={event =>
                        setTaskForm(current => ({ ...current, description: event.target.value }))
                      }
                      rows={4}
                    />
                  </div>

                  <Button
                    className="w-full rounded-full bg-emerald-700 text-white shadow-[0_18px_40px_-28px_rgba(4,120,87,0.75)] hover:bg-emerald-800"
                    onClick={handleCreateTask}
                    disabled={createTaskMutation.isPending}
                  >
                    {createTaskMutation.isPending ? "Criando..." : "Criar Registro"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className={SURFACE_CARD_CLASS}>
              <CardContent className="space-y-4 p-6 md:p-7">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className={`${FIELD_CLASS} pl-9`}
                    placeholder="Buscar por nome, id, observacao ou usuario..."
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className={getFilterButtonClassName(viewMode === "todos")}
                    onClick={() => {
                      setViewMode("todos");
                      setIsCalendarFilterActive(false);
                    }}
                  >
                    Todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={getFilterButtonClassName(viewMode === "minhas")}
                    onClick={() => setViewMode("minhas")}
                  >
                    Minhas demandas
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={getFilterButtonClassName(kindFilter === "todos")}
                    onClick={() => setKindFilter("todos")}
                  >
                    Todos os tipos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={getFilterButtonClassName(kindFilter === "tarefa")}
                    onClick={() => setKindFilter("tarefa")}
                  >
                    Tarefas
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={getFilterButtonClassName(kindFilter === "evento")}
                    onClick={() => setKindFilter("evento")}
                  >
                    Eventos
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Personalizar Registro</p>
                      <p className="text-xs text-slate-600">
                        Crie modelos por tipo e setor para agilizar novos registros.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full md:hidden"
                      onClick={() =>
                        setIsTemplateSectionExpandedMobile(current => !current)
                      }
                    >
                      {isTemplateSectionExpandedMobile ? "Recolher" : "Expandir"}
                    </Button>
                  </div>

                  <div
                    className={cn(
                      isTemplateSectionExpandedMobile ? "block" : "hidden",
                      "md:block"
                    )}
                  >
                    {isAdmin ? (
                      <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="template-name">Nome do modelo</Label>
                          <Input
                            id="template-name"
                            className={FIELD_CLASS}
                            value={taskTemplateForm.name}
                            onChange={event =>
                              setTaskTemplateForm(current => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Ex: Contrato locacao"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="template-kind">Tipo</Label>
                          <Select
                            value={taskTemplateForm.kind}
                            onValueChange={value =>
                              setTaskTemplateForm(current => ({
                                ...current,
                                kind: value as TaskKind,
                              }))
                            }
                          >
                            <SelectTrigger id="template-kind" className={FIELD_CLASS}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tarefa">Tarefa</SelectItem>
                              <SelectItem value="evento">Evento</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="template-sector">Setor</Label>
                          <Select
                            value={taskTemplateForm.sector}
                            onValueChange={value =>
                              setTaskTemplateForm(current => ({
                                ...current,
                                sector: value as TaskSector,
                              }))
                            }
                          >
                            <SelectTrigger id="template-sector" className={FIELD_CLASS}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SECTOR_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="template-title">Titulo padrao</Label>
                          <Input
                            id="template-title"
                            className={FIELD_CLASS}
                            value={taskTemplateForm.defaultTitle}
                            onChange={event =>
                              setTaskTemplateForm(current => ({
                                ...current,
                                defaultTitle: event.target.value,
                              }))
                            }
                            placeholder="Ex: Redigir contrato de locacao"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="template-description">Observacao padrao</Label>
                        <Textarea
                          id="template-description"
                          className={`${FIELD_CLASS} resize-none`}
                          rows={3}
                          value={taskTemplateForm.defaultDescription}
                          onChange={event =>
                            setTaskTemplateForm(current => ({
                              ...current,
                              defaultDescription: event.target.value,
                            }))
                          }
                          placeholder="Ex: Confirmar dados, anexos e responsavel antes de enviar ao cliente."
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                          onClick={handleSaveTemplate}
                          disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                        >
                          {editingTemplateId ? "Atualizar modelo" : "Salvar modelo"}
                        </Button>
                        {sortedTaskTemplates.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-slate-200 bg-white"
                            onClick={() => setTemplateManagerOpen(true)}
                          >
                            Personalizados
                          </Button>
                        ) : null}
                        {editingTemplateId ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-slate-200"
                            onClick={() => {
                              setEditingTemplateId(null);
                              setTaskTemplateForm(EMPTY_TASK_TEMPLATE_FORM);
                            }}
                          >
                            Cancelar edicao
                          </Button>
                        ) : null}
                      </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={SURFACE_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                  <CalendarDays className="h-4 w-4 text-slate-600" />
                  Calendario {currentYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-slate-200"
                    onClick={goToPreviousMonth}
                    disabled={isAtFirstMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="text-sm font-semibold text-slate-800">
                    {MONTH_LABELS[calendarMonth.getMonth()]}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-slate-200"
                    onClick={goToNextMonth}
                    disabled={isAtLastMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500">
                  {WEEKDAY_LABELS.map(dayLabel => (
                    <span key={dayLabel} className="py-1">
                      {dayLabel}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarMonthGrid.map(dayCell => {
                    const marker = dayMarkers.get(dayCell.key);
                    const isSelected = dayCell.key === selectedCalendarDateKey;

                    return (
                      <button
                        key={dayCell.key}
                        type="button"
                        onClick={() => {
                          setSelectedCalendarDate(dayCell.date);
                          setIsCalendarFilterActive(true);
                        }}
                        className={cn(
                          "group flex h-10 flex-col items-center justify-center rounded-lg border transition-colors",
                          dayCell.inCurrentMonth
                            ? "border-slate-200 bg-white/70 hover:bg-white"
                            : "border-transparent bg-transparent",
                          isSelected
                            ? "!border-2 !border-emerald-800 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-800/30"
                            : "text-slate-700"
                        )}
                      >
                        <span
                          className={`text-xs font-medium ${
                            dayCell.inCurrentMonth ? "text-current" : "text-slate-300"
                          }`}
                        >
                          {dayCell.date.getDate()}
                        </span>
                        {dayCell.inCurrentMonth && marker ? (
                          <span className="mt-0.5 inline-flex items-center gap-1">
                            {marker.hasTask ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            ) : null}
                            {marker.hasEvent ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                            ) : null}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {taskItemsLoading ? (
            <div className="flex items-center justify-center rounded-[28px] border border-white/70 bg-white/90 p-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-4">
              <TaskColumn
                title="Pendentes"
                count={pendingTaskItems.length}
                icon={Clock3}
                iconClassName="text-sky-600"
                isExpandedMobile={isPendingColumnExpandedMobile}
                onToggleMobile={() =>
                  setIsPendingColumnExpandedMobile(current => !current)
                }
              >
                {pendingTaskItems.length > 0 ? (
                  pendingTaskItems.map(taskItem => (
                    <button
                      key={taskItem.id}
                      type="button"
                      onClick={() => openDetailsDialog(taskItem)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 p-4 text-left transition-colors hover:bg-white"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          #{taskItem.id}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          {KIND_LABELS[taskItem.kind]}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600">
                        Setor: {SECTOR_LABELS[taskItem.sector]}
                      </p>
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{taskItem.title}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {taskItem.dueAt
                          ? `Prazo: ${formatTaskDueDateTime(taskItem.dueAt)}`
                          : "Sem prazo definido"}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {taskItem.assignees.slice(0, 3).map(assignee => (
                            <span
                              key={assignee.id}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-200 text-[10px] font-semibold text-slate-700"
                              title={assignee.name || assignee.email || `Usuario #${assignee.id}`}
                            >
                              {getUserInitials(assignee)}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-slate-500">
                          {taskItem.assignees.length} vinculado(s)
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    Sem itens pendentes.
                  </p>
                )}
              </TaskColumn>

              <TaskColumn
                title="Em andamento"
                count={inProgressTaskItems.length}
                icon={PlayCircle}
                iconClassName="text-amber-600"
                isExpandedMobile={isInProgressColumnExpandedMobile}
                onToggleMobile={() =>
                  setIsInProgressColumnExpandedMobile(current => !current)
                }
              >
                {inProgressTaskItems.length > 0 ? (
                  inProgressTaskItems.map(taskItem => (
                    <button
                      key={taskItem.id}
                      type="button"
                      onClick={() => openDetailsDialog(taskItem)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 p-4 text-left transition-colors hover:bg-white"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          #{taskItem.id}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                          {KIND_LABELS[taskItem.kind]}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600">
                        Setor: {SECTOR_LABELS[taskItem.sector]}
                      </p>
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{taskItem.title}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {taskItem.dueAt
                          ? `Prazo: ${formatTaskDueDateTime(taskItem.dueAt)}`
                          : "Sem prazo definido"}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        Criado por: {taskItem.createdBy?.name || taskItem.createdBy?.email || "-"}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    Nenhum item em andamento.
                  </p>
                )}
              </TaskColumn>

              <TaskColumn
                title="Atrasados"
                count={overdueTaskItems.length}
                icon={AlertTriangle}
                iconClassName="text-rose-600"
                isExpandedMobile={isOverdueColumnExpandedMobile}
                onToggleMobile={() =>
                  setIsOverdueColumnExpandedMobile(current => !current)
                }
              >
                {overdueTaskItems.length > 0 ? (
                  overdueTaskItems.map(taskItem => (
                    <button
                      key={taskItem.id}
                      type="button"
                      onClick={() => openDetailsDialog(taskItem)}
                      className="w-full rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-left transition-colors hover:bg-rose-50/80"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-rose-700">
                          #{taskItem.id}
                        </span>
                        <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">
                          {KIND_LABELS[taskItem.kind]}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-rose-700">
                        Setor: {SECTOR_LABELS[taskItem.sector]}
                      </p>
                      <p className="line-clamp-2 text-sm font-semibold text-rose-900">{taskItem.title}</p>
                      <p className="mt-2 text-xs text-rose-700">
                        Prazo vencido em: {taskItem.dueAt ? formatTaskDueDateTime(taskItem.dueAt) : "-"}
                      </p>
                      <p className="mt-3 text-xs text-rose-700">
                        Ajuste o status para atualizar esta pendencia.
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    Nenhum atraso no momento.
                  </p>
                )}
              </TaskColumn>

              <TaskColumn
                title="Concluidas"
                count={completedTaskItems.length}
                icon={CheckCircle2}
                iconClassName="text-emerald-600"
                isExpandedMobile={isDoneColumnExpandedMobile}
                onToggleMobile={() =>
                  setIsDoneColumnExpandedMobile(current => !current)
                }
              >
                {completedTaskItems.length > 0 ? (
                  completedTaskItems.map(taskItem => (
                    <button
                      key={taskItem.id}
                      type="button"
                      onClick={() => openDetailsDialog(taskItem)}
                      className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-left transition-colors hover:bg-emerald-50"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          #{taskItem.id}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          {KIND_LABELS[taskItem.kind]}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-emerald-800">
                        Setor: {SECTOR_LABELS[taskItem.sector]}
                      </p>
                      <p className="line-clamp-2 text-sm font-semibold text-emerald-950">{taskItem.title}</p>
                      <p className="mt-2 text-xs text-emerald-800">
                        Concluida em: {formatStoredDateTime(taskItem.updatedAt)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    Nenhum item concluido nos ultimos 30 dias.
                  </p>
                )}
              </TaskColumn>
            </div>
          )}
        </div>
      </div>

      <Dialog open={templateManagerOpen} onOpenChange={setTemplateManagerOpen}>
        <DialogContent className="max-h-[92vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-3xl sm:p-6">
          <DialogHeader className="space-y-3 pb-2">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
              Registros Personalizados
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Visualize e gerencie os modelos cadastrados para acelerar tarefas e eventos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            {sortedTaskTemplates.length > 0 ? (
              sortedTaskTemplates.map(template => (
                <div
                  key={template.id}
                  className="rounded-2xl border border-slate-200 bg-white/90 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                      <p className="text-xs text-slate-600">
                        {KIND_LABELS[template.kind]} • {SECTOR_LABELS[template.sector]}
                      </p>
                    </div>
                    {isAdmin ? (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 rounded-full border-slate-200 px-3 text-xs"
                          onClick={() => {
                            handleEditTemplate(template);
                            setTemplateManagerOpen(false);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 rounded-full border-rose-200 px-3 text-xs text-rose-700 hover:bg-rose-50"
                          onClick={() => deleteTemplateMutation.mutate({ id: template.id })}
                          disabled={deleteTemplateMutation.isPending}
                        >
                          Excluir
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{template.defaultTitle}</p>
                  {template.defaultDescription ? (
                    <p className="mt-2 text-xs text-slate-500 whitespace-pre-line">
                      {template.defaultDescription}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Nenhum registro personalizado cadastrado.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[95vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-3xl sm:p-6">
          {selectedTask ? (
            <>
              <DialogHeader className="space-y-3 pb-2">
                <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                  #{selectedTask.id} • {selectedTask.title}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  Status atual: {STATUS_LABELS[selectedTask.computedStatus]} • Criado por{" "}
                  {selectedTask.createdBy?.name || selectedTask.createdBy?.email || "-"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <Card className="rounded-[28px] border-white/80 bg-white/90 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                  <CardContent className="space-y-4 p-5">
                    {!canEditSelectedTask ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                        Visualizacao somente leitura: apenas o criador ou um usuario administrativo pode alterar.
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="detail-status">Status</Label>
                      <Select
                        value={taskForm.status}
                        disabled={!canEditSelectedTask}
                        onValueChange={value =>
                          setTaskForm(current => ({ ...current, status: value as TaskFormStatus }))
                        }
                      >
                        <SelectTrigger id="detail-status" className={FIELD_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="concluida">Concluida</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        "Atrasado" e automatico quando o prazo vence.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="detail-due">Data e horario</Label>
                      <Input
                        id="detail-due"
                        type="datetime-local"
                        className={FIELD_CLASS}
                        value={taskForm.dueAt}
                        disabled={!canEditSelectedTask}
                        onChange={event =>
                          setTaskForm(current => ({ ...current, dueAt: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Usuarios vinculados</Label>
                      <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto scrollbar-hidden rounded-2xl border border-slate-200 bg-white/80 p-3 sm:grid-cols-2">
                        {taskUsers.map(taskUser => {
                          const isSelected = taskForm.assigneeIds.includes(taskUser.id);
                          return (
                            <button
                              key={taskUser.id}
                              type="button"
                              disabled={!canEditSelectedTask}
                              onClick={() => toggleAssignee(taskUser.id)}
                              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                                isSelected
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                  : "border-slate-200 bg-white text-slate-700"
                              } ${!canEditSelectedTask ? "cursor-not-allowed opacity-70" : "hover:bg-slate-50"
                              }`}
                            >
                              <p className="font-medium">{getUserDisplayName(taskUser)}</p>
                              <p className="text-xs text-slate-500">#{taskUser.id} • {taskUser.role}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="detail-description">Observacoes gerais</Label>
                      <Textarea
                        id="detail-description"
                        className={`${FIELD_CLASS} resize-none`}
                        value={taskForm.description}
                        disabled={!canEditSelectedTask}
                        onChange={event =>
                          setTaskForm(current => ({ ...current, description: event.target.value }))
                        }
                        rows={4}
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                        onClick={handleUpdateTask}
                        disabled={!canEditSelectedTask || updateTaskMutation.isPending}
                      >
                        {updateTaskMutation.isPending ? "Salvando..." : "Salvar alteracoes"}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={handleDeleteTask}
                        disabled={!canEditSelectedTask || deleteTaskMutation.isPending}
                      >
                        Excluir tarefa/evento
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-white/80 bg-white/90 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-950">Observacoes da tarefa</CardTitle>
                    <CardDescription className="text-slate-600">
                      {canEditSelectedTask
                        ? "Adicione observacoes enquanto a tarefa/evento estiver ativa."
                        : "Somente leitura para usuarios vinculados sem permissao de edicao."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        className={`${FIELD_CLASS} resize-none`}
                        value={newNote}
                        disabled={!canEditSelectedTask}
                        onChange={event => setNewNote(event.target.value)}
                        rows={3}
                        placeholder="Adicionar observacao..."
                      />
                      <Button
                        className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                        onClick={handleAddNote}
                        disabled={!canEditSelectedTask || addNoteMutation.isPending}
                      >
                        Adicionar observacao
                      </Button>
                    </div>

                    {selectedTaskNotes.length > 0 ? (
                      <div className="space-y-3">
                        {selectedTaskNotes.map((taskNote: TaskNote) => (
                          <div
                            key={taskNote.id}
                            className="rounded-2xl border border-slate-200 bg-white p-3"
                          >
                            <p className="text-sm text-slate-900 whitespace-pre-line">{taskNote.note}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatStoredDateTime(taskNote.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                        Nenhuma observacao registrada.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
