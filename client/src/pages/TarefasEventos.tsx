import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatStoredDateTime } from "@/lib/date";
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
  CheckCircle2,
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

type TaskKind = "tarefa" | "evento";
type TaskFormStatus = "pendente" | "em_andamento" | "concluida";
type TaskComputedStatus = "pendente" | "em_andamento" | "atrasado";
type ViewMode = "todos" | "minhas";
type KindFilter = "todos" | TaskKind;

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";
const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

const STATUS_LABELS: Record<TaskComputedStatus | "concluida", string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  atrasado: "Atrasado",
  concluida: "Concluida",
};

const KIND_LABELS: Record<TaskKind, string> = {
  tarefa: "Tarefa",
  evento: "Evento",
};

type TaskFormState = {
  title: string;
  kind: TaskKind;
  dueAt: string;
  description: string;
  status: TaskFormStatus;
  assigneeIds: number[];
};

const EMPTY_TASK_FORM: TaskFormState = {
  title: "",
  kind: "tarefa",
  dueAt: "",
  description: "",
  status: "pendente",
  assigneeIds: [],
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

function TaskColumn({
  title,
  count,
  icon: Icon,
  iconClassName,
  children,
}: {
  title: string;
  count: number;
  icon: typeof Clock3;
  iconClassName: string;
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
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default function TarefasEventos() {
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const isStaff = user?.role === "administrativo" || user?.role === "corretor";

  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("todos");
  const [kindFilter, setKindFilter] = useState<KindFilter>("todos");
  const [newNote, setNewNote] = useState("");
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM);

  const { data: taskItems = [], isLoading: taskItemsLoading } = trpc.tasks.list.useQuery(undefined, {
    enabled: isAuthenticated && isStaff,
    refetchOnWindowFocus: true,
  });

  const { data: taskUsers = [] } = trpc.tasks.users.useQuery(undefined, {
    enabled: isAuthenticated && isStaff,
    refetchOnWindowFocus: true,
  });

  const selectedTask = useMemo(
    () => taskItems.find(taskItem => taskItem.id === selectedTaskId) ?? null,
    [selectedTaskId, taskItems]
  );

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

      if (result.action === "deleted") {
        toast.success("Tarefa/Evento concluido e removido.");
        setSelectedTaskId(null);
        setDetailsOpen(false);
        setTaskForm(EMPTY_TASK_FORM);
        return;
      }

      toast.success("Tarefa/Evento atualizado com sucesso.");
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

      return true;
    });
  }, [kindFilter, searchTerm, taskItems, user?.id, viewMode]);

  const pendingTaskItems = filteredTaskItems.filter(taskItem => taskItem.computedStatus === "pendente");
  const inProgressTaskItems = filteredTaskItems.filter(
    taskItem => taskItem.computedStatus === "em_andamento"
  );
  const overdueTaskItems = filteredTaskItems.filter(taskItem => taskItem.computedStatus === "atrasado");

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
    setTaskForm(EMPTY_TASK_FORM);
    setCreateOpen(true);
  };

  const openDetailsDialog = (taskItem: TaskItem) => {
    setSelectedTaskId(taskItem.id);
    setTaskForm({
      title: taskItem.title,
      kind: taskItem.kind,
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
      dueAt: taskForm.dueAt || null,
      description: taskForm.description || null,
      status: taskForm.status === "concluida" ? "pendente" : taskForm.status,
      assigneeIds: taskForm.assigneeIds,
    });
  };

  const handleUpdateTask = async () => {
    if (!selectedTaskId) return;
    if (!taskForm.title.trim()) {
      toast.warning("Informe um nome para a tarefa/evento.");
      return;
    }

    await updateTaskMutation.mutateAsync({
      id: selectedTaskId,
      title: taskForm.title,
      kind: taskForm.kind,
      dueAt: taskForm.dueAt || null,
      description: taskForm.description || null,
      status: taskForm.status,
      assigneeIds: taskForm.assigneeIds,
    });
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskId) return;
    await deleteTaskMutation.mutateAsync({ id: selectedTaskId });
  };

  const handleAddNote = async () => {
    if (!selectedTaskId) return;
    if (!newNote.trim()) {
      toast.warning("Digite uma observacao antes de adicionar.");
      return;
    }
    await addNoteMutation.mutateAsync({
      taskId: selectedTaskId,
      note: newNote,
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
                Organize demandas atuais, vincule usuarios e acompanhe o que precisa de acao.
              </p>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Nova tarefa/evento
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6">
                <DialogHeader className="space-y-3 pb-2">
                  <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                    Criar tarefa/evento
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    Vincule usuarios e acompanhe a demanda ate a conclusao.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
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

                  <div className="grid gap-4 sm:grid-cols-2">
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
                    <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto scrollbar-hidden rounded-2xl border border-slate-200 bg-white/80 p-3 sm:grid-cols-2">
                      {taskUsers.map(taskUser => {
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
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-description">Observacoes</Label>
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
                    {createTaskMutation.isPending ? "Criando..." : "Criar tarefa/evento"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className={`${SURFACE_CARD_CLASS} mb-8`}>
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
                  variant={viewMode === "todos" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setViewMode("todos")}
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "minhas" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setViewMode("minhas")}
                >
                  Minhas demandas
                </Button>
                <Button
                  type="button"
                  variant={kindFilter === "todos" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setKindFilter("todos")}
                >
                  Todos os tipos
                </Button>
                <Button
                  type="button"
                  variant={kindFilter === "tarefa" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setKindFilter("tarefa")}
                >
                  Tarefas
                </Button>
                <Button
                  type="button"
                  variant={kindFilter === "evento" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setKindFilter("evento")}
                >
                  Eventos
                </Button>
              </div>
            </CardContent>
          </Card>

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
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{taskItem.title}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {taskItem.dueAt
                          ? `Prazo: ${formatStoredDateTime(taskItem.dueAt)}`
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
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{taskItem.title}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {taskItem.dueAt
                          ? `Prazo: ${formatStoredDateTime(taskItem.dueAt)}`
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
                      <p className="line-clamp-2 text-sm font-semibold text-rose-900">{taskItem.title}</p>
                      <p className="mt-2 text-xs text-rose-700">
                        Prazo vencido em: {taskItem.dueAt ? formatStoredDateTime(taskItem.dueAt) : "-"}
                      </p>
                      <p className="mt-3 text-xs text-rose-700">
                        Ajuste o status ou conclua para remover.
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
                count={0}
                icon={CheckCircle2}
                iconClassName="text-emerald-600"
              >
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                  Ao marcar uma tarefa/evento como <strong>Concluida</strong>, ela e removida do sistema
                  automaticamente.
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Sem historico persistente nesta etapa, conforme solicitado para foco em demandas atuais.
                </div>
              </TaskColumn>
            </div>
          )}
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[95vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-3xl sm:p-6">
          {selectedTask ? (
            <>
              <DialogHeader className="space-y-3 pb-2">
                <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                  #{selectedTask.id} • {selectedTask.title}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  Tipo: {KIND_LABELS[selectedTask.kind]} • Status atual:{" "}
                  {STATUS_LABELS[selectedTask.computedStatus]} • Criado por{" "}
                  {selectedTask.createdBy?.name || selectedTask.createdBy?.email || "-"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <Card className="rounded-[28px] border-white/80 bg-white/90 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                  <CardContent className="space-y-4 p-5">
                    <div className="space-y-2">
                      <Label htmlFor="detail-title">Nome</Label>
                      <Input
                        id="detail-title"
                        className={FIELD_CLASS}
                        value={taskForm.title}
                        onChange={event =>
                          setTaskForm(current => ({ ...current, title: event.target.value }))
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="detail-kind">Tipo</Label>
                        <Select
                          value={taskForm.kind}
                          onValueChange={value =>
                            setTaskForm(current => ({ ...current, kind: value as TaskKind }))
                          }
                        >
                          <SelectTrigger id="detail-kind" className={FIELD_CLASS}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tarefa">Tarefa</SelectItem>
                            <SelectItem value="evento">Evento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="detail-status">Status</Label>
                        <Select
                          value={taskForm.status}
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
                            <SelectItem value="concluida">Concluida (remove)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                          "Atrasado" e automatico quando o prazo vence.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="detail-due">Data e horario</Label>
                      <Input
                        id="detail-due"
                        type="datetime-local"
                        className={FIELD_CLASS}
                        value={taskForm.dueAt}
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
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="detail-description">Observacoes gerais</Label>
                      <Textarea
                        id="detail-description"
                        className={`${FIELD_CLASS} resize-none`}
                        value={taskForm.description}
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
                        disabled={updateTaskMutation.isPending}
                      >
                        {updateTaskMutation.isPending ? "Salvando..." : "Salvar alteracoes"}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={handleDeleteTask}
                        disabled={deleteTaskMutation.isPending}
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
                      Adicione observacoes enquanto a tarefa/evento estiver ativa.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        className={`${FIELD_CLASS} resize-none`}
                        value={newNote}
                        onChange={event => setNewNote(event.target.value)}
                        rows={3}
                        placeholder="Adicionar observacao..."
                      />
                      <Button
                        className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                        onClick={handleAddNote}
                        disabled={addNoteMutation.isPending}
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
