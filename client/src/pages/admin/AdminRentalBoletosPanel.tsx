import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { formatStoredDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getBoletoSetStatus,
  getBoletoTemporalStatus,
  RENTAL_BOLETO_TEMPORAL_STATUS_LABELS,
  type RentalBoletoTemporalStatus,
} from "@shared/rental-boletos";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Layers,
  Pencil,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

type RouterOutput = inferRouterOutputs<AppRouter>;
type BoletoSet = RouterOutput["rentalProposals"]["boletoSets"][number];
type Boleto = BoletoSet["boletos"][number];

const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

function formatCentsBRL(value: number | null | undefined) {
  return ((value ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCurrencyInput(value: number | null | undefined) {
  if (!value) return "";
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseCurrencyToCents(value: string) {
  const normalized = value.replace(/[^\d,]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function formatDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
}

function formatCompetenceMonth(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const label = date.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.replace(". de ", "/").replace(".", "");
}

const TEMPORAL_STATUS_BADGE_CLASS: Record<RentalBoletoTemporalStatus, string> = {
  pago: "bg-emerald-100 text-emerald-700",
  em_aberto: "bg-sky-100 text-sky-700",
  atrasado: "bg-amber-100 text-amber-800",
  vencido: "bg-rose-100 text-rose-700",
};

function TemporalStatusBadge({
  status,
}: {
  status: RentalBoletoTemporalStatus | null;
}) {
  if (!status) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        Sem boletos
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TEMPORAL_STATUS_BADGE_CLASS[status]}`}
    >
      {RENTAL_BOLETO_TEMPORAL_STATUS_LABELS[status]}
    </span>
  );
}

export default function AdminRentalBoletosPanel() {
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(
    null
  );
  const { data: sets, isLoading } = trpc.rentalProposals.boletoSets.useQuery();

  const selectedSet = useMemo(
    () => (sets ?? []).find(set => set.proposalId === selectedProposalId) ?? null,
    [sets, selectedProposalId]
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(item => (
          <div key={item} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (selectedProposalId && selectedSet) {
    return (
      <BoletoSetDetails
        set={selectedSet}
        onBack={() => setSelectedProposalId(null)}
      />
    );
  }

  if (!sets?.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-600">
        Nenhum conjunto de boletos gerado ainda. Os boletos aparecem aqui quando
        uma proposta de locação tem o cronograma gerado na etapa de boletos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sets.map(set => {
        const status = getBoletoSetStatus(set.boletos);
        const total = set.boletos.reduce(
          (sum, boleto) => sum + boleto.totalAmount,
          0
        );
        const approvedCount = set.boletos.filter(
          boleto => boleto.status === "aprovado"
        ).length;

        return (
          <div
            key={set.proposalId}
            className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    <Receipt className="h-3.5 w-3.5" />
                    {set.referenceCode || "Sem código"}
                  </span>
                  <TemporalStatusBadge status={status} />
                </div>
                <p className="mt-2 font-semibold text-slate-950">
                  {set.property?.titulo || `Imóvel ID ${set.property?.id ?? "-"}`}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Locatário:{" "}
                  {set.tenant?.name || set.tenant?.email || "Não informado"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {set.boletos.length} boleto(s) · {approvedCount} aprovado(s) ·
                  total {formatCentsBRL(total)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full bg-white px-4 text-xs font-semibold"
                  onClick={() => setSelectedProposalId(set.proposalId)}
                >
                  Detalhes
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoletoSetDetails({
  set,
  onBack,
}: {
  set: BoletoSet;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingBoleto, setEditingBoleto] = useState<Boleto | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const invalidate = async () => {
    await utils.rentalProposals.boletoSets.invalidate();
  };

  const updateBoleto = trpc.rentalProposals.updateBoleto.useMutation({
    onSuccess: async () => {
      toast.success("Boleto atualizado.");
      setEditingBoleto(null);
      await invalidate();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível atualizar o boleto."),
  });

  const updateBoletosBatch = trpc.rentalProposals.updateBoletosBatch.useMutation({
    onSuccess: async data => {
      toast.success(`${data.updated} boleto(s) atualizado(s) em lote.`);
      setBatchOpen(false);
      setSelectedIds(new Set());
      await invalidate();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível atualizar em lote."),
  });

  const approveBoleto = trpc.rentalProposals.approveBoleto.useMutation({
    onSuccess: async () => {
      toast.success("Boleto aprovado.");
      await invalidate();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível aprovar o boleto."),
  });

  const approveAllBoletos = trpc.rentalProposals.approveAllBoletos.useMutation({
    onSuccess: async () => {
      toast.success("Todos os boletos pendentes foram aprovados.");
      await invalidate();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível aprovar os boletos."),
  });

  const setBoletoPaid = trpc.rentalProposals.setBoletoPaid.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.paid ? "Boleto marcado como pago." : "Baixa de pagamento desfeita."
      );
      await invalidate();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível atualizar o pagamento."),
  });

  const boletos = set.boletos;
  const total = boletos.reduce((sum, boleto) => sum + boleto.totalAmount, 0);
  const approvedCount = boletos.filter(
    boleto => boleto.status === "aprovado"
  ).length;
  const allApproved = boletos.length > 0 && approvedCount === boletos.length;
  const allSelected =
    boletos.length > 0 && selectedIds.size === boletos.length;

  const toggleSelectAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(boletos.map(boleto => boleto.id))
    );
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const batchPending = updateBoletosBatch.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mb-3 h-8 gap-2 rounded-full bg-white px-4 text-xs font-semibold"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              <Receipt className="h-3.5 w-3.5" />
              {set.referenceCode || "Sem código"}
            </span>
            <TemporalStatusBadge status={getBoletoSetStatus(boletos)} />
          </div>
          <p className="mt-2 font-semibold text-slate-950">
            {set.property?.titulo || `Imóvel ID ${set.property?.id ?? "-"}`}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Locatário: {set.tenant?.name || set.tenant?.email || "Não informado"}{" "}
            · {boletos.length} boleto(s) · {approvedCount} aprovado(s) · total{" "}
            {formatCentsBRL(total)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
          Selecionar todos
        </label>
        <span className="text-xs text-slate-500">
          {selectedIds.size > 0
            ? `${selectedIds.size} selecionado(s)`
            : "Nenhum selecionado"}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full bg-white px-3 text-xs font-semibold"
            onClick={() => setBatchOpen(true)}
          >
            <Layers className="mr-1 h-3.5 w-3.5" />
            Editar em lote
            {selectedIds.size > 0 ? ` (${selectedIds.size})` : " (todos)"}
          </Button>
          {allApproved ? null : (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
              disabled={approveAllBoletos.isPending}
              onClick={() =>
                approveAllBoletos.mutate({ id: set.proposalId })
              }
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Aprovar todos
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {boletos.map(boleto => {
          const isApproved = boleto.status === "aprovado";
          const temporalStatus = getBoletoTemporalStatus(boleto);
          const isPaid = temporalStatus === "pago";
          const isSelected = selectedIds.has(boleto.id);

          return (
            <div
              key={boleto.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/85 p-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelect(boleto.id)}
                />
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
                  {boleto.installmentNumber}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-950">
                    {formatCompetenceMonth(boleto.referenceMonth)}
                    <TemporalStatusBadge status={temporalStatus} />
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isApproved ? "Aprovado" : "Em revisão"}
                    </span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Vence {formatStoredDate(boleto.dueDate)}
                    {boleto.condominiumAmount
                      ? ` · cond. ${formatCentsBRL(boleto.condominiumAmount)}`
                      : ""}
                    {boleto.extraAmount
                      ? ` · ${boleto.extraDescription || "extra"} ${formatCentsBRL(boleto.extraAmount)}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <span className="text-sm font-semibold text-slate-950">
                  {formatCentsBRL(boleto.totalAmount)}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full bg-white px-3 text-xs font-semibold"
                    onClick={() => setEditingBoleto(boleto)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  {isApproved ? null : (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-full bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
                      disabled={approveBoleto.isPending}
                      onClick={() => approveBoleto.mutate({ boletoId: boleto.id })}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Aprovar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-8 rounded-full px-3 text-xs font-semibold ${
                      isPaid
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "bg-white"
                    }`}
                    disabled={setBoletoPaid.isPending}
                    onClick={() =>
                      setBoletoPaid.mutate({
                        boletoId: boleto.id,
                        paid: !isPaid,
                      })
                    }
                    title={
                      isPaid
                        ? "Desfazer baixa de pagamento"
                        : "Marcar como pago (baixa manual)"
                    }
                  >
                    <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                    {isPaid ? "Estornar" : "Marcar pago"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BoletoEditDialog
        boleto={editingBoleto}
        isPending={updateBoleto.isPending}
        onClose={() => setEditingBoleto(null)}
        onSave={payload =>
          editingBoleto &&
          updateBoleto.mutate({ boletoId: editingBoleto.id, ...payload })
        }
      />

      <BoletoBatchDialog
        open={batchOpen}
        targetCount={selectedIds.size || boletos.length}
        usingSelection={selectedIds.size > 0}
        isPending={batchPending}
        onClose={() => setBatchOpen(false)}
        onApply={patch =>
          updateBoletosBatch.mutate({
            id: set.proposalId,
            boletoIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
            patch,
          })
        }
      />
    </div>
  );
}

type BoletoEditPayload = {
  dueDate?: string;
  rentAmount?: number;
  condominiumAmount?: number | null;
  extraAmount?: number;
  extraDescription?: string | null;
  notes?: string | null;
};

function BoletoEditDialog({
  boleto,
  isPending,
  onClose,
  onSave,
}: {
  boleto: Boleto | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (payload: BoletoEditPayload) => void;
}) {
  const [dueDate, setDueDate] = useState("");
  const [rent, setRent] = useState("");
  const [condominium, setCondominium] = useState("");
  const [extra, setExtra] = useState("");
  const [extraDescription, setExtraDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [loadedId, setLoadedId] = useState<number | null>(null);

  // Sincroniza os campos quando um novo boleto e aberto.
  if (boleto && boleto.id !== loadedId) {
    setLoadedId(boleto.id);
    setDueDate(formatDateInput(boleto.dueDate));
    setRent(formatCurrencyInput(boleto.rentAmount));
    setCondominium(formatCurrencyInput(boleto.condominiumAmount));
    setExtra(formatCurrencyInput(boleto.extraAmount));
    setExtraDescription(boleto.extraDescription ?? "");
    setNotes(boleto.notes ?? "");
  }

  const handleSave = () => {
    if (!dueDate) {
      toast.error("Informe a data de vencimento do boleto.");
      return;
    }
    const rentCents = parseCurrencyToCents(rent);
    if (rentCents <= 0) {
      toast.error("Informe o valor do aluguel do boleto.");
      return;
    }
    onSave({
      dueDate,
      rentAmount: rentCents,
      condominiumAmount: condominium.trim()
        ? parseCurrencyToCents(condominium)
        : null,
      extraAmount: extra.trim() ? parseCurrencyToCents(extra) : 0,
      extraDescription: extraDescription.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog
      open={boleto !== null}
      onOpenChange={open => {
        if (open || isPending) return;
        setLoadedId(null);
        onClose();
      }}
    >
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[28px] border-white/80 bg-[#f7f6f2] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {boleto
              ? `Editar boleto ${boleto.installmentNumber} · ${formatCompetenceMonth(boleto.referenceMonth)}`
              : "Editar boleto"}
          </DialogTitle>
          <DialogDescription>
            Ajuste o vencimento e os valores deste boleto. Ao salvar, ele volta
            para revisão e precisa ser aprovado novamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Data de vencimento</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={event => setDueDate(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Aluguel</Label>
              <Input
                value={rent}
                onChange={event => setRent(event.target.value)}
                placeholder="R$ 0,00"
                className={FIELD_CLASS}
              />
            </div>
            <div className="space-y-2">
              <Label>Condomínio</Label>
              <Input
                value={condominium}
                onChange={event => setCondominium(event.target.value)}
                placeholder="R$ 0,00"
                className={FIELD_CLASS}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Outros encargos</Label>
              <Input
                value={extra}
                onChange={event => setExtra(event.target.value)}
                placeholder="R$ 0,00"
                className={FIELD_CLASS}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição dos encargos</Label>
              <Input
                value={extraDescription}
                onChange={event => setExtraDescription(event.target.value)}
                placeholder="Ex.: IPTU, multa..."
                className={FIELD_CLASS}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              className="min-h-[72px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm"
              placeholder="Observações internas deste boleto (opcional)."
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-white"
            disabled={isPending}
            onClick={() => {
              setLoadedId(null);
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
            disabled={isPending}
            onClick={handleSave}
          >
            {isPending ? "Salvando..." : "Salvar boleto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BoletoBatchPatch = {
  dueDay?: number;
  rentAmount?: number;
  condominiumAmount?: number | null;
  extraAmount?: number;
  extraDescription?: string | null;
};

function BoletoBatchDialog({
  open,
  targetCount,
  usingSelection,
  isPending,
  onClose,
  onApply,
}: {
  open: boolean;
  targetCount: number;
  usingSelection: boolean;
  isPending: boolean;
  onClose: () => void;
  onApply: (patch: BoletoBatchPatch) => void;
}) {
  const [dueDay, setDueDay] = useState("");
  const [rent, setRent] = useState("");
  const [condominium, setCondominium] = useState("");
  const [extra, setExtra] = useState("");
  const [extraDescription, setExtraDescription] = useState("");

  const handleApply = () => {
    const patch: BoletoBatchPatch = {};
    if (dueDay.trim()) {
      const day = Number(dueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        toast.error("Dia de vencimento inválido (1 a 31).");
        return;
      }
      patch.dueDay = day;
    }
    if (rent.trim()) patch.rentAmount = parseCurrencyToCents(rent);
    if (condominium.trim())
      patch.condominiumAmount = parseCurrencyToCents(condominium);
    if (extra.trim()) patch.extraAmount = parseCurrencyToCents(extra);
    if (extraDescription.trim()) patch.extraDescription = extraDescription.trim();

    if (Object.keys(patch).length === 0) {
      toast.error("Preencha ao menos um campo para aplicar em lote.");
      return;
    }
    onApply(patch);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (isPending) return;
        if (!next) {
          setDueDay("");
          setRent("");
          setCondominium("");
          setExtra("");
          setExtraDescription("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[28px] border-white/80 bg-[#f7f6f2] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Editar boletos em lote</DialogTitle>
          <DialogDescription>
            As alterações serão aplicadas a{" "}
            {usingSelection
              ? `${targetCount} boleto(s) selecionado(s)`
              : `todos os ${targetCount} boleto(s)`}
            . Preencha apenas os campos que deseja alterar; os demais permanecem
            como estão. Os boletos afetados voltam para revisão.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Novo dia de vencimento</Label>
            <Input
              inputMode="numeric"
              value={dueDay}
              onChange={event =>
                setDueDay(event.target.value.replace(/\D/g, "").slice(0, 2))
              }
              placeholder="Ex.: 10"
              className={FIELD_CLASS}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Aluguel</Label>
              <Input
                value={rent}
                onChange={event => setRent(event.target.value)}
                placeholder="R$ 0,00"
                className={FIELD_CLASS}
              />
            </div>
            <div className="space-y-2">
              <Label>Condomínio</Label>
              <Input
                value={condominium}
                onChange={event => setCondominium(event.target.value)}
                placeholder="R$ 0,00"
                className={FIELD_CLASS}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Outros encargos</Label>
              <Input
                value={extra}
                onChange={event => setExtra(event.target.value)}
                placeholder="R$ 0,00"
                className={FIELD_CLASS}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição dos encargos</Label>
              <Input
                value={extraDescription}
                onChange={event => setExtraDescription(event.target.value)}
                placeholder="Ex.: reajuste IGP-M"
                className={FIELD_CLASS}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-white"
            disabled={isPending}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
            disabled={isPending}
            onClick={handleApply}
          >
            <Layers className="h-4 w-4" />
            {isPending ? "Aplicando..." : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
