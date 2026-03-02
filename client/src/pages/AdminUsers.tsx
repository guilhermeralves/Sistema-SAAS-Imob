import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS, type AppRole } from "@shared/auth";
import { Plus, Search, Shield, UserCog } from "lucide-react";
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
} | null;

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

function formatCpf(value: string | null | undefined) {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export default function AdminUsers() {
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [editState, setEditState] = useState<EditState>(null);
  const [selectedFilter, setSelectedFilter] = useState<UserFilter | null>(null);
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    cpf: "",
    email: "",
    password: "",
    role: "corretor" as AppRole,
  });

  const { data: users, isLoading } = trpc.admin.users.useQuery();

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: async () => {
      toast.success("Usuario criado com sucesso");
      setCreateOpen(false);
      setCreateForm({ name: "", cpf: "", email: "", password: "", role: "corretor" });
      await utils.admin.users.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel criar o usuario");
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

  const sortedUsers = useMemo(() => {
    return [...(users ?? [])].sort((left, right) => {
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
          user.name || "",
          user.email || "",
          formatCpf(user.cpf),
          ROLE_LABELS[user.role],
          user.role,
          user.isActive === 1 ? "ativo" : "inativo",
          formatDate(user.lastSignedIn),
        ];

        return searchableValues.some(value =>
          value.toLowerCase().includes(normalizedSearch)
        );
      });
  }, [search, selectedFilter, sortedUsers]);

  const cards: Array<{ key: UserFilter; label: string; value: number }> = [
    { key: "all", label: "Todos os Cadastros", value: users?.length ?? 0 },
    { key: "active", label: "Cadastros Ativos", value: activeCount },
    { key: "corretor", label: "Corretores", value: corretorCount },
    { key: "cliente", label: "Clientes", value: clienteCount },
  ];

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Usuarios</h1>
            <p className="text-muted-foreground">
              Gerencie usuarios, ajuste permissoes e desative contas.
            </p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent
              className="sm:max-w-md lg:max-w-xl"
              onOpenAutoFocus={event => event.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Criar Usuario</DialogTitle>
                <DialogDescription>
                  Crie contas de cliente, corretor ou admin.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Nome</Label>
                  <Input
                    id="create-name"
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
                    value={createForm.cpf}
                    onChange={event =>
                      setCreateForm(current => ({ ...current, cpf: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">E-mail</Label>
                  <Input
                    id="create-email"
                    type="email"
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="corretor">Corretor</SelectItem>
                      <SelectItem value="administrativo">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={createUser.isPending}
                  onClick={() =>
                    createUser.mutate({
                      name: createForm.name,
                      cpf: createForm.cpf,
                      email: createForm.email,
                      password: createForm.password,
                      role: createForm.role,
                    })
                  }
                >
                  {createUser.isPending ? "Criando..." : "Criar usuario"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => {
            const isSelected = selectedFilter === card.key;

            return (
              <Card
                key={card.key}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? "ring-2 ring-primary shadow-md" : ""
                }`}
                onClick={() =>
                  setSelectedFilter(current => (current === card.key ? null : card.key))
                }
              >
                <CardHeader className="px-6 pt-4 pb-1 md:pb-2">
                  <CardTitle className="text-sm">{card.label}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-4 pt-0 md:pb-6 text-2xl font-bold">
                  {card.value}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Lista de todos os usuarios
            </CardTitle>
            <CardDescription>
              Gerencie informacoes e permissoes de qualquer cadastro, mesmo que inativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4 lg:max-w-xl">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Pesquisar por nome, e-mail, papel, status ou ultimo login"
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(item => (
                  <div key={item} className="h-12 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ultimo login</TableHead>
                      <TableHead className="w-28">Ficha</TableHead>
                      <TableHead className="w-32">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>{user.name || "-"}</TableCell>
                        <TableCell>{user.email || "-"}</TableCell>
                        <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                        <TableCell>{user.isActive === 1 ? "Ativo" : "Inativo"}</TableCell>
                        <TableCell>{formatDate(user.lastSignedIn)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/users/${user.id}`}>
                              <a>Ver ficha</a>
                            </Link>
                          </Button>
                        </TableCell>
                        <TableCell>
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
                              })
                            }
                          >
                            <UserCog className="h-4 w-4" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Nenhum usuario encontrado para o filtro atual.
              </p>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(editState)} onOpenChange={open => !open && setEditState(null)}>
          <DialogContent
            className="sm:max-w-md lg:max-w-xl"
            onOpenAutoFocus={event => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Atualize papel, status e senha quando necessario.
              </DialogDescription>
            </DialogHeader>

            {editState && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
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
                    <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Ativo</SelectItem>
                      <SelectItem value="0">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Nova senha</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    minLength={8}
                    placeholder="Deixe em branco para manter"
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
                  className="w-full"
                  disabled={updateUser.isPending}
                  onClick={() =>
                    updateUser.mutate({
                      id: editState.id,
                      name: editState.name || undefined,
                      role: editState.role,
                      isActive: Number(editState.isActive) as 0 | 1,
                      password: editState.password || undefined,
                    })
                  }
                >
                  {updateUser.isPending ? "Salvando..." : "Salvar alteracoes"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
