import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import { useAuth } from "@/_core/hooks/useAuth";
import { isAdminRole } from "@shared/auth";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { toast } from "sonner";
import {
  Target,
  Users,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Star,
  ChevronDown,
} from "lucide-react";

export default function RoletaAtendimentos() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-16">
        <div className="container space-y-8 py-8 md:py-10">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Roleta de Atendimentos
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Entre na fila para receber leads em rodízio. Ao receber um
              atendimento você volta para o fim da fila automaticamente.
            </p>
          </header>

          <PushHint />

          <MyQueuesSection />

          {isAdmin && (
            <>
              <Separator className="bg-slate-200/70" />
              <AdminQueuesSection />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

/** Lembra o usuário de ativar o push para receber a posição fixa no celular. */
function PushHint() {
  return (
    <Card className="rounded-[24px] border-emerald-100 bg-emerald-50/60 shadow-none">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p className="text-sm text-emerald-900">
            Ative as notificações para receber no celular a sua posição na fila
            — ela fica fixa e atualiza sozinha a cada mudança.
          </p>
        </div>
        <div className="shrink-0">
          <PushNotificationToggle />
        </div>
      </CardContent>
    </Card>
  );
}

/** Visão do corretor (e admin): filas que ele pode acessar + entrar/sair. */
function MyQueuesSection() {
  const utils = trpc.useUtils();
  const myQueues = trpc.roleta.myQueues.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const join = trpc.roleta.join.useMutation({
    onSuccess: () => {
      void utils.roleta.myQueues.invalidate();
      toast.success("Você entrou na fila.");
    },
    onError: error => toast.error(error.message || "Não foi possível entrar."),
  });

  const leave = trpc.roleta.leave.useMutation({
    onSuccess: () => {
      void utils.roleta.myQueues.invalidate();
      toast.success("Você saiu da fila.");
    },
    onError: error => toast.error(error.message || "Não foi possível sair."),
  });

  const pendingQueueId =
    (join.isPending && join.variables?.queueId) ||
    (leave.isPending && leave.variables?.queueId) ||
    null;

  if (myQueues.isLoading) {
    return <SectionLoading label="Carregando suas filas..." />;
  }

  const items = myQueues.data ?? [];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Minhas filas</h2>

      {items.length === 0 ? (
        <Card className="rounded-[24px] border-white/70 bg-white/90">
          <CardContent className="py-8 text-center text-slate-500">
            Você ainda não tem filas liberadas. Peça a um administrador para
            liberar seu acesso à roleta.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(item => (
            <Card
              key={item.queue.id}
              className="rounded-[24px] border-white/70 bg-white/90 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)]"
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-slate-900">
                  <span className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-700" />
                    {item.queue.name}
                  </span>
                  {item.isParticipating && item.position != null && (
                    <Badge
                      className={
                        item.position === 1
                          ? "bg-emerald-600 text-white hover:bg-emerald-600"
                          : "bg-slate-900 text-white hover:bg-slate-900"
                      }
                    >
                      {item.position === 1
                        ? "Sua vez!"
                        : `Posição ${item.position}`}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.queue.description && (
                  <p className="text-sm text-slate-600">
                    {item.queue.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {item.participantsCount} na fila
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {item.queue.attendanceTimeoutMinutes} min p/ atender
                  </span>
                </div>

                {item.isParticipating ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={pendingQueueId === item.queue.id}
                    onClick={() => leave.mutate({ queueId: item.queue.id })}
                  >
                    {pendingQueueId === item.queue.id && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Sair da fila
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={pendingQueueId === item.queue.id}
                    onClick={() => join.mutate({ queueId: item.queue.id })}
                  >
                    {pendingQueueId === item.queue.id && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Entrar na fila
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

const emptyCreateForm = {
  name: "",
  description: "",
  assignmentTimeoutMinutes: "15",
  attendanceTimeoutMinutes: "40",
  businessHoursOnly: true,
  isDefault: false,
};

/** Painel do admin: criar filas com regras e gerenciar acesso dos corretores. */
function AdminQueuesSection() {
  const utils = trpc.useUtils();
  const queues = trpc.roleta.queues.useQuery();
  const corretoresQuery = trpc.admin.users.useQuery();
  const corretores = (corretoresQuery.data ?? []).filter(
    u => u.role === "corretor" && u.isActive === 1
  );

  const [form, setForm] = useState(emptyCreateForm);

  const createQueue = trpc.roleta.createQueue.useMutation({
    onSuccess: () => {
      void utils.roleta.queues.invalidate();
      setForm(emptyCreateForm);
      toast.success("Fila criada com sucesso.");
    },
    onError: error => toast.error(error.message || "Não foi possível criar."),
  });

  const handleCreate = () => {
    if (form.name.trim().length < 2) {
      toast.error("Informe um nome para a fila.");
      return;
    }
    createQueue.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
      assignmentTimeoutMinutes: Number(form.assignmentTimeoutMinutes) || 15,
      attendanceTimeoutMinutes: Number(form.attendanceTimeoutMinutes) || 40,
      businessHoursOnly: form.businessHoursOnly,
      isDefault: form.isDefault,
    });
  };

  return (
    <section className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">
        Configuração das filas (admin)
      </h2>

      <Card className="rounded-[24px] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
            <Plus className="h-4 w-4 text-emerald-700" />
            Nova fila
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="queue-name">Nome</Label>
              <Input
                id="queue-name"
                value={form.name}
                placeholder="Ex.: Roleta Padrão"
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="queue-desc">Descrição (opcional)</Label>
              <Input
                id="queue-desc"
                value={form.description}
                placeholder="Ex.: Leads do site"
                onChange={e =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="queue-assign">Minutos p/ direcionar</Label>
              <Input
                id="queue-assign"
                type="number"
                min={1}
                value={form.assignmentTimeoutMinutes}
                onChange={e =>
                  setForm({
                    ...form,
                    assignmentTimeoutMinutes: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="queue-attend">Minutos p/ atender</Label>
              <Input
                id="queue-attend"
                type="number"
                min={1}
                value={form.attendanceTimeoutMinutes}
                onChange={e =>
                  setForm({
                    ...form,
                    attendanceTimeoutMinutes: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Switch
                checked={form.businessHoursOnly}
                onCheckedChange={checked =>
                  setForm({ ...form, businessHoursOnly: checked })
                }
              />
              Só em horário comercial
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Switch
                checked={form.isDefault}
                onCheckedChange={checked =>
                  setForm({ ...form, isDefault: checked })
                }
              />
              Definir como fila padrão
            </label>
          </div>

          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={createQueue.isPending}
            onClick={handleCreate}
          >
            {createQueue.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Criar fila
          </Button>
        </CardContent>
      </Card>

      {queues.isLoading ? (
        <SectionLoading label="Carregando filas..." />
      ) : (queues.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma fila criada ainda.</p>
      ) : (
        <div className="space-y-4">
          {(queues.data ?? []).map(queue => (
            <AdminQueueCard
              key={queue.id}
              queue={queue}
              corretores={corretores}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type RouterOutputs = inferRouterOutputs<AppRouter>;
type QueueRow = RouterOutputs["roleta"]["queues"][number];
type CorretorRow = RouterOutputs["admin"]["users"][number];

function AdminQueueCard({
  queue,
  corretores,
}: {
  queue: QueueRow;
  corretores: CorretorRow[];
}) {
  const utils = trpc.useUtils();
  const [manageOpen, setManageOpen] = useState(false);

  const invalidateQueues = () => void utils.roleta.queues.invalidate();

  const updateQueue = trpc.roleta.updateQueue.useMutation({
    onSuccess: invalidateQueues,
    onError: error => toast.error(error.message || "Não foi possível salvar."),
  });

  const deleteQueue = trpc.roleta.deleteQueue.useMutation({
    onSuccess: () => {
      invalidateQueues();
      toast.success("Fila excluída.");
    },
    onError: error => toast.error(error.message || "Não foi possível excluir."),
  });

  return (
    <Card className="rounded-[24px] border-white/70 bg-white/90">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base text-slate-900">
          <span className="flex items-center gap-2">
            {queue.name}
            {queue.isDefault === 1 && (
              <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                <Star className="h-3 w-3" />
                Padrão
              </Badge>
            )}
            {queue.isActive !== 1 && (
              <Badge variant="outline" className="text-slate-500">
                Inativa
              </Badge>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {queue.assignmentTimeoutMinutes} min direcionar /{" "}
            {queue.attendanceTimeoutMinutes} min atender
          </span>
          <span>{queue.businessHoursOnly === 1 ? "Horário comercial" : "24h"}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Switch
              checked={queue.isActive === 1}
              onCheckedChange={checked =>
                updateQueue.mutate({ id: queue.id, isActive: checked })
              }
            />
            Ativa
          </label>
          {queue.isDefault !== 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                updateQueue.mutate({ id: queue.id, isDefault: true })
              }
            >
              <Star className="mr-1.5 h-4 w-4" />
              Tornar padrão
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:text-rose-700"
            onClick={() => {
              if (confirm(`Excluir a fila "${queue.name}"?`)) {
                deleteQueue.mutate({ id: queue.id });
              }
            }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Excluir
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setManageOpen(open => !open)}
          >
            <Users className="mr-1.5 h-4 w-4" />
            Acesso dos corretores
            <ChevronDown
              className={`ml-1.5 h-4 w-4 transition-transform ${
                manageOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </div>

        {manageOpen && (
          <QueueMembersPanel queueId={queue.id} corretores={corretores} />
        )}
      </CardContent>
    </Card>
  );
}

function QueueMembersPanel({
  queueId,
  corretores,
}: {
  queueId: number;
  corretores: CorretorRow[];
}) {
  const utils = trpc.useUtils();
  const members = trpc.roleta.members.useQuery({ queueId });
  const participants = trpc.roleta.participants.useQuery({ queueId });

  const allowedIds = new Set(
    (members.data ?? []).filter(m => m.canJoin === 1).map(m => m.userId)
  );
  const participatingIds = new Set(
    (participants.data ?? []).map(p => p.userId)
  );

  const invalidate = () => {
    void utils.roleta.members.invalidate({ queueId });
    void utils.roleta.participants.invalidate({ queueId });
  };

  const setMember = trpc.roleta.setMember.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message || "Não foi possível salvar."),
  });
  const removeMember = trpc.roleta.removeMember.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message || "Não foi possível salvar."),
  });

  return (
    <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      {members.isLoading ? (
        <p className="text-sm text-slate-500">Carregando acessos...</p>
      ) : corretores.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum corretor ativo.</p>
      ) : (
        corretores.map(corretor => {
          const allowed = allowedIds.has(corretor.id);
          const inQueue = participatingIds.has(corretor.id);
          return (
            <div
              key={corretor.id}
              className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {corretor.name || corretor.email || `Corretor ${corretor.id}`}
                </p>
                {inQueue && (
                  <span className="text-xs text-emerald-700">Na fila agora</span>
                )}
              </div>
              <Switch
                checked={allowed}
                onCheckedChange={checked =>
                  checked
                    ? setMember.mutate({
                        queueId,
                        userId: corretor.id,
                        canJoin: true,
                      })
                    : removeMember.mutate({ queueId, userId: corretor.id })
                }
              />
            </div>
          );
        })
      )}
    </div>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
