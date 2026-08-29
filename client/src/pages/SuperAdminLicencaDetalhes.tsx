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
import { formatStoredDate } from "@/lib/date";
import { lookupCep } from "@/lib/cep";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function tenantDraftKey(tenantId: number) {
  return `super-admin:tenant:${tenantId}:tenant-draft`;
}

function licenseDraftKey(tenantId: number) {
  return `super-admin:tenant:${tenantId}:license-draft`;
}

function safeLoadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSaveDraft(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage indisponível (modo privado, quota) — ignore
  }
}

function safeClearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function centavosToBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function reaisToCents(v: string) {
  const cents = Math.round(
    parseFloat(v.replace(/\./g, "").replace(",", ".")) * 100
  );
  return Number.isFinite(cents) ? cents : 0;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: {
      label: "Ativa",
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    },
    grace: {
      label: "Carência",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    },
    readonly: {
      label: "Somente leitura",
      className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    },
    suspended: {
      label: "Suspensa",
      className:
        "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    },
  };
  const s = map[status] ?? {
    label: status,
    className: "bg-zinc-100 text-zinc-800",
  };
  return <Badge className={s.className}>{s.label}</Badge>;
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
  const [valor, setValor] = useState(
    (valorSugerido / 100).toFixed(2).replace(".", ",")
  );
  const [meses, setMeses] = useState(1);
  const [obs, setObs] = useState("");

  const pagar = trpc.licencas.superAdmin.marcarPago.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado.");
      setOpen(false);
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Registrar pagamento
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
            <Input value={valor} onChange={e => setValor(e.target.value)} />
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
            <Input value={obs} onChange={e => setObs(e.target.value)} />
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
          <Button
            onClick={() =>
              pagar.mutate({
                tenantId,
                valorCentavos: reaisToCents(valor),
                meses,
                observacao: obs.trim() || undefined,
              })
            }
            disabled={pagar.isPending}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SuperAdminLicencaDetalhes() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const tenantId = Number(params.tenantId);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.licencas.superAdmin.obter.useQuery(
    { tenantId },
    { enabled: Number.isFinite(tenantId) }
  );
  const { data: pagamentos } = trpc.licencas.superAdmin.pagamentos.useQuery(
    { tenantId },
    { enabled: Number.isFinite(tenantId) }
  );

  const [editTenant, setEditTenant] = useState({
    nome: "",
    email: "",
    telefone: "",
    cnpj: "",
    creciPj: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });
  const [cepLoading, setCepLoading] = useState(false);
  const hydratedRef = useRef<number | null>(null);
  const [editLicense, setEditLicense] = useState({
    valorReais: "0,00",
    gracePeriodDays: 7,
  });

  useEffect(() => {
    if (!data?.tenant) return;
    if (hydratedRef.current === tenantId) return;
    hydratedRef.current = tenantId;

    const tenantDraft = safeLoadDraft<typeof editTenant>(
      tenantDraftKey(tenantId)
    );
    if (tenantDraft) {
      setEditTenant(tenantDraft);
    } else {
      setEditTenant({
        nome: data.tenant.nome ?? "",
        email: data.tenant.email ?? "",
        telefone: data.tenant.telefone ?? "",
        cnpj: data.tenant.cnpj ?? "",
        creciPj: data.tenant.creciPj ?? "",
        cep: data.tenant.cep ?? "",
        endereco: data.tenant.endereco ?? "",
        numero: data.tenant.numero ?? "",
        complemento: data.tenant.complemento ?? "",
        bairro: data.tenant.bairro ?? "",
        cidade: data.tenant.cidade ?? "",
        estado: data.tenant.estado ?? "",
      });
    }

    if (data.license) {
      const licenseDraft = safeLoadDraft<typeof editLicense>(
        licenseDraftKey(tenantId)
      );
      if (licenseDraft) {
        setEditLicense(licenseDraft);
      } else {
        setEditLicense({
          valorReais: (data.license.valorCentavos / 100)
            .toFixed(2)
            .replace(".", ","),
          gracePeriodDays: data.license.gracePeriodDays,
        });
      }
    }
  }, [data?.tenant, data?.license, tenantId]);

  useEffect(() => {
    if (hydratedRef.current !== tenantId) return;
    safeSaveDraft(tenantDraftKey(tenantId), editTenant);
  }, [editTenant, tenantId]);

  useEffect(() => {
    if (hydratedRef.current !== tenantId) return;
    safeSaveDraft(licenseDraftKey(tenantId), editLicense);
  }, [editLicense, tenantId]);

  const refetch = () => {
    utils.licencas.superAdmin.obter.invalidate({ tenantId });
    utils.licencas.superAdmin.pagamentos.invalidate({ tenantId });
    utils.licencas.superAdmin.listar.invalidate();
  };

  const salvarTenant = trpc.licencas.superAdmin.atualizarTenant.useMutation({
    onSuccess: () => {
      toast.success("Dados da imobiliária atualizados.");
      safeClearDraft(tenantDraftKey(tenantId));
      refetch();
    },
    onError: e => toast.error(e.message),
  });
  const salvarLicenca = trpc.licencas.superAdmin.atualizarLicenca.useMutation({
    onSuccess: () => {
      toast.success("Licença atualizada.");
      safeClearDraft(licenseDraftKey(tenantId));
      refetch();
    },
    onError: e => toast.error(e.message),
  });
  const suspender = trpc.licencas.superAdmin.suspender.useMutation({
    onSuccess: () => {
      toast.success("Licença suspensa.");
      refetch();
    },
    onError: e => toast.error(e.message),
  });
  const reativar = trpc.licencas.superAdmin.reativar.useMutation({
    onSuccess: () => {
      toast.success("Licença reativada.");
      refetch();
    },
    onError: e => toast.error(e.message),
  });
  const inativar = trpc.licencas.superAdmin.inativar.useMutation({
    onSuccess: () => {
      toast.success("Licença inativada.");
      safeClearDraft(tenantDraftKey(tenantId));
      safeClearDraft(licenseDraftKey(tenantId));
      setLocation("/super-admin/licencas");
    },
    onError: e => toast.error(e.message),
  });
  const reativarTenant = trpc.licencas.superAdmin.reativarTenant.useMutation({
    onSuccess: () => {
      toast.success("Imobiliária reativada.");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const handleCepBlur = async () => {
    const digits = editTenant.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const result = await lookupCep(digits);
      if (result.status === "success") {
        setEditTenant(s => ({
          ...s,
          endereco: result.data.endereco || s.endereco,
          bairro: result.data.bairro || s.bairro,
          cidade: result.data.cidade || s.cidade,
          estado: result.data.estado || s.estado,
        }));
      } else if (result.status === "not_found") {
        toast.error("CEP não encontrado.");
      } else {
        toast.error("Serviço de CEP indisponível.");
      }
    } finally {
      setCepLoading(false);
    }
  };

  function formatActivationDuration(days: number) {
    if (days <= 0) return "Menos de 1 dia";
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const rest = (days % 365) % 30;
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ano${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} m${months > 1 ? "eses" : "ês"}`);
    if (rest > 0 && years === 0)
      parts.push(`${rest} dia${rest > 1 ? "s" : ""}`);
    return parts.join(", ") || `${days} dias`;
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-5xl p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      </Layout>
    );
  }

  if (!data || !data.tenant) {
    return (
      <Layout>
        <div className="mx-auto max-w-5xl p-6">
          <p className="text-sm text-muted-foreground">
            Imobiliária não encontrada.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/super-admin/licencas")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  const t = data.tenant;
  const l = data.license;

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link href="/super-admin/licencas">
              <a className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Voltar às licenças
              </a>
            </Link>
            <h1 className="mt-1 text-2xl font-bold">{t.nome}</h1>
            <p className="text-sm text-muted-foreground">
              Slug: /{t.slug}
              {t.cidade ? ` · ${t.cidade}` : ""}
              {t.estado ? `/${t.estado}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {l ? <StatusBadge status={data.effectiveStatus ?? l.status} /> : null}
            {t.isActive === 1 && l ? (
              <PagamentoDialog
                tenantId={tenantId}
                valorSugerido={l.valorCentavos}
                onDone={refetch}
              />
            ) : null}
            {t.isActive === 1 ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                    title="Inativar licença"
                    aria-label="Inativar licença"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      Inativar licença de {t.nome}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      O registro fica no banco (soft-delete). Para vê-lo, use
                      o filtro "Mostrar inativas" na lista. Não é possível
                      operar o sistema enquanto a licença está inativada.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => inativar.mutate({ tenantId })}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Inativar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                onClick={() => reativarTenant.mutate({ tenantId })}
                disabled={reativarTenant.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Reativar imobiliária
              </Button>
            )}
          </div>
        </div>

        {l ? (
          <Card>
            <CardHeader>
              <CardTitle>Resumo da licença</CardTitle>
              <CardDescription>
                Estado atual e datas de referência.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <StatusBadge status={data.effectiveStatus ?? l.status} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Vencimento
                  </div>
                  <div className="mt-1 font-medium">
                    {formatStoredDate(l.dueDate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dias</div>
                  <div className="mt-1 font-medium">
                    {(data.effectiveStatus ?? l.status) === "active"
                      ? `Vence em ${data.daysUntilDue ?? "-"}d`
                      : (data.effectiveStatus ?? l.status) === "suspended"
                        ? "—"
                        : `Vencida há ${data.daysOverdue ?? "-"}d`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Valor mensal
                  </div>
                  <div className="mt-1 font-medium">
                    {centavosToBRL(l.valorCentavos)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Carência</div>
                  <div className="mt-1 font-medium">
                    {l.gracePeriodDays} dias
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Último pagamento
                  </div>
                  <div className="mt-1 font-medium">
                    {l.lastPaidAt
                      ? new Date(l.lastPaidAt).toLocaleString("pt-BR")
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Primeiro pagamento
                  </div>
                  <div className="mt-1 font-medium">
                    {data.firstPaidAt
                      ? new Date(data.firstPaidAt).toLocaleDateString("pt-BR")
                      : "Sem pagamentos ainda"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Tempo de licença
                  </div>
                  <div className="mt-1 font-medium">
                    {formatActivationDuration(data.activationDays ?? 0)}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {(data.effectiveStatus ?? l.status) === "suspended" ? (
                  <Button
                    variant="outline"
                    onClick={() => reativar.mutate({ tenantId })}
                    disabled={reativar.isPending}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" /> Reativar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => suspender.mutate({ tenantId })}
                    disabled={suspender.isPending}
                  >
                    <PauseCircle className="mr-2 h-4 w-4" /> Suspender
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Dados da imobiliária</CardTitle>
            <CardDescription>
              Informações cadastrais do cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editTenant.nome}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, nome: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={editTenant.cnpj}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, cnpj: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>CRECI-PJ</Label>
                <Input
                  value={editTenant.creciPj}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, creciPj: e.target.value }))
                  }
                  placeholder="ex: J-56842"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  value={editTenant.email}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={editTenant.telefone}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, telefone: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>
                  CEP
                  {cepLoading ? (
                    <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
                  ) : null}
                </Label>
                <Input
                  value={editTenant.cep}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, cep: e.target.value }))
                  }
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço</Label>
                <Input
                  value={editTenant.endereco}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, endereco: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Número</Label>
                <Input
                  value={editTenant.numero}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, numero: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input
                  value={editTenant.complemento}
                  onChange={e =>
                    setEditTenant(s => ({
                      ...s,
                      complemento: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input
                  value={editTenant.bairro}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, bairro: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={editTenant.cidade}
                  onChange={e =>
                    setEditTenant(s => ({ ...s, cidade: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  maxLength={2}
                  value={editTenant.estado}
                  onChange={e =>
                    setEditTenant(s => ({
                      ...s,
                      estado: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  salvarTenant.mutate({
                    tenantId,
                    nome: editTenant.nome,
                    cnpj: editTenant.cnpj || null,
                    creciPj: editTenant.creciPj || null,
                    email: editTenant.email || null,
                    telefone: editTenant.telefone || null,
                    cep: editTenant.cep || null,
                    endereco: editTenant.endereco || null,
                    numero: editTenant.numero || null,
                    complemento: editTenant.complemento || null,
                    bairro: editTenant.bairro || null,
                    cidade: editTenant.cidade || null,
                    estado: editTenant.estado || null,
                  })
                }
                disabled={salvarTenant.isPending}
              >
                Salvar dados
              </Button>
            </div>
          </CardContent>
        </Card>

        {l ? (
          <Card>
            <CardHeader>
              <CardTitle>Configuração da licença</CardTitle>
              <CardDescription>
                Ajuste valor mensal e período de carência.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label>Valor mensal (R$)</Label>
                  <Input
                    value={editLicense.valorReais}
                    onChange={e =>
                      setEditLicense(s => ({
                        ...s,
                        valorReais: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Carência (dias)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={editLicense.gracePeriodDays}
                    onChange={e =>
                      setEditLicense(s => ({
                        ...s,
                        gracePeriodDays: parseInt(e.target.value || "0", 10),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() =>
                    salvarLicenca.mutate({
                      tenantId,
                      valorCentavos: reaisToCents(editLicense.valorReais),
                      gracePeriodDays: editLicense.gracePeriodDays,
                    })
                  }
                  disabled={salvarLicenca.isPending}
                >
                  Salvar licença
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Histórico de pagamentos</CardTitle>
            <CardDescription>
              Registros feitos por super-admins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pagamentos ?? []).map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {new Date(p.paidAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>{centavosToBRL(p.valorCentavos)}</TableCell>
                      <TableCell>
                        {formatStoredDate(p.competenciaDe)} →{" "}
                        {formatStoredDate(p.competenciaAte)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {p.observacao ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(pagamentos ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        Nenhum pagamento registrado.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
