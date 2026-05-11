import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

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

type InitialRentalProposal = {
  id: number;
  propertyId: number;
  brokerUserId: number;
  tenantUserId: number;
  ownerConfirmedAt: Date | string | null;
  tenantConfirmedAt: Date | string | null;
  leaseTermMonths: number;
  adjustmentIndex: string;
  rentAmount: number;
  startDate: Date | string;
  dueDay: number;
  notes: string | null;
};

type RentalProposalFormProps = {
  initialProposal?: InitialRentalProposal | null;
};

export default function RentalProposalForm({ initialProposal = null }: RentalProposalFormProps) {
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const initialPropertyId = new URLSearchParams(location.split("?")[1] ?? "").get("propertyId");
  const isEditing = Boolean(initialProposal);
  const [isDirty, setIsDirty] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [brokerUserId, setBrokerUserId] = useState("");
  const [tenantUserId, setTenantUserId] = useState("");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [tenantConfirmed, setTenantConfirmed] = useState(false);
  const [leaseTermMonths, setLeaseTermMonths] = useState("30");
  const [adjustmentIndex, setAdjustmentIndex] = useState("IGP-M");
  const [rentAmount, setRentAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!initialProposal) return;

    setPropertyId(String(initialProposal.propertyId));
    setBrokerUserId(String(initialProposal.brokerUserId));
    setTenantUserId(String(initialProposal.tenantUserId));
    setOwnerConfirmed(Boolean(initialProposal.ownerConfirmedAt));
    setTenantConfirmed(Boolean(initialProposal.tenantConfirmedAt));
    setLeaseTermMonths(String(initialProposal.leaseTermMonths));
    setAdjustmentIndex(initialProposal.adjustmentIndex);
    setRentAmount(formatCurrencyInput(initialProposal.rentAmount));
    setStartDate(formatDateInput(initialProposal.startDate));
    setDueDay(String(initialProposal.dueDay));
    setNotes(initialProposal.notes ?? "");
    setIsDirty(false);
  }, [initialProposal]);

  const { data: properties, isLoading: loadingProperties } = trpc.properties.myProperties.useQuery();
  const { data: users } = trpc.admin.users.useQuery();

  const brokers = useMemo(
    () => (users ?? []).filter(user => user.role === "corretor" || user.role === "administrativo"),
    [users]
  );
  const rentableProperties = useMemo(
    () => (properties ?? []).filter(property => property.finalidade === "locacao" || property.finalidade === "ambos"),
    [properties]
  );
  const tenants = useMemo(
    () => (users ?? []).filter(user => user.role === "cliente"),
    [users]
  );
  const selectedProperty = useMemo(
    () => rentableProperties.find(property => String(property.id) === propertyId) ?? null,
    [propertyId, rentableProperties]
  );
  const selectedTenant = useMemo(
    () => tenants.find(user => String(user.id) === tenantUserId) ?? null,
    [tenantUserId, tenants]
  );

  useEffect(() => {
    if (initialProposal || !initialPropertyId || propertyId || !rentableProperties.length) return;

    const property = rentableProperties.find(item => String(item.id) === initialPropertyId);
    if (!property) return;

    setPropertyId(String(property.id));
    setBrokerUserId(property.idCorretor ? String(property.idCorretor) : "");
    setRentAmount(formatCurrencyInput(property.valorLocacao ?? property.valor));
    setOwnerConfirmed(false);
    setIsDirty(true);
  }, [initialProposal, initialPropertyId, propertyId, rentableProperties]);

  const markDirty = () => setIsDirty(true);

  const createProposal = trpc.rentalProposals.create.useMutation({
    onSuccess: async created => {
      toast.success("Rascunho de locacao salvo.");
      setIsDirty(false);
      await utils.rentalProposals.list.invalidate();
      setLocation(`/admin/modulos/locacoes/propostas/${created.id}`);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel salvar o rascunho da locacao.");
    },
  });

  const updateProposal = trpc.rentalProposals.update.useMutation({
    onSuccess: async () => {
      toast.success("Rascunho de locacao atualizado.");
      setIsDirty(false);
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar o rascunho da locacao.");
    },
  });

  const submitProposal = () => {
    const rentAmountInCents = parseCurrencyToCents(rentAmount);
    if (!propertyId) {
      toast.error("Selecione um imovel.");
      return;
    }
    if (!brokerUserId) {
      toast.error("Selecione o corretor responsavel.");
      return;
    }
    if (!tenantUserId) {
      toast.error("Selecione o locatario.");
      return;
    }
    if (!startDate) {
      toast.error("Informe a data de inicio da locacao.");
      return;
    }
    if (rentAmountInCents <= 0) {
      toast.error("Informe o valor da locacao.");
      return;
    }

    const payload = {
      propertyId: Number(propertyId),
      brokerUserId: Number(brokerUserId),
      tenantUserId: Number(tenantUserId),
      ownerConfirmed,
      tenantConfirmed,
      leaseTermMonths: Number(leaseTermMonths),
      adjustmentIndex,
      rentAmount: rentAmountInCents,
      startDate,
      dueDay: Number(dueDay),
      notes: notes.trim() || undefined,
    };

    if (initialProposal) {
      updateProposal.mutate({
        id: initialProposal.id,
        ...payload,
      });
      return;
    }

    createProposal.mutate(payload);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Dados iniciais da locacao</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isEditing
                ? "Revise e continue o rascunho deste processo de locacao."
                : "Preencha as primeiras informações para salvar a proposta como rascunho."}
            </p>
          </div>
          {isDirty ? (
            <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Alterações não salvas
            </span>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Imovel</Label>
              <Select
                value={propertyId}
                onValueChange={value => {
                  markDirty();
                  setPropertyId(value);
                  const property = rentableProperties.find(item => String(item.id) === value);
                  setBrokerUserId(property?.idCorretor ? String(property.idCorretor) : "");
                  setRentAmount(formatCurrencyInput(property?.valorLocacao ?? property?.valor));
                  setOwnerConfirmed(false);
                }}
                disabled={loadingProperties}
              >
                <SelectTrigger className={FIELD_CLASS}>
                  <SelectValue placeholder="Selecione um imovel cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {rentableProperties.map(property => (
                    <SelectItem key={property.id} value={String(property.id)}>
                      {property.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="mt-2 rounded-full bg-white"
                onClick={() => setLocation("/imoveis?selecionarLocacao=1")}
              >
                Vincular imóvel pela página de imóveis
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Corretor responsavel</Label>
              <Select
                value={brokerUserId}
                onValueChange={value => {
                  markDirty();
                  setBrokerUserId(value);
                }}
              >
                <SelectTrigger className={FIELD_CLASS}>
                  <SelectValue placeholder="Selecione o corretor" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name || user.email || `ID ${user.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Proprietario</p>
              {selectedProperty?.proprietario ? (
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <p>{selectedProperty.proprietario.name}</p>
                  <p>{selectedProperty.proprietario.email}</p>
                  <p>{selectedProperty.proprietario.cpf}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-amber-700">Nenhum proprietario vinculado ao imovel selecionado.</p>
              )}
              <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Checkbox
                  checked={ownerConfirmed}
                  onCheckedChange={checked => {
                    markDirty();
                    setOwnerConfirmed(checked === true);
                  }}
                />
                Dados do proprietario conferidos
              </label>
            </div>

            <div className="space-y-2">
              <Label>Locatario</Label>
              <Select
                value={tenantUserId}
                onValueChange={value => {
                  markDirty();
                  setTenantUserId(value);
                  setTenantConfirmed(false);
                }}
              >
                <SelectTrigger className={FIELD_CLASS}>
                  <SelectValue placeholder="Selecione o locatario" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name || user.email || `ID ${user.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTenant ? (
                <div className="rounded-2xl border border-white/80 bg-white/90 p-4 text-sm text-slate-600 shadow-sm">
                  <p>{selectedTenant.name || "Sem nome"}</p>
                  <p>{selectedTenant.email || "Sem email"}</p>
                  <p>{selectedTenant.cpf || "Sem CPF"}</p>
                  <label className="mt-4 flex items-center gap-2 font-medium text-slate-700">
                    <Checkbox
                      checked={tenantConfirmed}
                      onCheckedChange={checked => {
                        markDirty();
                        setTenantConfirmed(checked === true);
                      }}
                    />
                    Dados do locatario conferidos
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Tempo de contrato</Label>
              <Input className={FIELD_CLASS} value={leaseTermMonths} onChange={event => { markDirty(); setLeaseTermMonths(event.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label>Indice de reajuste</Label>
              <Input className={FIELD_CLASS} value={adjustmentIndex} onChange={event => { markDirty(); setAdjustmentIndex(event.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label>Valor da locacao</Label>
              <Input className={FIELD_CLASS} value={rentAmount} onChange={event => { markDirty(); setRentAmount(event.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label>Dia de vencimento</Label>
              <Input className={FIELD_CLASS} value={dueDay} onChange={event => { markDirty(); setDueDay(event.target.value); }} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label>Inicio da locacao</Label>
              <Input type="date" className={FIELD_CLASS} value={startDate} onChange={event => { markDirty(); setStartDate(event.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                className="min-h-[90px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                value={notes}
                onChange={event => {
                  markDirty();
                  setNotes(event.target.value);
                }}
                placeholder="Informacoes internas sobre este rascunho."
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {isDirty ? (
              <Button
                className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                disabled={createProposal.isPending || updateProposal.isPending}
                onClick={submitProposal}
              >
                {createProposal.isPending || updateProposal.isPending ? "Salvando..." : "Salvar Rascunho"}
              </Button>
            ) : null}
            <Button
              className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
              disabled
              title="Será habilitado na etapa de primeira interação com proprietário e locatário."
            >
              Iniciar Processo de Locação
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
