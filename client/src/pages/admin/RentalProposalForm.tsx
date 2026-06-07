import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, CheckCircle2, FileSignature, FileText, Pencil, Plus, Save, Trash2, WandSparkles } from "lucide-react";
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

function parseUnresolvedVariables(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type InitialRentalProposal = {
  id: number;
  status: string;
  currentStep: string;
  propertyId: number;
  brokerUserId: number;
  tenantUserId: number;
  ownerId?: number | null;
  tenants?: UserOption[];
  owners?: UserOption[];
  contractTemplates?: ContractTemplateOption[];
  generatedContracts?: GeneratedContractOption[];
  ownerConfirmedAt: Date | string | null;
  tenantConfirmedAt: Date | string | null;
  leaseTermMonths: number;
  adjustmentIndex: string;
  rentAmount: number;
  condominiumAmount?: number | null;
  startDate: Date | string;
  dueDay: number;
  notes: string | null;
};

type UserOption = {
  id: number;
  name: string | null;
  email: string | null;
  cpf?: string | null;
};

type ContractTemplateOption = {
  id: number;
  name: string;
  notes: string | null;
  originalFileName: string;
};

type GeneratedContractOption = {
  id: number;
  title: string;
  status: string;
  reviewedText: string;
  unresolvedVariables: string;
  approvedAt?: Date | string | null;
};

type RentalProposalFormProps = {
  initialProposal?: InitialRentalProposal | null;
  onDeleteProposal?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
};

function getUserOptionLabel(user: UserOption | null | undefined) {
  if (!user) return "";
  return user.name || user.email || `ID ${user.id}`;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function SearchableUserPicker({
  label,
  options,
  selectedId,
  searchValue,
  placeholder,
  onSearchChange,
  onSelect,
}: {
  label: string;
  options: UserOption[];
  selectedId: string;
  searchValue: string;
  placeholder: string;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const selectedUser = options.find(user => String(user.id) === selectedId) ?? null;
  const normalizedSearch = normalizeSearchValue(searchValue);
  const filteredOptions = normalizedSearch
    ? options
        .filter(user => normalizeSearchValue([user.name, user.email, user.cpf, user.id].filter(Boolean).join(" ")).includes(normalizedSearch))
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
        {selectedUser ? (
          <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span className="font-semibold">{getUserOptionLabel(selectedUser)}</span>
            {selectedUser.email ? <span className="ml-2 text-xs text-emerald-700">{selectedUser.email}</span> : null}
          </div>
        ) : null}
        <Input
          value={searchValue}
          onChange={event => onSearchChange(event.target.value)}
          className="h-10 rounded-xl border-slate-200 bg-white text-sm shadow-none"
          placeholder={placeholder}
        />
        {normalizedSearch ? (
          <div className="mt-2 max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(user => (
                <button
                  key={user.id}
                  type="button"
                  className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                    String(user.id) === selectedId ? "bg-emerald-50 text-emerald-900" : "text-slate-700"
                  }`}
                  onClick={() => {
                    onSelect(String(user.id));
                    onSearchChange("");
                  }}
                >
                  <span className="block font-medium">{getUserOptionLabel(user)}</span>
                  <span className="block text-xs text-slate-500">{[user.email, user.cpf].filter(Boolean).join(" · ")}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-slate-500">Nenhum resultado encontrado.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UserChangeDialog({
  open,
  title,
  description,
  options,
  selectedId,
  searchValue,
  placeholder,
  onOpenChange,
  onSearchChange,
  onSelect,
}: {
  open: boolean;
  title: string;
  description: string;
  options: UserOption[];
  selectedId: string;
  searchValue: string;
  placeholder: string;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const normalizedSearch = normalizeSearchValue(searchValue);
  const filteredOptions = normalizedSearch
    ? options
        .filter(user => normalizeSearchValue([user.name, user.email, user.cpf, user.id].filter(Boolean).join(" ")).includes(normalizedSearch))
        .slice(0, 12)
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        onOpenChange(nextOpen);
        if (!nextOpen) onSearchChange("");
      }}
    >
      <DialogContent
        className="max-h-[82vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[28px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={searchValue}
            onChange={event => onSearchChange(event.target.value)}
            className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-sm"
            placeholder={placeholder}
            autoFocus
          />
          <div className="min-h-[220px] rounded-2xl border border-slate-200 bg-white/90 p-2">
            {!normalizedSearch ? (
              <p className="px-3 py-3 text-sm text-slate-500">Digite para pesquisar por nome, e-mail ou CPF.</p>
            ) : filteredOptions.length > 0 ? (
              <div className="max-h-[320px] overflow-y-auto">
                {filteredOptions.map(user => (
                  <button
                    key={user.id}
                    type="button"
                    className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      String(user.id) === selectedId ? "bg-emerald-50 text-emerald-900" : "text-slate-700"
                    }`}
                    onClick={() => {
                      onSelect(String(user.id));
                      onSearchChange("");
                      onOpenChange(false);
                    }}
                  >
                    <span className="block font-medium">{getUserOptionLabel(user)}</span>
                    <span className="block text-xs text-slate-500">{[user.email, user.cpf].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-3 py-3 text-sm text-slate-500">Nenhum resultado encontrado.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OwnerProposalDialog({
  open,
  availablePropertyOwners,
  newOwnerName,
  newOwnerEmail,
  newOwnerCpf,
  isCreating,
  canAddOwner,
  onOpenChange,
  onAddExistingOwner,
  onNewOwnerNameChange,
  onNewOwnerEmailChange,
  onNewOwnerCpfChange,
  onCreateOwner,
}: {
  open: boolean;
  availablePropertyOwners: UserOption[];
  newOwnerName: string;
  newOwnerEmail: string;
  newOwnerCpf: string;
  isCreating: boolean;
  canAddOwner: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExistingOwner: (ownerId: string) => void;
  onNewOwnerNameChange: (value: string) => void;
  onNewOwnerEmailChange: (value: string) => void;
  onNewOwnerCpfChange: (value: string) => void;
  onCreateOwner: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[84vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-[28px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:p-6"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Adicionar proprietário</DialogTitle>
          <DialogDescription>
            Vincule novamente um proprietário do imóvel ou cadastre uma nova ficha básica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-sm font-semibold text-slate-950">Proprietários do imóvel</p>
            <div className="mt-3 space-y-2">
              {availablePropertyOwners.length > 0 ? (
                availablePropertyOwners.map(owner => (
                  <div
                    key={owner.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-slate-950">{getUserOptionLabel(owner)}</p>
                      <p className="truncate text-xs text-slate-500">{[owner.email, owner.cpf].filter(Boolean).join(" · ")}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full bg-white"
                      disabled={!canAddOwner}
                      onClick={() => onAddExistingOwner(String(owner.id))}
                    >
                      Vincular
                    </Button>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Nenhum proprietário do imóvel disponível para revincular.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <p className="text-sm font-semibold text-slate-950">Cadastrar nova ficha</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome completo</Label>
                <Input
                  value={newOwnerName}
                  onChange={event => onNewOwnerNameChange(event.target.value)}
                  className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={newOwnerEmail}
                  onChange={event => onNewOwnerEmailChange(event.target.value)}
                  className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  inputMode="numeric"
                  maxLength={14}
                  value={newOwnerCpf}
                  onChange={event => onNewOwnerCpfChange(formatCpf(event.target.value))}
                  className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                disabled={isCreating || !canAddOwner}
                onClick={onCreateOwner}
              >
                {isCreating ? "Cadastrando..." : "Cadastrar e vincular"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RentalProposalForm({
  initialProposal = null,
  onDeleteProposal,
  onDirtyChange,
}: RentalProposalFormProps) {
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const initialPropertyId = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : location.split("?")[1] ?? ""
  ).get("propertyId");
  const isEditing = Boolean(initialProposal);
  const isContractTemplateStep = initialProposal?.currentStep === "modelos_contrato";
  const isContractReviewStep = initialProposal?.currentStep === "contratos_em_revisao";
  const [isDirty, setIsDirty] = useState(false);
  const [templateSelectionDirty, setTemplateSelectionDirty] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [brokerUserId, setBrokerUserId] = useState("");
  const [tenantUserIds, setTenantUserIds] = useState<string[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [selectedContractTemplateIds, setSelectedContractTemplateIds] = useState<string[]>([]);
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [tenantConfirmed, setTenantConfirmed] = useState(false);
  const [leaseTermMonths, setLeaseTermMonths] = useState("30");
  const [adjustmentIndex, setAdjustmentIndex] = useState("IGP-M");
  const [rentAmount, setRentAmount] = useState("");
  const [condominiumAmount, setCondominiumAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [notes, setNotes] = useState("");
  const [brokerSearch, setBrokerSearch] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerCpf, setNewOwnerCpf] = useState("");
  const [brokerPickerOpen, setBrokerPickerOpen] = useState(false);
  const [tenantPickerOpen, setTenantPickerOpen] = useState(false);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [propertyRequiredDialogOpen, setPropertyRequiredDialogOpen] = useState(false);
  const [editingGeneratedContract, setEditingGeneratedContract] = useState<GeneratedContractOption | null>(null);
  const [contractReviewText, setContractReviewText] = useState("");
  const [contractReviewDirty, setContractReviewDirty] = useState(false);

  useEffect(() => {
    if (!initialProposal) return;

    setPropertyId(String(initialProposal.propertyId));
    setBrokerUserId(String(initialProposal.brokerUserId));
    setTenantUserIds(
      initialProposal.tenants?.length
        ? initialProposal.tenants.map(tenant => String(tenant.id))
        : [String(initialProposal.tenantUserId)]
    );
    setOwnerIds(
      initialProposal.owners?.length
        ? initialProposal.owners.map(owner => String(owner.id))
        : initialProposal.ownerId
          ? [String(initialProposal.ownerId)]
          : []
    );
    setOwnerConfirmed(Boolean(initialProposal.ownerConfirmedAt));
    setTenantConfirmed(Boolean(initialProposal.tenantConfirmedAt));
    setLeaseTermMonths(String(initialProposal.leaseTermMonths));
    setAdjustmentIndex(initialProposal.adjustmentIndex);
    setRentAmount(formatCurrencyInput(initialProposal.rentAmount));
    setCondominiumAmount(formatCurrencyInput(initialProposal.condominiumAmount));
    setStartDate(formatDateInput(initialProposal.startDate));
    setDueDay(String(initialProposal.dueDay));
    setNotes(initialProposal.notes ?? "");
    setSelectedContractTemplateIds(
      initialProposal.contractTemplates?.map(template => String(template.id)) ?? []
    );
    setTemplateSelectionDirty(false);
    setIsDirty(false);
  }, [initialProposal]);

  useEffect(() => {
    onDirtyChange?.(isDirty || templateSelectionDirty || contractReviewDirty);
  }, [contractReviewDirty, isDirty, onDirtyChange, templateSelectionDirty]);


  const { data: properties, isLoading: loadingProperties } = trpc.properties.myProperties.useQuery();
  const { data: users } = trpc.admin.users.useQuery();
  const { data: propertyOwners } = trpc.propertyOwners.list.useQuery();
  const { data: contractTemplates, isLoading: loadingContractTemplates } = trpc.contractTemplates.list.useQuery(
    { contractKind: "locacao" },
    { enabled: Boolean(initialProposal) }
  );

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
  const ownerOptions = useMemo(
    () => propertyOwners ?? [],
    [propertyOwners]
  );
  const selectedProperty = useMemo(
    () => rentableProperties.find(property => String(property.id) === propertyId) ?? null,
    [propertyId, rentableProperties]
  );
  const selectedTenants = useMemo(
    () => tenantUserIds
      .flatMap(id => {
        const tenant = tenants.find(user => String(user.id) === id);
        return tenant ? [tenant] : [];
      }),
    [tenantUserIds, tenants]
  );
  const selectedOwners = useMemo(
    () => ownerIds
      .flatMap(id => {
        const owner = ownerOptions.find(item => String(item.id) === id);
        return owner ? [owner] : [];
      }),
    [ownerIds, ownerOptions]
  );
  const selectedBroker = useMemo(
    () => brokers.find(user => String(user.id) === brokerUserId) ?? null,
    [brokerUserId, brokers]
  );
  const propertyLinkedOwners = useMemo(() => {
    if (!selectedProperty) return [] as UserOption[];
    if (selectedProperty.proprietarios?.length) return selectedProperty.proprietarios;
    return selectedProperty.proprietario ? [selectedProperty.proprietario] : [];
  }, [selectedProperty]);
  const availablePropertyOwners = useMemo(
    () => propertyLinkedOwners.filter((owner: UserOption) => !ownerIds.includes(String(owner.id))),
    [ownerIds, propertyLinkedOwners]
  );
  const shouldShowCondominiumAmount = Boolean(selectedProperty?.idCondominio);
  const proposalReturnQuery = initialProposal ? `?fromRentalProposal=${initialProposal.id}` : "";

  useEffect(() => {
    if (initialProposal || !initialPropertyId || propertyId || !rentableProperties.length) return;

    const property = rentableProperties.find(item => String(item.id) === initialPropertyId);
    if (!property) return;

    setPropertyId(String(property.id));
    setBrokerUserId(property.idCorretor ? String(property.idCorretor) : "");
    setRentAmount(formatCurrencyInput(property.valorLocacao ?? property.valor));
    setCondominiumAmount(formatCurrencyInput(property.condominio?.valorCondominio));
    setOwnerIds(
      property.proprietarios?.length
        ? property.proprietarios.map((owner: { id: number }) => String(owner.id))
        : property.proprietario
          ? [String(property.proprietario.id)]
          : []
    );
    setOwnerConfirmed(false);
    setIsDirty(true);
  }, [initialProposal, initialPropertyId, propertyId, rentableProperties]);

  const markDirty = () => setIsDirty(true);

  const addTenant = (value: string) => {
    if (tenantUserIds.includes(value)) {
      toast.info("Este locatario ja esta vinculado.");
      return;
    }
    markDirty();
    setTenantUserIds(current => [...current, value]);
    setTenantConfirmed(false);
  };

  const removeTenant = (value: string) => {
    markDirty();
    setTenantUserIds(current => current.filter(id => id !== value));
    setTenantConfirmed(false);
  };

  const addOwner = (value: string) => {
    if (ownerIds.includes(value)) {
      toast.info("Este proprietario ja esta vinculado.");
      return;
    }
    if (ownerIds.length >= 3) {
      toast.error("E possivel vincular ate 3 proprietarios nesta proposta.");
      return;
    }
    markDirty();
    setOwnerIds(current => [...current, value]);
    setOwnerConfirmed(false);
  };

  const removeOwner = (value: string) => {
    markDirty();
    setOwnerIds(current => current.filter(id => id !== value));
    setOwnerConfirmed(false);
  };

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

  const selectContractTemplates = trpc.rentalProposals.selectContractTemplates.useMutation({
    onSuccess: async () => {
      toast.success("Modelos de contrato vinculados a proposta.");
      setTemplateSelectionDirty(false);
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel salvar os modelos de contrato.");
    },
  });

  const generateContracts = trpc.rentalProposals.generateContracts.useMutation({
    onSuccess: async () => {
      toast.success("Contratos gerados para revisão.");
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel gerar os contratos.");
    },
  });

  const updateGeneratedContractText = trpc.rentalProposals.updateGeneratedContractText.useMutation({
    onSuccess: async () => {
      toast.success("Texto do contrato salvo.");
      setContractReviewDirty(false);
      setEditingGeneratedContract(null);
      setContractReviewText("");
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel salvar o texto do contrato.");
    },
  });

  const approveGeneratedContract = trpc.rentalProposals.approveGeneratedContract.useMutation({
    onSuccess: async data => {
      toast.success(data.allApproved ? "Todos os contratos foram aprovados." : "Contrato aprovado.");
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel aprovar o contrato.");
    },
  });

  const createQuickOwner = trpc.propertyOwners.createQuick.useMutation({
    onSuccess: async owner => {
      toast.success("Proprietario cadastrado e vinculado.");
      await utils.propertyOwners.list.invalidate();
      addOwner(String(owner.id));
      setNewOwnerName("");
      setNewOwnerEmail("");
      setNewOwnerCpf("");
      setOwnerPickerOpen(false);
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel cadastrar o proprietario.");
    },
  });

  const submitQuickOwner = () => {
    const cpf = formatCpf(normalizeCpf(newOwnerCpf));
    if (!newOwnerName.trim() || !newOwnerEmail.trim() || !cpf) {
      toast.error("Preencha nome completo, e-mail e CPF.");
      return;
    }
    if (!isValidCpf(cpf)) {
      toast.error("CPF do proprietario invalido.");
      return;
    }
    createQuickOwner.mutate({
      name: newOwnerName.trim(),
      email: newOwnerEmail.trim().toLowerCase(),
      cpf,
    });
  };

  const submitProposal = () => {
    const rentAmountInCents = parseCurrencyToCents(rentAmount);
    const condominiumAmountInCents = condominiumAmount.trim()
      ? parseCurrencyToCents(condominiumAmount)
      : null;
    if (!propertyId) {
      toast.error("Selecione um imovel.");
      return;
    }
    if (!brokerUserId) {
      toast.error("Selecione o corretor responsavel.");
      return;
    }
    if (ownerIds.length === 0) {
      toast.error("Adicione ao menos um proprietario.");
      return;
    }
    if (tenantUserIds.length === 0) {
      toast.error("Adicione ao menos um locatario.");
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
      tenantUserId: Number(tenantUserIds[0]),
      tenantUserIds: tenantUserIds.map(Number),
      ownerIds: ownerIds.map(Number),
      ownerConfirmed,
      tenantConfirmed,
      leaseTermMonths: Number(leaseTermMonths),
      adjustmentIndex,
      rentAmount: rentAmountInCents,
      condominiumAmount: shouldShowCondominiumAmount ? condominiumAmountInCents : null,
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

  const toggleContractTemplateSelection = (templateId: number) => {
    const value = String(templateId);
    setSelectedContractTemplateIds(current => {
      const next = current.includes(value)
        ? current.filter(id => id !== value)
        : [...current, value];
      return next;
    });
    setTemplateSelectionDirty(true);
  };

  const saveContractTemplateSelection = () => {
    if (!initialProposal) return;
    if (selectedContractTemplateIds.length === 0) {
      toast.error("Selecione ao menos um modelo de contrato.");
      return;
    }

    selectContractTemplates.mutate({
      id: initialProposal.id,
      contractTemplateIds: selectedContractTemplateIds.map(Number),
    });
  };

  const generateContractsForReview = () => {
    if (!initialProposal) return;
    if (templateSelectionDirty) {
      toast.error("Salve a selecao de modelos antes de gerar os contratos.");
      return;
    }
    if (selectedContractTemplateIds.length === 0) {
      toast.error("Selecione ao menos um modelo de contrato.");
      return;
    }

    generateContracts.mutate({ id: initialProposal.id });
  };

  const openGeneratedContractEditor = (contract: GeneratedContractOption) => {
    setEditingGeneratedContract(contract);
    setContractReviewText(contract.reviewedText);
    setContractReviewDirty(false);
  };

  const saveGeneratedContractText = () => {
    if (!editingGeneratedContract) return;
    if (!contractReviewText.trim()) {
      toast.error("O texto revisado nao pode ficar vazio.");
      return;
    }

    updateGeneratedContractText.mutate({
      contractId: editingGeneratedContract.id,
      reviewedText: contractReviewText,
    });
  };

  const approveContract = (contract: GeneratedContractOption) => {
    if (!contract.reviewedText.trim()) {
      toast.error("Revise o texto do contrato antes de aprovar.");
      return;
    }

    approveGeneratedContract.mutate({ contractId: contract.id });
  };

  const generatedContracts = initialProposal?.generatedContracts ?? [];
  const allGeneratedContractsApproved =
    generatedContracts.length > 0 &&
    generatedContracts.every(contract => contract.status === "aprovado");

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
              <div className="flex items-center gap-2">
                <div className={`${FIELD_CLASS} flex min-h-10 flex-1 items-center px-3 py-2`}>
                  {selectedProperty ? (
                    <button
                      type="button"
                      className="truncate text-left text-sm font-semibold text-slate-950 hover:text-emerald-700 hover:underline"
                      onClick={() => setLocation(`/imoveis/${selectedProperty.id}${proposalReturnQuery}`)}
                    >
                        {selectedProperty.titulo}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-500">
                      {loadingProperties ? "Carregando imóvel..." : "Nenhum imóvel selecionado"}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full bg-white"
                  onClick={() => {
                    if (selectedProperty) {
                      setLocation("/imoveis?selecionarLocacao=1");
                      return;
                    }
                    setPropertyRequiredDialogOpen(true);
                  }}
                  aria-label={selectedProperty ? "Trocar imóvel pela página de imóveis" : "Adicionar imóvel à proposta"}
                  title={selectedProperty ? "Trocar imóvel pela página de imóveis" : "Adicionar imóvel à proposta"}
                >
                  {selectedProperty ? <ArrowLeftRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Corretor responsavel</Label>
              <div className="flex items-center gap-2">
                <div className={`${FIELD_CLASS} flex min-h-10 flex-1 items-center px-3 py-2`}>
                  {selectedBroker ? (
                    <span className="truncate text-sm font-semibold text-slate-950">{getUserOptionLabel(selectedBroker)}</span>
                  ) : (
                    <span className="text-sm text-slate-500">Nenhum corretor selecionado</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full bg-white"
                  onClick={() => setBrokerPickerOpen(true)}
                  aria-label="Trocar corretor responsável"
                  title="Trocar corretor responsável"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-950">Proprietario</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white"
                    onClick={() => setOwnerPickerOpen(true)}
                    aria-label="Adicionar proprietário"
                    title="Adicionar proprietário"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {selectedOwners.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {selectedOwners.map((owner, index) => (
                    <div key={owner.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm text-slate-600">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">Proprietario {index + 1}</p>
                          <p className="mt-1 truncate">{owner.name || "Sem nome"}</p>
                          <p className="truncate">{owner.email || "Sem email"}</p>
                          <p>{owner.cpf || "Sem CPF"}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white"
                            onClick={() => setLocation(`/admin/proprietarios/${owner.id}${proposalReturnQuery}`)}
                            aria-label={`Editar proprietário ${index + 1}`}
                            title={`Editar proprietário ${index + 1}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            onClick={() => removeOwner(String(owner.id))}
                            aria-label={`Remover proprietário ${index + 1}`}
                            title={`Remover proprietário ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-amber-700">Nenhum proprietario vinculado a proposta.</p>
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

            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 text-sm shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-950">Locatario</p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-white"
                  onClick={() => setTenantPickerOpen(true)}
                  aria-label="Adicionar locatário"
                  title="Adicionar locatário"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {selectedTenants.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {selectedTenants.map((tenant, index) => (
                    <div key={tenant.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm text-slate-600">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">Locatario {index + 1}</p>
                          <p className="mt-1 truncate">{tenant.name || "Sem nome"}</p>
                          <p className="truncate">{tenant.email || "Sem email"}</p>
                          <p>{tenant.cpf || "Sem CPF"}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white"
                            onClick={() => setLocation(`/admin/users/${tenant.id}${proposalReturnQuery}`)}
                            aria-label={`Editar locatário ${index + 1}`}
                            title={`Editar locatário ${index + 1}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            onClick={() => removeTenant(String(tenant.id))}
                            aria-label={`Remover locatário ${index + 1}`}
                            title={`Remover locatário ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <label className="mt-4 flex items-center gap-2 font-medium text-slate-700">
                    <Checkbox
                      checked={tenantConfirmed}
                      onCheckedChange={checked => {
                        markDirty();
                        setTenantConfirmed(checked === true);
                      }}
                    />
                    Dados dos locatarios conferidos
                  </label>
                </div>
              ) : (
                <p className="mt-2 text-sm text-amber-700">Nenhum locatario vinculado a proposta.</p>
              )}
            </div>
          </div>

          <div className={`grid gap-4 sm:grid-cols-2 ${shouldShowCondominiumAmount ? "lg:grid-cols-[170px_170px_190px_190px_150px]" : "lg:grid-cols-[170px_170px_190px_150px]"}`}>
            <div className="space-y-2 max-w-[150px]">
              <Label>Tempo de contrato (meses)</Label>
              <Input className={FIELD_CLASS} value={leaseTermMonths} onChange={event => { markDirty(); setLeaseTermMonths(event.target.value); }} />
            </div>
            <div className="space-y-2 max-w-[170px]">
              <Label>Indice de reajuste</Label>
              <Input className={FIELD_CLASS} value={adjustmentIndex} onChange={event => { markDirty(); setAdjustmentIndex(event.target.value); }} />
            </div>
            <div className="space-y-2 max-w-[190px]">
              <Label>Valor da locacao</Label>
              <Input className={FIELD_CLASS} value={rentAmount} onChange={event => { markDirty(); setRentAmount(event.target.value); }} />
            </div>
            {shouldShowCondominiumAmount ? (
              <div className="space-y-2 max-w-[190px]">
                <Label>Valor do Condominio</Label>
                <Input className={FIELD_CLASS} value={condominiumAmount} onChange={event => { markDirty(); setCondominiumAmount(event.target.value); }} />
              </div>
            ) : null}
            <div className="space-y-2 max-w-[150px]">
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
            {initialProposal && onDeleteProposal ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                onClick={onDeleteProposal}
                aria-label="Excluir proposta de locação"
                title="Excluir proposta de locação"
              >
                <Trash2 className="h-4 w-4" />
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
      {initialProposal && isContractTemplateStep ? (
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <FileSignature className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-semibold text-slate-950">Modelos de contrato</h2>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Escolha os modelos que serão cruzados com os dados desta proposta na próxima etapa.
              </p>
            </div>
            {templateSelectionDirty ? (
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Seleção não salva
              </span>
            ) : null}
          </div>

          {loadingContractTemplates ? (
            <div className="space-y-3">
              {[1, 2].map(item => (
                <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : contractTemplates?.length ? (
            <div className="space-y-3">
              {contractTemplates.map(template => {
                const checked = selectedContractTemplateIds.includes(String(template.id));

                return (
                  <label
                    key={template.id}
                    className={`flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition sm:flex-row sm:items-start ${
                      checked
                        ? "border-emerald-200 bg-emerald-50/80"
                        : "border-slate-200 bg-white/80 hover:border-emerald-200"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleContractTemplateSelection(template.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-950">{template.name}</span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {template.notes || "Sem observacoes internas."}
                      </span>
                      <span className="mt-2 block truncate text-xs text-slate-500">
                        Arquivo base: {template.originalFileName}
                      </span>
                    </span>
                  </label>
                );
              })}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="rounded-full bg-white"
                  disabled={!templateSelectionDirty || selectContractTemplates.isPending}
                  onClick={saveContractTemplateSelection}
                >
                  {selectContractTemplates.isPending ? "Salvando..." : "Salvar modelos escolhidos"}
                </Button>
                <Button
                  className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                  disabled={templateSelectionDirty || generateContracts.isPending}
                  onClick={generateContractsForReview}
                >
                  <WandSparkles className="h-4 w-4" />
                  {generateContracts.isPending ? "Gerando..." : "Gerar contratos para revisão"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Nenhum modelo de contrato cadastrado. Cadastre os modelos na aba Contratos antes de continuar.
            </div>
          )}
        </div>
      ) : null}
      {initialProposal && isContractReviewStep ? (
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
          <div className="mb-5 flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Contratos em revisão</h2>
              <p className="mt-1 text-sm text-slate-600">
                Textos gerados com os dados da proposta e prontos para validação manual.
              </p>
            </div>
          </div>

          {generatedContracts.length ? (
            <div className="space-y-3">
              {generatedContracts.map(contract => {
                const unresolvedCount = parseUnresolvedVariables(contract.unresolvedVariables).length;
                const isApproved = contract.status === "aprovado";

                return (
                  <div key={contract.id} className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{contract.title}</p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isApproved
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isApproved ? "Aprovado" : "Em revisao"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {contract.reviewedText.length.toLocaleString("pt-BR")} caracteres gerados para revisão.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                            unresolvedCount > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {unresolvedCount > 0
                            ? `${unresolvedCount} variavel(is) pendente(s)`
                            : "Variaveis preenchidas"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full bg-white px-3 text-xs font-semibold"
                          onClick={() => openGeneratedContractEditor(contract)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Editar texto
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-full bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
                          disabled={isApproved || approveGeneratedContract.isPending}
                          onClick={() => approveContract(contract)}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          {isApproved ? "Aprovado" : "Aprovar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {allGeneratedContractsApproved ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Todos os contratos foram aprovados. A próxima etapa será gerar o código de referência da proposta.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Nenhum contrato gerado foi encontrado para esta proposta.
            </div>
          )}
        </div>
      ) : null}
      <UserChangeDialog
        open={brokerPickerOpen}
        title="Trocar corretor responsável"
        description="Pesquise e selecione o corretor responsável por esta locação."
        options={brokers}
        selectedId={brokerUserId}
        searchValue={brokerSearch}
        placeholder="Buscar corretor por nome ou e-mail"
        onOpenChange={setBrokerPickerOpen}
        onSearchChange={setBrokerSearch}
        onSelect={value => {
          markDirty();
          setBrokerUserId(value);
        }}
      />
      <UserChangeDialog
        open={tenantPickerOpen}
        title="Adicionar locatário"
        description="Pesquise e selecione o locatário que será vinculado a esta proposta."
        options={tenants}
        selectedId=""
        searchValue={tenantSearch}
        placeholder="Buscar locatário por nome, e-mail ou CPF"
        onOpenChange={setTenantPickerOpen}
        onSearchChange={setTenantSearch}
        onSelect={value => {
          addTenant(value);
        }}
      />
      <OwnerProposalDialog
        open={ownerPickerOpen}
        availablePropertyOwners={availablePropertyOwners}
        newOwnerName={newOwnerName}
        newOwnerEmail={newOwnerEmail}
        newOwnerCpf={newOwnerCpf}
        isCreating={createQuickOwner.isPending}
        canAddOwner={ownerIds.length < 3}
        onOpenChange={setOwnerPickerOpen}
        onAddExistingOwner={value => {
          addOwner(value);
          setOwnerPickerOpen(false);
        }}
        onNewOwnerNameChange={setNewOwnerName}
        onNewOwnerEmailChange={setNewOwnerEmail}
        onNewOwnerCpfChange={setNewOwnerCpf}
        onCreateOwner={submitQuickOwner}
      />
      <Dialog
        open={editingGeneratedContract !== null}
        onOpenChange={open => {
          if (open) return;
          setEditingGeneratedContract(null);
          setContractReviewText("");
          setContractReviewDirty(false);
        }}
      >
        <DialogContent
          className="max-h-[92vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-4xl sm:p-6"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingGeneratedContract?.title || "Revisar contrato"}</DialogTitle>
            <DialogDescription>
              Edite o texto gerado antes de aprovar este contrato para a próxima etapa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={contractReviewText}
              onChange={event => {
                setContractReviewText(event.target.value);
                setContractReviewDirty(true);
              }}
              className="min-h-[56vh] rounded-2xl border-slate-200 bg-white font-mono text-sm leading-6 shadow-sm"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full bg-white"
                onClick={() => {
                  setEditingGeneratedContract(null);
                  setContractReviewText("");
                  setContractReviewDirty(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800"
                disabled={!contractReviewDirty || updateGeneratedContractText.isPending}
                onClick={saveGeneratedContractText}
              >
                <Save className="h-4 w-4" />
                {updateGeneratedContractText.isPending ? "Salvando..." : "Salvar texto revisado"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={propertyRequiredDialogOpen} onOpenChange={setPropertyRequiredDialogOpen}>
        <DialogContent className="!w-[420px] !max-w-[calc(100%-2rem)] rounded-[24px] border-white/80 bg-[#f7f6f2] p-4 sm:!max-w-[420px] sm:p-5">
          <DialogHeader>
            <DialogTitle>Escolher imóvel</DialogTitle>
            <DialogDescription>
              Você deve escolher um imóvel para vincular ao processo de locação.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full bg-white"
              onClick={() => setPropertyRequiredDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
              onClick={() => {
                setPropertyRequiredDialogOpen(false);
                setLocation("/imoveis?selecionarLocacao=1");
              }}
            >
              Escolher imóvel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
