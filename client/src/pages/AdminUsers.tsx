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
import { Plus, Shield, UserCog } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type EditableRole = AppRole;

type EditState = {
  id: number;
  name: string;
  role: EditableRole;
  isActive: "0" | "1";
  password: string;
} | null;

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function AdminUsers() {
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [editState, setEditState] = useState<EditState>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "corretor" as "corretor" | "administrativo",
  });

  const { data: users, isLoading } = trpc.admin.users.useQuery();

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: async () => {
      toast.success("Usuário criado com sucesso");
      setCreateOpen(false);
      setCreateForm({ name: "", email: "", password: "", role: "corretor" });
      await utils.admin.users.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Não foi possível criar o usuário");
    },
  });

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: async () => {
      toast.success("Usuário atualizado com sucesso");
      setEditState(null);
      await utils.admin.users.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Não foi possível atualizar o usuário");
    },
  });

  const staffCount = useMemo(
    () => users?.filter(user => user.role !== "cliente" && user.isActive === 1).length ?? 0,
    [users]
  );

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Usuários</h1>
            <p className="text-muted-foreground">
              Crie ADMIN/CORRETOR, ajuste papel e desative contas.
            </p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Usuário</DialogTitle>
                <DialogDescription>
                  Esta tela cria apenas contas de staff.
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
                        role: value as "corretor" | "administrativo",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                      name: createForm.name || undefined,
                      email: createForm.email,
                      password: createForm.password,
                      role: createForm.role,
                    })
                  }
                >
                  {createUser.isPending ? "Criando..." : "Criar usuário"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total de Usuários</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {users?.length ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Staff Ativo</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {staffCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Clientes</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {users?.filter(user => user.role === "cliente").length ?? 0}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Gestão de Acesso
            </CardTitle>
            <CardDescription>
              Ajuste papel e status das contas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(item => (
                  <div key={item} className="h-12 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : users && users.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Último login</TableHead>
                      <TableHead className="w-32">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>{user.name || "—"}</TableCell>
                        <TableCell>{user.email || "—"}</TableCell>
                        <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                        <TableCell>{user.isActive === 1 ? "Ativo" : "Inativo"}</TableCell>
                        <TableCell>{formatDate(user.lastSignedIn)}</TableCell>
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
              <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(editState)} onOpenChange={open => !open && setEditState(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize papel, status e senha quando necessário.
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
                  {updateUser.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
