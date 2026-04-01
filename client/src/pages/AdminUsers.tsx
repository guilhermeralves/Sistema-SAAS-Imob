import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { formatCreci, isValidCreci } from "@/lib/creci";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { formatStoredDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS, type AppRole } from "@shared/auth";
import { AlertTriangle, BadgeCheck, Clock3, MoreHorizontal, Plus, Search, Shield, Trash2, UserCog, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type EditableRole = AppRole;
type UserFilter = "all" | "active" | "corretor" | "cliente";

type EditState = {
  id: number;
  name: string;
  role: EditableRole;
  isActive: "0" | "1";
  password: string;
  passwordOnly?: boolean;
} | null;

type DeleteState = {
  userId: number;
  deleteLinkedLeads: boolean;
} | null;

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return formatStoredDate(date);
}

function formatLeadInterest(interest: string | null | undefined) {
  return interest?.trim() || "Interesse nao informado";
}

function getCreciStatusMessage(status: "pending" | "verified" | null | undefined) {
  if (status === "verified") {
    return "Numero do CRECI registrado!";
  }

  if (status === "pending") {
    return "Numero do CRECI pendente de validacao por admin.";
  }

  return "";
}

export default function AdminUsers() {
  const { user: authenticatedUser } = useAuth();
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [editState, setEditState] = useState<EditState>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [selectedFilter, setSelectedFilter] = useState<UserFilter | null>(null);
  const [showClientsWithContracts, setShowClientsWithContracts] = useState(false);
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    cpf: "",
    email: "",
    password: "",
    creci: "",
    role: "corretor" as AppRole,
  });
  const normalizedCreateCpf = useMemo(
    () => (isValidCpf(createForm.cpf) ? normalizeCpf(createForm.cpf) : null),
    [createForm.cpf]
  );

  const { data: users, isLoading } = trpc.admin.users.useQuery();
  const { data: contracts } = trpc.contracts.list.useQuery(undefined, {
    enabled: selectedFilter === "cliente" && showClientsWithContracts,
  });
  const { data: leadLinkPreview } = trpc.admin.leadLinkPreviewByCpf.useQuery(
    { cpf: normalizedCreateCpf ?? "00000000000" },
    {
      enabled: createOpen && normalizedCreateCpf !== null,
      retry: false,
    }
  );
  const {
    data: deletePreview,
    isLoading: deletePreviewLoading,
    error: deletePreviewError,
  } = trpc.admin.deleteUserPreview.useQuery(
    { userId: deleteState?.userId ?? 0 },
    {
      enabled: deleteState !== null,
      retry: false,
    }
  );
  const newUsersCount = useMemo(
    () => users?.filter(user => user.isNewForAdmin).length ?? 0,
    [users]
  );
  const clientIdsWithContracts = useMemo(
    () => new Set((contracts ?? []).map(contract => contract.idCliente)),
    [contracts]
  );

  const resetCreateForm = () => {
    setCreateOpen(false);
    setCreateConfirmOpen(false);
    setCreateForm({ name: "", cpf: "", email: "", password: "", creci: "", role: "corretor" });
  };

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: async data => {
      const linkedInterest = data.linkedLeadPreview?.latestInterest;
      toast.success(
        linkedInterest
          ? `Usuario criado e vinculado ao lead com interesse em: ${formatLeadInterest(linkedInterest)}`
          : "Usuario criado com sucesso"
      );
      resetCreateForm();
      await utils.admin.users.invalidate();
      await utils.admin.hasNewUsers.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel criar o usuario");
    },
  });

  const markAllNewUsersAsViewed = trpc.admin.markAllNewUsersAsViewed.useMutation({
    onSuccess: async data => {
      toast.success(
        data.markedCount > 0
          ? "Todos os novos cadastros foram marcados como vistos"
          : "Nao havia novos cadastros pendentes"
      );
      await utils.admin.users.invalidate();
      await utils.admin.hasNewUsers.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel marcar os cadastros como vistos");
    },
  });

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: async () => {
      toast.success("Usuario atualizado com sucesso");
      setEditState(null);
      await utils.admin.users.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar o usuario");
    },
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: async data => {
      if (data.mode === "revoke_access") {
        toast.success(
          data.isSelf
            ? "Seu acesso administrativo foi revogado"
            : "Acesso do administrador revogado com sucesso"
        );
      } else {
        toast.success("Usuario excluido com sucesso");
      }

      setDeleteState(null);
      await utils.admin.users.invalidate();
      await utils.admin.hasNewUsers.invalidate();

      if (data.isSelf && typeof window !== "undefined") {
        window.location.assign("/");
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel concluir a exclusao");
    },
  });

  const sortedUsers = useMemo(() => {
    return [...(users ?? [])].sort((left, right) => {
      if (left.isNewForAdmin !== right.isNewForAdmin) {
        return left.isNewForAdmin ? -1 : 1;
      }

      if (left.isNewForAdmin && right.isNewForAdmin) {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }

      const leftValue = (left.name || left.email || "").trim();
      const rightValue = (right.name || right.email || "").trim();

      return leftValue.localeCompare(rightValue, "pt-BR", {
        sensitivity: "base",
      });
    });
  }, [users]);

  const activeCount = useMemo(
    () => users?.filter(user => user.isActive === 1).length ?? 0,
    [users]
  );

  const corretorCount = useMemo(
    () => users?.filter(user => user.role === "corretor").length ?? 0,
    [users]
  );

  const clienteCount = useMemo(
    () => users?.filter(user => user.role === "cliente").length ?? 0,
    [users]
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sortedUsers
      .filter(user => {
        if (!selectedFilter || selectedFilter === "all") return true;
        if (selectedFilter === "active") return user.isActive === 1;
        if (selectedFilter === "corretor") return user.role === "corretor";
        if (selectedFilter === "cliente") return user.role === "cliente";
        return true;
      })
      .filter(user => {
        if (!normalizedSearch) return true;

        const searchableValues = [
          String(user.id),
          `id ${user.id}`,
          user.role === "corretor" ? `corretor id ${user.id}` : "",
          user.name || "",
          user.email || "",
          formatCpf(user.cpf),
          ROLE_LABELS[user.role],
          user.role,
          user.isActive === 1 ? "ativo" : "inativo",
          user.isNewForAdmin ? "novo" : formatDate(user.lastSignedIn),
        ];

        return searchableValues.some(value =>
          value.toLowerCase().includes(normalizedSearch)
        );
      })
      .filter(user => {
        if (selectedFilter !== "cliente" || !showClientsWithContracts) return true;
        return clientIdsWithContracts.has(user.id);
      });
  }, [clientIdsWithContracts, search, selectedFilter, showClientsWithContracts, sortedUsers]);

  const cards: Array<{ key: UserFilter; label: string; value: number }> = [
    { key: "all", label: "Todos os Cadastros", value: users?.length ?? 0 },
    { key: "active", label: "Cadastros Ativos", value: activeCount },
    { key: "corretor", label: "Corretores", value: corretorCount },
    { key: "cliente", label: "Clientes", value: clienteCount },
  ];

  const submitCreateUser = (confirmedLeadLink = false) => {
    if (!isValidCpf(createForm.cpf)) {
      toast.error("CPF invalido. Confira os digitos informados.");
      return;
    }

    if (createForm.role === "corretor" && createForm.creci && !isValidCreci(createForm.creci)) {
      toast.error("CRECI invalido. Use o formato numero/UF, por exemplo 123456/SP.");
      return;
    }

    if (leadLinkPreview && !confirmedLeadLink) {
      setCreateConfirmOpen(true);
      return;
    }

    createUser.mutate({
      name: createForm.name,
      cpf: normalizeCpf(createForm.cpf),
      email: createForm.email,
      password: createForm.password,
      creci: createForm.role === "corretor" ? formatCreci(createForm.creci) || undefined : undefined,
      role: createForm.role,
      confirmedLeadLink,
    });
  };

  const currentDeleteTarget = useMemo(
    () => users?.find(user => user.id === deleteState?.userId) ?? null,
    [deleteState?.userId, users]
  );

  const isProtectedRootAdmin = currentDeleteTarget?.registrationSource === "bootstrap";

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
      <div className="container space-y-6 py-8 md:py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Usuários</h1>
            <p className="mt-2 text-slate-600">
              Gerencie usuarios, ajuste permissoes e desative contas.
            </p>
          </div>

          <Dialog
            open={createOpen}
            onOpenChange={open => {
              setCreateOpen(open);
              if (!open) {
                setCreateConfirmOpen(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                Novo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6"
              onOpenAutoFocus={event => event.preventDefault()}
            >
              <DialogHeader className="space-y-3 pb-2">
                <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">Criar Usuario</DialogTitle>
                <DialogDescription className="text-slate-600">
                  Crie contas de cliente, corretor ou admin.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Nome</Label>
                  <Input
                    id="create-name"
                    className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                    value={createForm.name}
                    onChange={event =>
                      setCreateForm(current => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-cpf">CPF</Label>
                  <Input
                    id="create-cpf"
                    className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                    value={createForm.cpf}
                    inputMode="numeric"
                    maxLength={14}
                    onChange={event =>
                      setCreateForm(current => ({ ...current, cpf: formatCpf(event.target.value) }))
                    }
                  />
                </div>
                {leadLinkPreview ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <div className="space-y-1">
                        <p className="font-medium">
                          Esse usuario ja e um lead e sera vinculado automaticamente.
                        </p>
                        <p>
                          Interesse anterior: {formatLeadInterest(leadLinkPreview.latestInterest)}
                        </p>
                        <p>
                          Origem: {leadLinkPreview.latestOrigin || "Nao informada"} â€¢{" "}
                          {leadLinkPreview.leadCount} lead(s)
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="create-email">E-mail</Label>
                  <Input
                    id="create-email"
                    type="email"
                    className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                    value={createForm.email}
                    onChange={event =>
                      setCreateForm(current => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Senha</Label>
                  <Input
                    id="create-password"
                    type="password"
                    minLength={8}
                    className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                    value={createForm.password}
                    onChange={event =>
                      setCreateForm(current => ({ ...current, password: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={value =>
                      setCreateForm(current => ({
                        ...current,
                        role: value as AppRole,
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="corretor">Corretor</SelectItem>
                      <SelectItem value="administrativo">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {createForm.role === "corretor" ? (
                  <div className="space-y-2">
                    <Label htmlFor="create-creci">CRECI</Label>
                    <Input
                      id="create-creci"
                      className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                      value={createForm.creci}
                      inputMode="text"
                      maxLength={10}
                      placeholder="123456/SP"
                      onChange={event =>
                        setCreateForm(current => ({
                          ...current,
                          creci: formatCreci(event.target.value),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Cadastro feito por admin entra como validado automaticamente.
                    </p>
                  </div>
                ) : null}
                <Button
                  className="w-full rounded-full bg-emerald-700 text-white shadow-[0_18px_40px_-28px_rgba(4,120,87,0.75)] hover:bg-emerald-800"
                  disabled={createUser.isPending}
                  onClick={() => submitCreateUser(false)}
                >
                  {createUser.isPending ? "Criando..." : "Criar usuario"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => {
            const isSelected = selectedFilter === card.key;

            return (
              <Card
                key={card.key}
                className={`min-h-[124px] cursor-pointer rounded-[28px] border-white/70 bg-white/90 transition-all hover:shadow-[0_30px_90px_-42px_rgba(15,23,42,0.52)] ${
                  isSelected
                    ? "ring-2 ring-emerald-700/35 shadow-[0_30px_90px_-42px_rgba(15,23,42,0.52)]"
                    : "shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]"
                }`}
                onClick={() =>
                  setSelectedFilter(current => (current === card.key ? null : card.key))
                }
              >
                <CardHeader className="px-6 pt-5 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">{card.label}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5 pt-0 text-3xl font-bold tracking-tight text-slate-950">
                  {card.value}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-1 text-xl text-slate-950">
                  <UserRound className="h-5 w-5" />
                  Todos os Usuarios
                </CardTitle>
                <CardDescription className="mt-2 text-slate-600">
                  Gerencie informacoes e permissoes de qualquer cadastro, mesmo que inativo.
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Abrir acoes da lista de usuarios">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={markAllNewUsersAsViewed.isPending}
                    onClick={() => markAllNewUsersAsViewed.mutate()}
                  >
                    Marcar todos cadastros novos como vistos ({newUsersCount})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4 lg:max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Pesquisar por ID, nome, e-mail, papel, status ou ultimo login"
                className="h-11 rounded-2xl border-slate-200 bg-white/90 pl-9 text-sm shadow-sm sm:text-base"
              />
            </div>

            {selectedFilter === "cliente" ? (
              <div className="mb-4 flex items-center gap-3">
                <Checkbox
                  id="clientes-com-contratos"
                  checked={showClientsWithContracts}
                  onCheckedChange={checked => setShowClientsWithContracts(checked === true)}
                />
                <Label
                  htmlFor="clientes-com-contratos"
                  className="cursor-pointer text-sm font-medium"
                >
                  Clientes com contratos
                </Label>
              </div>
            ) : null}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(item => (
                  <div key={item} className="h-12 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ultimo login</TableHead>
                      <TableHead className="w-28">Ficha</TableHead>
                      <TableHead className="w-44">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(user => {
                      const isBootstrapAdmin =
                        user.role === "administrativo" && user.registrationSource === "bootstrap";
                      const actingIsRootAdmin =
                        authenticatedUser?.role === "administrativo" &&
                        authenticatedUser?.registrationSource === "bootstrap";
                      const canChangeRootPassword =
                        isBootstrapAdmin &&
                        actingIsRootAdmin &&
                        authenticatedUser?.id === user.id;
                      const canEditAdminTarget =
                        user.role !== "administrativo" ||
                        actingIsRootAdmin ||
                        authenticatedUser?.id === user.id;

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {user.role === "administrativo" ? (
                                <Shield
                                  className={`h-4 w-4 ${
                                    isBootstrapAdmin
                                      ? "fill-black text-black"
                                      : "text-slate-700"
                                  }`}
                                />
                              ) : null}
                              <span>{user.name || "-"}</span>
                              {user.role === "corretor" && user.creci && user.creciStatus === "verified" ? (
                                <button
                                  type="button"
                                  className="inline-flex text-emerald-600"
                                  title={getCreciStatusMessage(user.creciStatus)}
                                  onClick={() => toast.info(getCreciStatusMessage(user.creciStatus))}
                                >
                                  <BadgeCheck className="h-4 w-4" />
                                </button>
                              ) : user.role === "corretor" && user.creci && user.creciStatus === "pending" ? (
                                <button
                                  type="button"
                                  className="inline-flex text-amber-500"
                                  title={getCreciStatusMessage(user.creciStatus)}
                                  onClick={() => toast.info(getCreciStatusMessage(user.creciStatus))}
                                >
                                  <Clock3 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{user.email || "-"}</TableCell>
                          <TableCell>{isBootstrapAdmin ? "-" : ROLE_LABELS[user.role]}</TableCell>
                          <TableCell>{isBootstrapAdmin ? "-" : user.isActive === 1 ? "Ativo" : "Inativo"}</TableCell>
                          <TableCell>
                            {user.isNewForAdmin ? (
                              <span className="inline-flex items-center rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                                Novo
                              </span>
                            ) : (
                              formatDate(user.lastSignedIn)
                            )}
                          </TableCell>
                          <TableCell>
                            {isBootstrapAdmin ? (
                              <span className="text-xs font-medium text-muted-foreground">
                                -
                              </span>
                            ) : (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/admin/users/${user.id}`}>
                                  <a>Ver ficha</a>
                                </Link>
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {canChangeRootPassword ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() =>
                                    setEditState({
                                      id: user.id,
                                      name: user.name || "",
                                      role: user.role,
                                      isActive: String(user.isActive) as "0" | "1",
                                      password: "",
                                      passwordOnly: true,
                                    })
                                  }
                                >
                                  <UserCog className="h-4 w-4" />
                                  Editar
                                </Button>
                              ) : isBootstrapAdmin ? (
                                <span className="text-xs font-medium text-muted-foreground">
                                  -
                                </span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => {
                                    if (!canEditAdminTarget) {
                                      toast.error(
                                        "Apenas o proprio administrador ou o admin principal podem editar contas administrativas."
                                      );
                                      return;
                                    }

                                    setEditState({
                                      id: user.id,
                                      name: user.name || "",
                                      role: user.role,
                                      isActive: String(user.isActive) as "0" | "1",
                                      password: "",
                                      passwordOnly: false,
                                    });
                                  }}
                                >
                                  <UserCog className="h-4 w-4" />
                                  Editar
                                </Button>
                              )}
                              {isBootstrapAdmin ? null : (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700"
                                  aria-label="Excluir usuario"
                                  onClick={() =>
                                    setDeleteState({
                                      userId: user.id,
                                      deleteLinkedLeads: false,
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-slate-600">
                Nenhum usuario encontrado para o filtro atual.
              </p>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(editState)} onOpenChange={open => !open && setEditState(null)}>
            <DialogContent
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6"
              onOpenAutoFocus={event => event.preventDefault()}
            >
              <DialogHeader className="space-y-3 pb-2">
                <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                  {editState?.passwordOnly ? "Trocar senha do Administrador" : "Editar Usuario"}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  {editState?.passwordOnly
                    ? "Para o admin principal, somente a senha pode ser alterada."
                    : "Atualize papel, status e senha quando necessario."}
                </DialogDescription>
              </DialogHeader>

              {editState && (
              <div className="space-y-5">
                {editState.passwordOnly ? null : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Nome</Label>
                      <Input
                        id="edit-name"
                        className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                        value={editState.name}
                        onChange={event =>
                          setEditState(current =>
                            current
                              ? { ...current, name: event.target.value }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Papel</Label>
                      <Select
                        value={editState.role}
                        onValueChange={value =>
                          setEditState(current =>
                            current
                              ? { ...current, role: value as EditableRole }
                              : current
                          )
                        }
                      >
                        <SelectTrigger className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cliente">Cliente</SelectItem>
                          <SelectItem value="corretor">Corretor</SelectItem>
                          <SelectItem value="administrativo">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={editState.isActive}
                        onValueChange={value =>
                          setEditState(current =>
                            current
                              ? { ...current, isActive: value as "0" | "1" }
                              : current
                          )
                        }
                      >
                        <SelectTrigger className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Ativo</SelectItem>
                          <SelectItem value="0">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Nova senha</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    minLength={8}
                    placeholder="Deixe em branco para manter"
                    className="rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                    value={editState.password}
                    onChange={event =>
                      setEditState(current =>
                        current
                          ? { ...current, password: event.target.value }
                          : current
                      )
                    }
                  />
                </div>
                <Button
                  className="w-full rounded-full bg-emerald-700 text-white shadow-[0_18px_40px_-28px_rgba(4,120,87,0.75)] hover:bg-emerald-800"
                  disabled={updateUser.isPending}
                  onClick={() => {
                    if (editState.passwordOnly && !editState.password) {
                      toast.error("Informe a nova senha para continuar.");
                      return;
                    }

                    updateUser.mutate(
                      editState.passwordOnly
                        ? {
                            id: editState.id,
                            password: editState.password,
                          }
                        : {
                            id: editState.id,
                            name: editState.name || undefined,
                            role: editState.role,
                            isActive: Number(editState.isActive) as 0 | 1,
                            password: editState.password || undefined,
                          }
                    );
                  }}
                >
                  {updateUser.isPending ? "Salvando..." : "Salvar alteracoes"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={createConfirmOpen} onOpenChange={setCreateConfirmOpen}>
          <AlertDialogContent className="rounded-[32px] border-white/80 bg-[#f7f6f2] shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">Confirmar vinculacao com lead existente?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                {leadLinkPreview
                  ? `Esse usuario ja e um lead e tem interesse em: ${formatLeadInterest(leadLinkPreview.latestInterest)}. O sistema vinculara o acesso de usuario ao lead.`
                  : "Nao ha lead para vincular."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Voltar</AlertDialogCancel>
              <AlertDialogAction className="rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={() => submitCreateUser(true)}>
                Confirmar e criar usuario
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={deleteState !== null} onOpenChange={open => !open && setDeleteState(null)}>
          <DialogContent
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6"
            onOpenAutoFocus={event => event.preventDefault()}
          >
            <DialogHeader className="space-y-3 pb-2">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                {deletePreview?.mode === "revoke_access"
                  ? deletePreview.isSelf
                    ? "Voce ira excluir o proprio acesso de usuario?"
                    : "Revogar acesso deste administrador?"
                  : "Excluir usuario?"}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                {deletePreview?.mode === "revoke_access"
                  ? "Os dados do perfil permanecerao no sistema. Apenas o acesso sera removido."
                  : "A exclusao remove o cadastro de acesso do sistema. Se houver lead vinculado, voce pode manter ou apagar esse historico comercial."}
              </DialogDescription>
            </DialogHeader>

            {deletePreviewLoading ? (
              <div className="space-y-3">
                {[1, 2].map(item => (
                  <div key={item} className="h-16 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : deletePreviewError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {deletePreviewError.message}
              </div>
            ) : deletePreview ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/80 bg-white/90 p-4 text-sm shadow-sm">
                  <p><strong>Usuario:</strong> {deletePreview.user.name || "Sem nome"}</p>
                  <p><strong>E-mail:</strong> {deletePreview.user.email || "Nao informado"}</p>
                  <p><strong>Papel:</strong> {ROLE_LABELS[deletePreview.user.role]}</p>
                  <p><strong>Status:</strong> {deletePreview.user.isActive === 1 ? "Ativo" : "Inativo"}</p>
                </div>

                {isProtectedRootAdmin ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    O admin principal do sistema e protegido e nao pode ser excluido.
                  </div>
                ) : null}

                {deletePreview.linkedLeads.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Lead(s) vinculado(s)</p>
                      <p className="text-sm text-muted-foreground">
                        Encontramos {deletePreview.linkedLeads.length} lead(s) ligado(s) a este usuario.
                      </p>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm">
                      {deletePreview.linkedLeads.map(lead => (
                        <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                          <p><strong>Lead #{lead.id}:</strong> {lead.nome}</p>
                          <p><strong>Interesse:</strong> {formatLeadInterest(lead.interesse)}</p>
                          <p><strong>Origem:</strong> {lead.origem || "Nao informada"}</p>
                          <p><strong>Status:</strong> {lead.status}</p>
                        </div>
                      ))}
                    </div>
                    {deletePreview.mode === "delete_user" ? (
                      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <Checkbox
                          id="delete-linked-leads"
                          checked={deleteState?.deleteLinkedLeads === true}
                          onCheckedChange={checked =>
                            setDeleteState(current =>
                              current
                                ? { ...current, deleteLinkedLeads: checked === true }
                                : current
                            )
                          }
                        />
                        <div className="space-y-1">
                          <Label htmlFor="delete-linked-leads" className="cursor-pointer font-medium">
                            Apagar o lead junto com o usuario
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Se esta opcao ficar desmarcada, o lead sera mantido no CRM e apenas perdera o vinculo com o usuario.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeleteState(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deleteUser.isPending || isProtectedRootAdmin}
                    onClick={() =>
                      deleteUser.mutate({
                        userId: deleteState?.userId ?? 0,
                        deleteLinkedLeads: deleteState?.deleteLinkedLeads === true,
                      })
                    }
                  >
                    {deleteUser.isPending
                      ? "Processando..."
                      : deletePreview.mode === "revoke_access"
                        ? "Confirmar revogacao"
                        : "Confirmar exclusao"}
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </Layout>
  );
}

