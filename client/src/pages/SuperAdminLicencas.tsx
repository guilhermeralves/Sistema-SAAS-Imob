import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { formatStoredDate } from "@/lib/date";
import { AlertCircle, CheckCircle2, PauseCircle, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function centavosToBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; className: string }
  > = {
    active: {
      label: "Ativa",
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    },
    grace: {
      label: "Carência",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    },
    readonly: {
      label: "Leitura",
      className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    },
    suspended: {
      label: "Suspensa",
      className: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    },
  };
  const s = map[status] ?? {
    label: status,
    className: "bg-zinc-100 text-zinc-800",
  };
  return <Badge className={s.className}>{s.label}</Badge>;
}

function NovoTenantDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    nome: "",
    email: "",
    telefone: "",
    cidade: "",
    estado: "",
    valorMensalReais: "199,00",
    gracePeriodDays: 7,
  });

  const criar = trpc.licencas.superAdmin.criarTenant.useMutation({
    onSuccess: () => {
      toast.success("Imobiliária cadastrada.");
      setOpen(false);
      setForm({
        slug: "",
        nome: "",
        email: "",
        telefone: "",
        cidade: "",
        estado: "",
        valorMensalReais: "199,00",
        gracePeriodDays: 7,
      });
      onCreated();
    },
    onError: e => toast.error(e.message),
  });

  const handleSubmit = () => {
    const cents = Math.round(
      parseFloat(form.valorMensalReais.replace(/\./g, "").replace(",", ".")) *
        100
    );
    criar.mutate({
      slug: form.slug.trim().toLowerCase(),
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim().toUpperCase() || null,
      valorMensalCentavos: Number.isFinite(cents) ? cents : 0,
      gracePeriodDays: form.gracePeriodDays,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nova imobiliária
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova imobiliária (tenant)</DialogTitle>
          <DialogDescription>
            Uma licença ativa é criada automaticamente com vencimento em 30
            dias.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Slug (identificador único)</Label>
            <Input
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="ex: minha-imobiliaria"
            />
          </div>
          <div>
            <Label>Nome</Label>
            <Input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>E-mail</Label>
              <Input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={e =>
                  setForm(f => ({ ...f, telefone: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
              />
            </div>
            <div>
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor mensal (R$)</Label>
              <Input
                value={form.valorMensalReais}
                onChange={e =>
                  setForm(f => ({ ...f, valorMensalReais: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Carência (dias)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={form.gracePeriodDays}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    gracePeriodDays: parseInt(e.target.value || "0", 10),
                  }))
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={criar.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              criar.isPending || !form.slug.trim() || !form.nome.trim()
            }
          >
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagamentoDialog({
  tenantId,
  valorSugerido,
  onDone,
}: {
  tenantId: number;
  valorSugerido: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [valorReais, setValorReais] = useState(
    (valorSugerido / 100).toFixed(2).replace(".", ",")
  );
  const [meses, setMeses] = useState(1);
  const [observacao, setObservacao] = useState("");

  const pagar = trpc.licencas.superAdmin.marcarPago.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado.");
      setOpen(false);
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  const submit = () => {
    const cents = Math.round(
      parseFloat(valorReais.replace(/\./g, "").replace(",", ".")) * 100
    );
    pagar.mutate({
      tenantId,
      valorCentavos: Number.isFinite(cents) ? cents : 0,
      meses,
      observacao: observacao.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar pago
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Avança o vencimento em N meses (30 dias/mês) e reativa a licença.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Valor recebido (R$)</Label>
            <Input
              value={valorReais}
              onChange={e => setValorReais(e.target.value)}
            />
          </div>
          <div>
            <Label>Meses pagos</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={meses}
              onChange={e => setMeses(parseInt(e.target.value || "1", 10))}
            />
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Input
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pagar.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pagar.isPending}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SuperAdminLicencas() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.licencas.superAdmin.listar.useQuery();

  const suspender = trpc.licencas.superAdmin.suspender.useMutation({
    onSuccess: () => {
      toast.success("Licença suspensa.");
      utils.licencas.superAdmin.listar.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const reativar = trpc.licencas.superAdmin.reativar.useMutation({
    onSuccess: () => {
      toast.success("Licença reativada.");
      utils.licencas.superAdmin.listar.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const refetch = () => utils.licencas.superAdmin.listar.invalidate();

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Licenças (Super Admin)</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie as imobiliárias clientes e o status de pagamento da
              plataforma NOXILON.
            </p>
          </div>
          <NovoTenantDialog onCreated={refetch} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Imobiliárias</CardTitle>
            <CardDescription>
              Estado atual da licença de cada tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imobiliária</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Valor/mês</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data ?? []).map(row => {
                      if (!row || !row.license) return null;
                      const daysLabel =
                        row.effectiveStatus === "active"
                          ? `Vence em ${row.daysUntilDue}d`
                          : row.effectiveStatus === "suspended"
                            ? "—"
                            : `Vencida há ${row.daysOverdue}d`;
                      return (
                        <TableRow key={row.tenant.id}>
                          <TableCell>
                            <div className="font-medium">{row.tenant.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              /{row.tenant.slug}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.tenant.cidade ?? "—"}
                            {row.tenant.estado ? `/${row.tenant.estado}` : ""}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={row.effectiveStatus ?? "active"} />
                          </TableCell>
                          <TableCell>
                            {formatStoredDate(row.license.dueDate)}
                          </TableCell>
                          <TableCell>{daysLabel}</TableCell>
                          <TableCell>
                            {centavosToBRL(row.license.valorCentavos)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <PagamentoDialog
                                tenantId={row.tenant.id}
                                valorSugerido={row.license.valorCentavos}
                                onDone={refetch}
                              />
                              {row.effectiveStatus === "suspended" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    reativar.mutate({ tenantId: row.tenant.id })
                                  }
                                  disabled={reativar.isPending}
                                >
                                  <CheckCircle2 className="mr-1 h-4 w-4" />
                                  Reativar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    suspender.mutate({ tenantId: row.tenant.id })
                                  }
                                  disabled={suspender.isPending}
                                >
                                  <PauseCircle className="mr-1 h-4 w-4" />
                                  Suspender
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          <AlertCircle className="mx-auto mb-2 h-5 w-5" />
                          Nenhuma imobiliária cadastrada.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
