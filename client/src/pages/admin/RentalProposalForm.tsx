import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { buildContractReferenceFooter } from "@shared/contract-reference";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, CheckCircle2, ChevronDown, ChevronUp, Download, FileSignature, FileText, Home, MessageCircle, Pencil, Plus, Receipt, RotateCw, Save, Send, ShieldCheck, Trash2, WandSparkles, X } from "lucide-react";
import type { ReactNode } from "react";
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

// Taxa de administracao: a UI usa % e o backend guarda pontos-base de 2 casas
// (10,00% = 1000).
function parsePercentToBasisPoints(value: string) {
  const normalized = value.replace(/[^\d,.]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function formatBasisPointsToPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
}

// Exibe valores em centavos como moeda BRL, sempre com casas decimais (inclusive 0).
function formatCentsBRL(value: number | null | undefined) {
  return ((value ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseUnresolvedVariables(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseVariableValues(
  value: string | null | undefined
): Record<string, string> {
  try {
    const parsed = JSON.parse(value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore
  }
  return {};
}

// Termos a grifar no texto do contrato: valores ja substituidos (variableValues)
// e placeholders que ficaram pendentes (unresolvedVariables). Ordenados do maior
// para o menor para que o casamento prefira o termo mais longo.
function buildHighlightNeedles(contract: {
  variableValues: string;
  unresolvedVariables: string;
}): string[] {
  const values = Object.values(parseVariableValues(contract.variableValues));
  const placeholders = parseUnresolvedVariables(contract.unresolvedVariables).map(
    (item: { placeholder?: string }) => item.placeholder ?? ""
  );
  const needles = new Set<string>();
  for (const raw of [...values, ...placeholders]) {
    const term = (raw ?? "").trim();
    if (term) needles.add(term);
  }
  return Array.from(needles).sort((a, b) => b.length - a.length);
}

type HighlightSegment = { text: string; highlight: boolean };

// Quebra o texto em segmentos, marcando trechos que casam com algum termo de
// variavel. Mescla segmentos nao destacados consecutivos.
function buildHighlightSegments(
  text: string,
  needles: string[]
): HighlightSegment[] {
  if (!text) return [];
  if (needles.length === 0) return [{ text, highlight: false }];

  const segments: HighlightSegment[] = [];
  let index = 0;
  while (index < text.length) {
    const matched = needles.find(needle => text.startsWith(needle, index));
    if (matched) {
      segments.push({ text: matched, highlight: true });
      index += matched.length;
    } else {
      const last = segments[segments.length - 1];
      if (last && !last.highlight) {
        last.text += text[index];
      } else {
        segments.push({ text: text[index], highlight: false });
      }
      index += 1;
    }
  }
  return segments;
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
  boletos?: BoletoOption[];
  insurances?: InsuranceOption[];
  signatures?: SignatureOption[];
  utilityTransfers?: UtilityTransferOption[];
  inspection?: InspectionOption | null;
  property?: {
    id: number;
    titulo?: string | null;
    endereco?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
  } | null;
  tenant?: {
    id: number;
    name: string | null;
    email: string | null;
    phone?: string | null;
  } | null;
  referenceCode?: string | null;
  ownerConfirmedAt: Date | string | null;
  tenantConfirmedAt: Date | string | null;
  leaseTermMonths: number;
  adjustmentIndex: string;
  adjustmentPeriod?: "anual" | "mensal" | null;
  administrationFeePercent?: number | null;
  transferBusinessDays?: number | null;
  terminationPenaltyType?: "valor" | "alugueis" | null;
  terminationPenaltyAmount?: number | null;
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
  variableValues: string;
  unresolvedVariables: string;
  approvedAt?: Date | string | null;
};

type BoletoOption = {
  id: number;
  installmentNumber: number;
  referenceMonth: Date | string;
  dueDate: Date | string;
  rentAmount: number;
  condominiumAmount: number | null;
  extraAmount: number;
  extraDescription: string | null;
  totalAmount: number;
  status: string;
  notes: string | null;
  approvedAt?: Date | string | null;
};

type InsuranceOption = {
  id: number;
  kind: "fianca" | "incendio";
  status: "pendente" | "confirmado" | "dispensado";
  insurer: string | null;
  policyNumber: string | null;
  amount: number | null;
  proofFileName: string | null;
  notes: string | null;
  requestedAt?: Date | string | null;
  confirmedAt: Date | string | null;
};

type SignatureOption = {
  id: number;
  rentalProposalId: number;
  generatedContractId: number;
  provider: string;
  environment: string | null;
  status: "pendente" | "enviado" | "assinado" | "cancelado" | "erro";
  externalDocumentUuid: string | null;
  signersSnapshot: string | null;
  signedFileName: string | null;
  lastError: string | null;
  sentAt?: Date | string | null;
  signedAt?: Date | string | null;
  sentByUserId?: number | null;
};

type UtilityTransferOption = {
  id: number;
  rentalProposalId: number;
  kind: string;
  label: string | null;
  status: "pendente" | "confirmado" | "dispensado";
  proofFileName: string | null;
  notes: string | null;
  requestedAt?: Date | string | null;
  confirmedAt: Date | string | null;
};

type InspectionOption = {
  id: number;
  rentalProposalId: number;
  status: "pendente" | "solicitada" | "concluida";
  inspectorName: string | null;
  inspectorPhone: string | null;
  inspectorEmail: string | null;
  scheduledAt?: Date | string | null;
  requestedAt?: Date | string | null;
  laudoFileName: string | null;
  tenantValidatedAt: Date | string | null;
  ownerValidatedAt: Date | string | null;
  notes: string | null;
};

type RentalProposalFormProps = {
  initialProposal?: InitialRentalProposal | null;
  onDirtyChange?: (isDirty: boolean) => void;
};

function getUserOptionLabel(user: UserOption | null | undefined) {
  if (!user) return "";
  return user.name || user.email || `ID ${user.id}`;
}

// Ordem das etapas do formulario derivada de currentStep. Etapas posteriores a
// "contratos_em_revisao" (boletos, seguros, ... ativo) ficam todas como indice 3.
const RENTAL_STEP_ORDER = [
  "dados_iniciais",
  "modelos_contrato",
  "contratos_em_revisao",
] as const;

// Etapas em que o card de Seguros deve aparecer (etapa de seguros e seguintes).
const SEGUROS_OR_LATER_STEPS = new Set([
  "seguros_pendentes",
  "assinaturas_pendentes",
  "transferencias_pendentes",
  "vistoria_pendente",
  "entrega_chaves_pendente",
  "ativo",
]);

// Etapas em que o card de Assinaturas deve aparecer (etapa de assinaturas e
// seguintes).
const ASSINATURAS_OR_LATER_STEPS = new Set([
  "assinaturas_pendentes",
  "transferencias_pendentes",
  "vistoria_pendente",
  "entrega_chaves_pendente",
  "ativo",
]);

// Etapas posteriores a assinaturas (usadas para marcar o card como concluido).
const APOS_ASSINATURAS_STEPS = new Set([
  "transferencias_pendentes",
  "vistoria_pendente",
  "entrega_chaves_pendente",
  "ativo",
]);

// Etapas em que o card de Transferência de titularidade deve aparecer.
const TRANSFERENCIAS_OR_LATER_STEPS = new Set([
  "transferencias_pendentes",
  "vistoria_pendente",
  "entrega_chaves_pendente",
  "ativo",
]);

// Etapas posteriores às transferências (para marcar o card como concluído).
const APOS_TRANSFERENCIAS_STEPS = new Set([
  "vistoria_pendente",
  "entrega_chaves_pendente",
  "ativo",
]);

const UTILITY_LABELS: Record<"energia" | "agua" | "gas", string> = {
  energia: "Energia elétrica",
  agua: "Água",
  gas: "Gás",
};

// Etapas em que o card de Vistoria deve aparecer.
const VISTORIA_OR_LATER_STEPS = new Set([
  "vistoria_pendente",
  "entrega_chaves_pendente",
  "ativo",
]);

// Etapas posteriores à vistoria (para marcar o card como concluído).
const APOS_VISTORIA_STEPS = new Set(["entrega_chaves_pendente", "ativo"]);

// Monta o endereço completo do imóvel a partir do contexto da proposta.
function buildPropertyAddress(
  property?: InitialRentalProposal["property"]
): string {
  if (!property) return "";
  const street = [property.endereco?.trim(), property.numero?.trim()]
    .filter(Boolean)
    .join(", ");
  const withComplement = [street, property.complemento?.trim()]
    .filter(Boolean)
    .join(" - ");
  const cityState = [property.cidade?.trim(), property.estado?.trim()]
    .filter(Boolean)
    .join("/");
  return [
    withComplement,
    property.bairro?.trim(),
    cityState,
    property.cep?.trim() ? `CEP ${property.cep.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" - ");
}

function getRentalStepIndex(currentStep: string | undefined | null) {
  if (!currentStep) return 0;
  const index = RENTAL_STEP_ORDER.indexOf(
    currentStep as (typeof RENTAL_STEP_ORDER)[number]
  );
  return index === -1 ? RENTAL_STEP_ORDER.length : index;
}

// Scroll suave da janela ate um elemento (mesma animacao do painel de Contratos:
// rAF + easeOutCubic). O alvo alinha a borda superior do elemento com a borda
// inferior do cabecalho fixo (medido dinamicamente).
function smoothScrollWindowToElement(
  element: HTMLElement | null,
  duration = 720
) {
  if (!element) return;
  const header = document.querySelector("header");
  // Pequena folga entre a borda inferior do cabecalho e o topo do card.
  const gap = 16;
  const headerOffset = (header ? header.getBoundingClientRect().height : 0) + gap;
  const startTop = window.scrollY;
  const targetTop = Math.max(
    element.getBoundingClientRect().top + window.scrollY - headerOffset,
    0
  );
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1) return;

  const startTime = performance.now();
  const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

  const animateScroll = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, startTop + distance * easeOutCubic(progress));
    if (progress < 1) {
      requestAnimationFrame(animateScroll);
    }
  };

  requestAnimationFrame(animateScroll);
}

function StepCard({
  icon,
  title,
  subtitle,
  completed,
  open,
  onToggleOpen,
  headerAccessory,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  completed: boolean;
  open: boolean;
  onToggleOpen: () => void;
  headerAccessory?: ReactNode;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    const willOpen = !open;
    onToggleOpen();
    if (willOpen) {
      // Aguarda o corpo expandir antes de ajustar a posicao da tela.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => smoothScrollWindowToElement(cardRef.current));
      });
    }
  };

  return (
    <div
      ref={cardRef}
      className="rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]"
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-start gap-2">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
              {completed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Concluído
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerAccessory}
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </div>
      </button>
      {open ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type RentalInsuranceRecord = InsuranceOption | null;

const INSURANCE_LABELS: Record<"fianca" | "incendio", string> = {
  fianca: "Seguro fian\u00e7a",
  incendio: "Seguro inc\u00eandio",
};

// Bloco de gestao de um seguro (fianca ou incendio) dentro do card de Seguros.
// Cada bloco cuida das proprias mutations e invalida a proposta ao concluir.
function RentalInsuranceBlock({
  proposalId,
  kind,
  record,
  onChanged,
}: {
  proposalId: number;
  kind: "fianca" | "incendio";
  record: RentalInsuranceRecord;
  onChanged: () => Promise<void> | void;
}) {
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  // Preview local do arquivo recém-selecionado (antes de confirmar).
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  // Comprovante já salvo, carregado sob demanda para preview/download.
  const [savedProof, setSavedProof] = useState<{
    dataUrl: string;
    contentType: string;
    fileName: string;
  } | null>(null);

  const status = record?.status ?? "pendente";
  const isConfirmed = status === "confirmado";
  const hasProof = Boolean(record?.proofFileName);

  useEffect(() => {
    setNotes(record?.notes ?? "");
    setFile(null);
  }, [record?.id, record?.status]);

  // Cria/descarta o preview local quando o usuário seleciona uma imagem.
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Carrega o comprovante salvo (preview + download) quando confirmado.
  useEffect(() => {
    if (!isConfirmed || !hasProof) {
      setSavedProof(null);
      return;
    }
    let active = true;
    utils.rentalProposals.insuranceProof
      .fetch({ id: proposalId, kind })
      .then(proof => {
        if (active && proof?.dataUrl) {
          setSavedProof({
            dataUrl: proof.dataUrl,
            contentType: proof.contentType,
            fileName: proof.fileName,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isConfirmed, hasProof, proposalId, kind, utils]);

  const confirmMutation = trpc.rentalProposals.confirmInsurance.useMutation({
    onSuccess: async () => {
      toast.success(`${INSURANCE_LABELS[kind]}: pagamento confirmado.`);
      await onChanged();
    },
    onError: error =>
      toast.error(error.message || "N\u00e3o foi poss\u00edvel confirmar o pagamento."),
  });
  const dispenseMutation = trpc.rentalProposals.dispenseInsurance.useMutation({
    onSuccess: async () => {
      toast.success(`${INSURANCE_LABELS[kind]}: dispensado.`);
      await onChanged();
    },
    onError: error =>
      toast.error(error.message || "N\u00e3o foi poss\u00edvel dispensar o seguro."),
  });
  const reopenMutation = trpc.rentalProposals.reopenInsurance.useMutation({
    onSuccess: async () => {
      toast.success(`${INSURANCE_LABELS[kind]}: reaberto.`);
      await onChanged();
    },
    onError: error =>
      toast.error(error.message || "N\u00e3o foi poss\u00edvel reabrir o seguro."),
  });

  const busy =
    confirmMutation.isPending ||
    dispenseMutation.isPending ||
    reopenMutation.isPending;

  const handleConfirm = async () => {
    let proof: { fileName: string; contentType: string; dataUrl: string } | undefined;
    if (file) {
      // ~10MB binarios = ~13.4MB em base64.
      if (file.size > 10 * 1024 * 1024) {
        toast.error("O comprovante excede o limite de 10MB.");
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        proof = {
          fileName: file.name.slice(0, 255),
          contentType: file.type || "application/octet-stream",
          dataUrl,
        };
      } catch {
        toast.error("N\u00e3o foi poss\u00edvel ler o arquivo do comprovante.");
        return;
      }
    }
    confirmMutation.mutate({
      id: proposalId,
      kind,
      notes: notes.trim() || undefined,
      proof,
    });
  };

  const handleDownloadProof = async () => {
    setDownloading(true);
    try {
      const proof =
        savedProof ??
        (await utils.rentalProposals.insuranceProof.fetch({
          id: proposalId,
          kind,
        }));
      if (!proof?.dataUrl) {
        toast.error("Comprovante n\u00e3o encontrado.");
        return;
      }
      const link = document.createElement("a");
      link.href = proof.dataUrl;
      link.download = proof.fileName || "comprovante";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("N\u00e3o foi poss\u00edvel baixar o comprovante.");
    } finally {
      setDownloading(false);
    }
  };

  const isResolved = status === "confirmado" || status === "dispensado";

  const statusBadge =
    status === "confirmado" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado
      </span>
    ) : status === "dispensado" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
        Dispensado
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        Pendente
      </span>
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          {INSURANCE_LABELS[kind]}
        </p>
        {statusBadge}
      </div>

      {isResolved ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          {status === "confirmado" ? (
            <div className="space-y-2">
              {savedProof && savedProof.contentType.startsWith("image/") ? (
                <img
                  src={savedProof.dataUrl}
                  alt="Comprovante de pagamento"
                  className="max-h-44 w-auto rounded-lg border border-slate-200 object-contain"
                />
              ) : record?.proofFileName ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <FileText className="h-4 w-4 shrink-0" />
                  {record.proofFileName}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Sem comprovante anexado.</p>
              )}
              {record?.proofFileName ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full bg-white"
                  disabled={downloading}
                  onClick={handleDownloadProof}
                >
                  <Download className="h-4 w-4" />
                  {downloading ? "Baixando..." : "Baixar comprovante"}
                </Button>
              ) : null}
              {record?.notes?.trim() ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-semibold">{"Observa\u00e7\u00f5es: "}</span>
                  {record.notes}
                </p>
              ) : null}
            </div>
          ) : (
            <p>{record?.notes?.trim() || "Seguro dispensado para esta loca\u00e7\u00e3o."}</p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-slate-600"
            disabled={busy}
            onClick={() => reopenMutation.mutate({ id: proposalId, kind })}
          >
            <RotateCw className="h-4 w-4" /> Reabrir
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Comprovante de pagamento</Label>
            <Input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
              className={FIELD_CLASS}
              onChange={event => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-slate-400">
              {"Formatos aceitos: PNG, JPG, JPEG, WEBP ou PDF (m\u00e1x. 10MB)."}
            </p>
          </div>
          {localPreviewUrl ? (
            <img
              src={localPreviewUrl}
              alt={"Pr\u00e9-visualiza\u00e7\u00e3o do comprovante"}
              className="max-h-44 w-auto rounded-lg border border-slate-200 object-contain"
            />
          ) : file ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <FileText className="h-4 w-4 shrink-0" />
              {file.name}
            </div>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs">{"Observa\u00e7\u00f5es"}</Label>
            <Textarea
              className={FIELD_CLASS}
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-full bg-white"
              disabled={busy}
              onClick={() => dispenseMutation.mutate({ id: proposalId, kind })}
            >
              <X className="h-4 w-4" /> Dispensar
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={busy}
              onClick={handleConfirm}
            >
              <CheckCircle2 className="h-4 w-4" />
              {confirmMutation.isPending ? "Confirmando..." : "Confirmar Pagamento"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
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

// Bloco de assinatura de um contrato aprovado (etapa 24). Cuida das proprias
// mutations (enviar/atualizar/cancelar) e do download do PDF assinado.
function RentalSignatureBlock({
  proposalId,
  contract,
  record,
  configured,
  onChanged,
}: {
  proposalId: number;
  contract: GeneratedContractOption;
  record: SignatureOption | null;
  configured: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const utils = trpc.useUtils();
  const [downloading, setDownloading] = useState(false);
  const [manualFile, setManualFile] = useState<File | null>(null);

  const sendMutation = trpc.rentalProposals.sendForSignature.useMutation({
    onSuccess: async () => {
      toast.success("Contrato enviado para assinatura na D4Sign.");
      await onChanged();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível enviar para assinatura."),
  });
  const refreshMutation =
    trpc.rentalProposals.refreshSignatureStatus.useMutation({
      onSuccess: async result => {
        const status = result.signature?.status;
        toast.success(
          status === "assinado"
            ? "Contrato assinado por todos!"
            : "Status atualizado."
        );
        await onChanged();
      },
      onError: error =>
        toast.error(error.message || "Não foi possível consultar a D4Sign."),
    });
  const cancelMutation = trpc.rentalProposals.cancelSignature.useMutation({
    onSuccess: async () => {
      toast.success("Assinatura cancelada.");
      await onChanged();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível cancelar a assinatura."),
  });
  const markManualMutation =
    trpc.rentalProposals.markSignatureSignedManually.useMutation({
      onSuccess: async () => {
        toast.success("Contrato marcado como assinado.");
        setManualFile(null);
        await onChanged();
      },
      onError: error =>
        toast.error(error.message || "Não foi possível marcar como assinado."),
    });

  const busy =
    sendMutation.isPending ||
    refreshMutation.isPending ||
    cancelMutation.isPending ||
    markManualMutation.isPending;

  const status = record?.status ?? "pendente";
  const canSend =
    status === "pendente" || status === "cancelado" || status === "erro";

  const signers: Array<{ displayName?: string; email?: string; role?: string }> =
    (() => {
      if (!record?.signersSnapshot) return [];
      try {
        const parsed = JSON.parse(record.signersSnapshot);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

  const handleDownloadSigned = async () => {
    if (!record) return;
    setDownloading(true);
    try {
      const proof = await utils.rentalProposals.signatureProof.fetch({
        signatureId: record.id,
      });
      if (!proof?.dataUrl) {
        toast.error("PDF assinado ainda não disponível.");
        return;
      }
      const link = document.createElement("a");
      link.href = proof.dataUrl;
      link.download = proof.fileName || "contrato-assinado.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Não foi possível baixar o PDF assinado.");
    } finally {
      setDownloading(false);
    }
  };

  const handleMarkManual = async () => {
    let proof:
      | { fileName: string; contentType: string; dataUrl: string }
      | undefined;
    if (manualFile) {
      if (manualFile.size > 10 * 1024 * 1024) {
        toast.error("O arquivo excede o limite de 10MB.");
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(manualFile);
        proof = {
          fileName: manualFile.name.slice(0, 255),
          contentType: manualFile.type || "application/octet-stream",
          dataUrl,
        };
      } catch {
        toast.error("Não foi possível ler o arquivo.");
        return;
      }
    }
    markManualMutation.mutate({
      id: proposalId,
      contractId: contract.id,
      proof,
    });
  };

  const statusBadge =
    status === "assinado" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Assinado
      </span>
    ) : status === "enviado" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
        Aguardando assinatura
      </span>
    ) : status === "cancelado" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
        Cancelado
      </span>
    ) : status === "erro" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Erro no envio
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        Pendente
      </span>
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileSignature className="h-4 w-4 text-emerald-700" />
          {contract.title}
        </p>
        {statusBadge}
      </div>

      {signers.length > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Signatários: {signers.map(s => s.displayName || s.email).join(", ")}
        </p>
      ) : null}

      {status === "erro" && record?.lastError ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {record.lastError}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {canSend ? (
          <Button
            type="button"
            className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
            size="sm"
            disabled={busy || !configured}
            onClick={() =>
              sendMutation.mutate({ id: proposalId, contractId: contract.id })
            }
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? "Enviando..." : "Enviar para assinatura"}
          </Button>
        ) : null}

        {status === "enviado" ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-full bg-white"
              disabled={busy}
              onClick={() =>
                refreshMutation.mutate({ signatureId: record!.id })
              }
            >
              <RotateCw className="h-4 w-4" />
              {refreshMutation.isPending ? "Consultando..." : "Atualizar status"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-slate-600"
              disabled={busy}
              onClick={() => cancelMutation.mutate({ signatureId: record!.id })}
            >
              <X className="h-4 w-4" /> Cancelar
            </Button>
          </>
        ) : null}

        {status === "assinado" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-full bg-white"
            disabled={downloading}
            onClick={handleDownloadSigned}
          >
            <Download className="h-4 w-4" />
            {downloading ? "Baixando..." : "Baixar PDF assinado"}
          </Button>
        ) : null}
      </div>

      {!configured && canSend ? (
        <p className="mt-2 text-xs text-amber-700">
          Configure as credenciais da D4Sign no servidor (.env) para habilitar o
          envio.
        </p>
      ) : null}

      {status !== "assinado" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
          <p className="text-xs font-medium text-slate-600">
            {"Sem D4Sign? Marque como assinado manualmente (assinatura coletada por fora):"}
          </p>
          <Input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            className={FIELD_CLASS}
            onChange={event => setManualFile(event.target.files?.[0] ?? null)}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {"Anexo opcional do PDF/foto do contrato assinado."}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-full bg-white"
              disabled={busy}
              onClick={handleMarkManual}
            >
              <CheckCircle2 className="h-4 w-4" />
              {markManualMutation.isPending
                ? "Salvando..."
                : "Marcar como assinado"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Bloco de uma conta (energia/agua/gas) na etapa de transferencia de
// titularidade. Comprovante + observacoes, com preview, no mesmo padrao do
// card de Seguros.
function RentalUtilityTransferBlock({
  proposalId,
  kind,
  record,
  onChanged,
}: {
  proposalId: number;
  kind: string;
  record: UtilityTransferOption | null;
  onChanged: () => Promise<void> | void;
}) {
  const utils = trpc.useUtils();
  const displayName =
    record?.label ||
    UTILITY_LABELS[kind as "energia" | "agua" | "gas"] ||
    kind;
  const removable = kind.startsWith("custom_");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [savedProof, setSavedProof] = useState<{
    dataUrl: string;
    contentType: string;
    fileName: string;
  } | null>(null);

  const status = record?.status ?? "pendente";
  const isConfirmed = status === "confirmado";
  const hasProof = Boolean(record?.proofFileName);

  useEffect(() => {
    setNotes(record?.notes ?? "");
    setFile(null);
  }, [record?.id, record?.status]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!isConfirmed || !hasProof) {
      setSavedProof(null);
      return;
    }
    let active = true;
    utils.rentalProposals.utilityTransferProof
      .fetch({ id: proposalId, kind })
      .then(proof => {
        if (active && proof?.dataUrl) {
          setSavedProof({
            dataUrl: proof.dataUrl,
            contentType: proof.contentType,
            fileName: proof.fileName,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isConfirmed, hasProof, proposalId, kind, utils]);

  const confirmMutation =
    trpc.rentalProposals.confirmUtilityTransfer.useMutation({
      onSuccess: async () => {
        toast.success(`${displayName}: transferência confirmada.`);
        await onChanged();
      },
      onError: error =>
        toast.error(error.message || "Não foi possível confirmar."),
    });
  const dispenseMutation =
    trpc.rentalProposals.dispenseUtilityTransfer.useMutation({
      onSuccess: async () => {
        toast.success(`${displayName}: dispensada.`);
        await onChanged();
      },
      onError: error =>
        toast.error(error.message || "Não foi possível dispensar."),
    });
  const reopenMutation = trpc.rentalProposals.reopenUtilityTransfer.useMutation({
    onSuccess: async () => {
      toast.success(`${displayName}: reaberta.`);
      await onChanged();
    },
    onError: error => toast.error(error.message || "Não foi possível reabrir."),
  });
  const removeMutation = trpc.rentalProposals.removeUtilityTransfer.useMutation({
    onSuccess: async () => {
      toast.success(`${displayName}: conta removida.`);
      await onChanged();
    },
    onError: error => toast.error(error.message || "Não foi possível remover."),
  });

  const busy =
    confirmMutation.isPending ||
    dispenseMutation.isPending ||
    reopenMutation.isPending ||
    removeMutation.isPending;

  const handleConfirm = async () => {
    let proof:
      | { fileName: string; contentType: string; dataUrl: string }
      | undefined;
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("O comprovante excede o limite de 10MB.");
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        proof = {
          fileName: file.name.slice(0, 255),
          contentType: file.type || "application/octet-stream",
          dataUrl,
        };
      } catch {
        toast.error("Não foi possível ler o arquivo do comprovante.");
        return;
      }
    }
    confirmMutation.mutate({
      id: proposalId,
      kind,
      notes: notes.trim() || undefined,
      proof,
    });
  };

  const handleDownloadProof = async () => {
    setDownloading(true);
    try {
      const proof =
        savedProof ??
        (await utils.rentalProposals.utilityTransferProof.fetch({
          id: proposalId,
          kind,
        }));
      if (!proof?.dataUrl) {
        toast.error("Comprovante não encontrado.");
        return;
      }
      const link = document.createElement("a");
      link.href = proof.dataUrl;
      link.download = proof.fileName || "comprovante";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Não foi possível baixar o comprovante.");
    } finally {
      setDownloading(false);
    }
  };

  const isResolved = status === "confirmado" || status === "dispensado";

  const statusBadge =
    status === "confirmado" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Confirmada
      </span>
    ) : status === "dispensado" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
        Dispensada
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        Pendente
      </span>
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileText className="h-4 w-4 text-emerald-700" />
          {displayName}
        </p>
        <div className="flex items-center gap-2">
          {statusBadge}
          {removable ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-full text-slate-400 hover:text-red-600"
              disabled={busy}
              onClick={() => removeMutation.mutate({ id: proposalId, kind })}
              aria-label="Remover conta"
              title="Remover conta"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {isResolved ? (
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {isConfirmed ? (
            <div className="space-y-2">
              {savedProof && savedProof.contentType.startsWith("image/") ? (
                <img
                  src={savedProof.dataUrl}
                  alt={"Comprovante de transferência"}
                  className="max-h-44 w-auto rounded-lg border border-slate-200 object-contain"
                />
              ) : record?.proofFileName ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <FileText className="h-4 w-4 shrink-0" />
                  {record.proofFileName}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {"Sem comprovante anexado."}
                </p>
              )}
              {record?.proofFileName ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full bg-white"
                  disabled={downloading}
                  onClick={handleDownloadProof}
                >
                  <Download className="h-4 w-4" />
                  {downloading ? "Baixando..." : "Baixar comprovante"}
                </Button>
              ) : null}
              {record?.notes?.trim() ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-semibold">{"Observações: "}</span>
                  {record.notes}
                </p>
              ) : null}
            </div>
          ) : (
            <p>{record?.notes?.trim() || "Conta dispensada para esta locação."}</p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-slate-600"
            disabled={busy}
            onClick={() => reopenMutation.mutate({ id: proposalId, kind })}
          >
            <RotateCw className="h-4 w-4" /> Reabrir
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{"Comprovante de transferência"}</Label>
            <Input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
              className={FIELD_CLASS}
              onChange={event => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-slate-400">
              {"Formatos aceitos: PNG, JPG, JPEG, WEBP ou PDF (máx. 10MB)."}
            </p>
          </div>
          {localPreviewUrl ? (
            <img
              src={localPreviewUrl}
              alt={"Pré-visualização do comprovante"}
              className="max-h-44 w-auto rounded-lg border border-slate-200 object-contain"
            />
          ) : file ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <FileText className="h-4 w-4 shrink-0" />
              {file.name}
            </div>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs">{"Observações"}</Label>
            <Textarea
              className={FIELD_CLASS}
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-full bg-white"
              disabled={busy}
              onClick={() => dispenseMutation.mutate({ id: proposalId, kind })}
            >
              <X className="h-4 w-4" /> Dispensar
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={busy}
              onClick={handleConfirm}
            >
              <CheckCircle2 className="h-4 w-4" />
              {confirmMutation.isPending ? "Confirmando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Painel da etapa de Vistoria e laudo (etapas 27-28): contato do vistoriador,
// solicitação (wa.me), upload do laudo e validação do locatário/proprietário.
function RentalInspectionPanel({
  proposalId,
  record,
  referenceCode,
  propertyAddress,
  onChanged,
}: {
  proposalId: number;
  record: InspectionOption | null;
  referenceCode: string | null;
  propertyAddress: string;
  onChanged: () => Promise<void> | void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(record?.inspectorName ?? "");
  const [phone, setPhone] = useState(record?.inspectorPhone ?? "");
  const [email, setEmail] = useState(record?.inspectorEmail ?? "");
  const [laudoFile, setLaudoFile] = useState<File | null>(null);
  const [laudoNotes, setLaudoNotes] = useState(record?.notes ?? "");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setName(record?.inspectorName ?? "");
    setPhone(record?.inspectorPhone ?? "");
    setEmail(record?.inspectorEmail ?? "");
    setLaudoNotes(record?.notes ?? "");
    setLaudoFile(null);
  }, [
    record?.id,
    record?.requestedAt,
    record?.laudoFileName,
    record?.inspectorName,
  ]);

  const requestMutation = trpc.rentalProposals.requestInspection.useMutation({
    onSuccess: async () => {
      toast.success("Vistoria solicitada. Use o WhatsApp para avisar o vistoriador.");
      await onChanged();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível solicitar a vistoria."),
  });
  const uploadMutation = trpc.rentalProposals.uploadInspectionLaudo.useMutation({
    onSuccess: async () => {
      toast.success("Laudo anexado.");
      await onChanged();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível anexar o laudo."),
  });
  const validationMutation =
    trpc.rentalProposals.setInspectionValidation.useMutation({
      onSuccess: async () => {
        await onChanged();
      },
      onError: error =>
        toast.error(error.message || "Não foi possível atualizar a validação."),
    });

  const busy =
    requestMutation.isPending ||
    uploadMutation.isPending ||
    validationMutation.isPending;

  const requested = Boolean(record?.requestedAt);
  const hasLaudo = Boolean(record?.laudoFileName);
  const tenantValidated = Boolean(record?.tenantValidatedAt);
  const ownerValidated = Boolean(record?.ownerValidatedAt);

  const handleRequest = () => {
    if (!name.trim()) {
      toast.error("Informe o nome do vistoriador.");
      return;
    }
    requestMutation.mutate({
      id: proposalId,
      inspectorName: name.trim(),
      inspectorPhone: phone.trim() || undefined,
      inspectorEmail: email.trim() || undefined,
    });
  };

  const handleUploadLaudo = async () => {
    if (!laudoFile) {
      toast.error("Selecione o arquivo do laudo.");
      return;
    }
    if (laudoFile.size > 10 * 1024 * 1024) {
      toast.error("O laudo excede o limite de 10MB.");
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await readFileAsDataUrl(laudoFile);
    } catch {
      toast.error("Não foi possível ler o arquivo do laudo.");
      return;
    }
    uploadMutation.mutate({
      id: proposalId,
      notes: laudoNotes.trim() || undefined,
      proof: {
        fileName: laudoFile.name.slice(0, 255),
        contentType: laudoFile.type || "application/octet-stream",
        dataUrl,
      },
    });
  };

  const handleDownloadLaudo = async () => {
    setDownloading(true);
    try {
      const laudo = await utils.rentalProposals.inspectionLaudo.fetch({
        id: proposalId,
      });
      if (!laudo?.dataUrl) {
        toast.error("Laudo não encontrado.");
        return;
      }
      const link = document.createElement("a");
      link.href = laudo.dataUrl;
      link.download = laudo.fileName || "laudo";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Não foi possível baixar o laudo.");
    } finally {
      setDownloading(false);
    }
  };

  const phoneDigits = (record?.inspectorPhone ?? phone).replace(/\D/g, "");
  const waNumber = phoneDigits
    ? phoneDigits.startsWith("55")
      ? phoneDigits
      : `55${phoneDigits}`
    : "";
  const waMessage = encodeURIComponent(
    `Ola${record?.inspectorName ? `, ${record.inspectorName}` : ""}! ` +
      `Temos uma solicitacao de vistoria de imovel${
        referenceCode ? ` (${referenceCode})` : ""
      }.` +
      (propertyAddress ? ` Endereco do imovel: ${propertyAddress}.` : "") +
      ` Podemos agendar?`
  );
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waMessage}` : "";

  const ValidationButton = ({
    party,
    label,
    validated,
  }: {
    party: "tenant" | "owner";
    label: string;
    validated: boolean;
  }) => (
    <Button
      type="button"
      variant={validated ? "outline" : "default"}
      size="sm"
      className={
        validated
          ? "gap-2 rounded-full border-emerald-200 bg-emerald-50 text-emerald-800"
          : "gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
      }
      disabled={busy || !hasLaudo}
      onClick={() =>
        validationMutation.mutate({
          id: proposalId,
          party,
          validated: !validated,
        })
      }
    >
      <CheckCircle2 className="h-4 w-4" />
      {validated ? `${label} validou ✓` : `Marcar: ${label} validou`}
    </Button>
  );

  return (
    <div className="space-y-4">
      {propertyAddress ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span className="font-semibold">{"Imóvel da vistoria: "}</span>
          {propertyAddress}
        </div>
      ) : null}
      {/* 1) Contato do vistoriador + solicitação */}
      <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">
          {"1. Vistoriador"}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">{"Nome"}</Label>
            <Input
              className={FIELD_CLASS}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Nome do vistoriador"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{"Telefone (WhatsApp)"}</Label>
            <Input
              className={FIELD_CLASS}
              value={phone}
              onChange={event => setPhone(event.target.value)}
              placeholder="(11) 90000-0000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{"E-mail (opcional)"}</Label>
            <Input
              className={FIELD_CLASS}
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
            size="sm"
            disabled={busy}
            onClick={handleRequest}
          >
            <Send className="h-4 w-4" />
            {requestMutation.isPending
              ? "Salvando..."
              : requested
                ? "Atualizar vistoriador"
                : "Solicitar vistoria"}
          </Button>
          {requested && waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4" />
              {"Avisar por WhatsApp"}
            </a>
          ) : null}
          {requested ? (
            <span className="text-xs text-emerald-700">
              {"Vistoria solicitada."}
            </span>
          ) : null}
        </div>
      </div>

      {/* 2) Laudo */}
      {requested ? (
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">
            {"2. Laudo de vistoria"}
          </p>
          {hasLaudo ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <FileText className="h-4 w-4 shrink-0" />
                {record?.laudoFileName}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full bg-white"
                disabled={downloading}
                onClick={handleDownloadLaudo}
              >
                <Download className="h-4 w-4" />
                {downloading ? "Baixando..." : "Baixar laudo"}
              </Button>
            </div>
          ) : null}
          <div className="mt-3 space-y-1">
            <Label className="text-xs">
              {hasLaudo ? "Substituir laudo (opcional)" : "Anexar laudo"}
            </Label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              className={FIELD_CLASS}
              onChange={event => setLaudoFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="mt-2 space-y-1">
            <Label className="text-xs">{"Observações"}</Label>
            <Textarea
              className={FIELD_CLASS}
              value={laudoNotes}
              onChange={event => setLaudoNotes(event.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-full bg-white"
              disabled={busy || !laudoFile}
              onClick={handleUploadLaudo}
            >
              <FileText className="h-4 w-4" />
              {uploadMutation.isPending ? "Enviando..." : "Salvar laudo"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* 3) Validação do estado do imóvel */}
      {hasLaudo ? (
        <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <p className="mb-1 text-sm font-semibold text-slate-900">
            {"3. Validação do estado do imóvel"}
          </p>
          <p className="mb-3 text-xs text-slate-500">
            {"Confirme a validação do laudo pelo locatário e pelo proprietário."}
          </p>
          <div className="flex flex-wrap gap-2">
            <ValidationButton
              party="tenant"
              label="Locatário"
              validated={tenantValidated}
            />
            <ValidationButton
              party="owner"
              label="Proprietário"
              validated={ownerValidated}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function RentalProposalForm({
  initialProposal = null,
  onDirtyChange,
}: RentalProposalFormProps) {
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const initialPropertyId = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : location.split("?")[1] ?? ""
  ).get("propertyId");
  const isEditing = Boolean(initialProposal);
  const canEditTemplates =
    initialProposal?.currentStep === "modelos_contrato" ||
    initialProposal?.currentStep === "contratos_em_revisao" ||
    initialProposal?.currentStep === "boletos_pendentes";
  // Gestao dos contratos ja gerados (editar texto, regerar, aprovar, excluir).
  const canManageContracts =
    initialProposal?.currentStep === "contratos_em_revisao" ||
    initialProposal?.currentStep === "boletos_pendentes";
  const stepIndex = isEditing ? getRentalStepIndex(initialProposal?.currentStep) : 0;
  const dadosCompleted = stepIndex >= 1;
  const modelosReached = stepIndex >= 1;
  const contratosReached = stepIndex >= 2;
  const contratosCompleted = stepIndex >= 3;
  const [openDados, setOpenDados] = useState(true);
  const [openModelos, setOpenModelos] = useState(true);
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
  const [adjustmentPeriod, setAdjustmentPeriod] = useState<"anual" | "mensal">("anual");
  const [administrationFeePercent, setAdministrationFeePercent] = useState("");
  const [transferBusinessDays, setTransferBusinessDays] = useState("");
  const [terminationPenaltyType, setTerminationPenaltyType] = useState<"valor" | "alugueis">("valor");
  const [terminationPenaltyAmount, setTerminationPenaltyAmount] = useState("");
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
  const [contractToRegenerate, setContractToRegenerate] = useState<GeneratedContractOption | null>(null);
  const [contractToDelete, setContractToDelete] = useState<GeneratedContractOption | null>(null);
  const [downloadingContractId, setDownloadingContractId] = useState<number | null>(null);
  const [openBoletos, setOpenBoletos] = useState(false);
  const [openSeguros, setOpenSeguros] = useState(false);
  const [openAssinaturas, setOpenAssinaturas] = useState(false);
  const [openTransferencias, setOpenTransferencias] = useState(false);
  const [newUtilityLabel, setNewUtilityLabel] = useState("");
  const [openVistoria, setOpenVistoria] = useState(false);
  const contractHighlightNeedles = useMemo(
    () => (editingGeneratedContract ? buildHighlightNeedles(editingGeneratedContract) : []),
    [editingGeneratedContract]
  );
  const contractHighlightSegments = useMemo(
    () => buildHighlightSegments(contractReviewText, contractHighlightNeedles),
    [contractReviewText, contractHighlightNeedles]
  );

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
    setAdjustmentPeriod(initialProposal.adjustmentPeriod === "mensal" ? "mensal" : "anual");
    setAdministrationFeePercent(formatBasisPointsToPercent(initialProposal.administrationFeePercent));
    setTransferBusinessDays(
      initialProposal.transferBusinessDays === null || initialProposal.transferBusinessDays === undefined
        ? ""
        : String(initialProposal.transferBusinessDays)
    );
    setTerminationPenaltyType(initialProposal.terminationPenaltyType === "alugueis" ? "alugueis" : "valor");
    setTerminationPenaltyAmount(
      initialProposal.terminationPenaltyAmount === null || initialProposal.terminationPenaltyAmount === undefined
        ? ""
        : initialProposal.terminationPenaltyType === "alugueis"
          ? String(initialProposal.terminationPenaltyAmount)
          : formatCurrencyInput(initialProposal.terminationPenaltyAmount)
    );
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

    // Estado de colapso derivado da conclusao: etapa concluida abre minimizada,
    // etapa atual abre expandida (escolha "derivar da conclusao").
    const index = getRentalStepIndex(initialProposal.currentStep);
    setOpenDados(index < 1);
    setOpenModelos(index >= 1 && index < 3);
    // Etapa de boletos (e seguintes) abre o card de boletos expandido.
    setOpenBoletos(index >= 3);
    // O card de seguros abre expandido enquanto a proposta esta nessa etapa.
    setOpenSeguros(initialProposal.currentStep === "seguros_pendentes");
    // O card de assinaturas abre expandido enquanto a proposta esta nessa etapa.
    setOpenAssinaturas(
      initialProposal.currentStep === "assinaturas_pendentes"
    );
    // O card de transferencias abre expandido enquanto a proposta esta nessa etapa.
    setOpenTransferencias(
      initialProposal.currentStep === "transferencias_pendentes"
    );
    // O card de vistoria abre expandido enquanto a proposta esta nessa etapa.
    setOpenVistoria(initialProposal.currentStep === "vistoria_pendente");
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
      if (data.referenceCode) {
        toast.success(`Todos os contratos aprovados. Código de referência: ${data.referenceCode}`);
      } else {
        toast.success(data.allApproved ? "Todos os contratos foram aprovados." : "Contrato aprovado.");
      }
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel aprovar o contrato.");
    },
  });

  const regenerateGeneratedContract = trpc.rentalProposals.regenerateGeneratedContract.useMutation({
    onSuccess: async () => {
      toast.success("Contrato gerado novamente a partir do modelo atual.");
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel gerar o contrato novamente.");
    },
  });

  const deleteGeneratedContract = trpc.rentalProposals.deleteGeneratedContract.useMutation({
    onSuccess: async () => {
      toast.success("Contrato excluído.");
      setContractToDelete(null);
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel excluir o contrato.");
    },
  });

  const updateContractTemplatesInReview = trpc.rentalProposals.updateContractTemplatesInReview.useMutation({
    onSuccess: async data => {
      const parts: string[] = [];
      if (data.added) parts.push(`${data.added} adicionado(s)`);
      if (data.removed) parts.push(`${data.removed} removido(s)`);
      toast.success(
        parts.length ? `Modelos atualizados (${parts.join(", ")}).` : "Modelos atualizados."
      );
      setTemplateSelectionDirty(false);
      await utils.rentalProposals.list.invalidate();
      if (initialProposal) {
        await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
      }
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar os modelos.");
    },
  });

  const invalidateProposal = async () => {
    await utils.rentalProposals.list.invalidate();
    if (initialProposal) {
      await utils.rentalProposals.getById.invalidate({ id: initialProposal.id });
    }
  };

  const generateBoletos = trpc.rentalProposals.generateBoletos.useMutation({
    onSuccess: async data => {
      toast.success(
        data.created > 0
          ? `${data.created} boleto(s) gerado(s). O processo avançou para a etapa de seguros. Gerencie-os na aba Boletos.`
          : "Os boletos já haviam sido gerados."
      );
      await invalidateProposal();
    },
    onError: error => {
      toast.error(error.message || "Não foi possível gerar os boletos.");
    },
  });

  const resendInsuranceRequest =
    trpc.rentalProposals.resendInsuranceRequest.useMutation({
      onSuccess: async data => {
        toast.success(
          data.emailSent
            ? "Solicitação de comprovantes reenviada por e-mail."
            : "Solicitação registrada (locatário sem e-mail cadastrado)."
        );
        await invalidateProposal();
      },
      onError: error =>
        toast.error(error.message || "Não foi possível reenviar a solicitação."),
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

    const administrationFeeInBasisPoints = parsePercentToBasisPoints(administrationFeePercent);
    if (!administrationFeePercent.trim()) {
      toast.error("Informe a taxa de administracao do aluguel.");
      return;
    }
    if (!transferBusinessDays.trim() || !Number.isFinite(Number(transferBusinessDays))) {
      toast.error("Informe os dias uteis para repasse do aluguel.");
      return;
    }
    const terminationPenaltyValue =
      terminationPenaltyType === "alugueis"
        ? Number(terminationPenaltyAmount.replace(/[^\d]/g, ""))
        : parseCurrencyToCents(terminationPenaltyAmount);
    if (!terminationPenaltyAmount.trim() || !Number.isFinite(terminationPenaltyValue) || terminationPenaltyValue <= 0) {
      toast.error(
        terminationPenaltyType === "alugueis"
          ? "Informe a quantidade de alugueis da multa rescisoria."
          : "Informe o valor da multa rescisoria."
      );
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
      adjustmentPeriod,
      administrationFeePercent: administrationFeeInBasisPoints,
      transferBusinessDays: Number(transferBusinessDays),
      terminationPenaltyType,
      terminationPenaltyAmount: terminationPenaltyValue,
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

  const saveTemplatesInReview = () => {
    if (!initialProposal) return;
    if (selectedContractTemplateIds.length === 0) {
      toast.error("Selecione ao menos um modelo de contrato.");
      return;
    }

    updateContractTemplatesInReview.mutate({
      id: initialProposal.id,
      contractTemplateIds: selectedContractTemplateIds.map(Number),
    });
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

  const regenerateContract = (contract: GeneratedContractOption) => {
    setContractToRegenerate(contract);
  };

  const confirmRegenerateContract = () => {
    if (!contractToRegenerate) return;
    regenerateGeneratedContract.mutate(
      { contractId: contractToRegenerate.id },
      { onSettled: () => setContractToRegenerate(null) }
    );
  };

  const deleteContract = (contract: GeneratedContractOption) => {
    setContractToDelete(contract);
  };

  const confirmDeleteContract = () => {
    if (!contractToDelete) return;
    deleteGeneratedContract.mutate({ contractId: contractToDelete.id });
  };

  const downloadContractDocx = async (contract: GeneratedContractOption) => {
    setDownloadingContractId(contract.id);
    try {
      const { fileName, dataUrl } =
        await utils.rentalProposals.generatedContractDocx.fetch({
          contractId: contract.id,
        });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o documento do contrato."
      );
    } finally {
      setDownloadingContractId(null);
    }
  };

  const generatedContracts = initialProposal?.generatedContracts ?? [];
  const allGeneratedContractsApproved =
    generatedContracts.length > 0 &&
    generatedContracts.every(contract => contract.status === "aprovado");

  // Etapa 24 (Assinaturas): disponivel a partir de "assinaturas_pendentes".
  const assinaturasReached =
    isEditing &&
    ASSINATURAS_OR_LATER_STEPS.has(initialProposal?.currentStep ?? "");
  const signaturesQuery = trpc.rentalProposals.signatures.useQuery(
    { id: initialProposal?.id ?? 0 },
    { enabled: Boolean(assinaturasReached && initialProposal) }
  );
  const signaturesConfigured = signaturesQuery.data?.configured ?? false;
  const signatureRecords = signaturesQuery.data?.signatures ?? [];
  const approvedContracts = generatedContracts.filter(
    contract => contract.status === "aprovado"
  );
  const assinaturasCompleted = APOS_ASSINATURAS_STEPS.has(
    initialProposal?.currentStep ?? ""
  );
  const invalidateSignatures = async () => {
    await invalidateProposal();
    if (initialProposal) {
      await utils.rentalProposals.signatures.invalidate({
        id: initialProposal.id,
      });
    }
  };

  // Etapas 25-26 (Transferência de titularidade de contas).
  const transferenciasReached =
    isEditing &&
    TRANSFERENCIAS_OR_LATER_STEPS.has(initialProposal?.currentStep ?? "");
  const utilityTransfersQuery = trpc.rentalProposals.utilityTransfers.useQuery(
    { id: initialProposal?.id ?? 0 },
    { enabled: Boolean(transferenciasReached && initialProposal) }
  );
  const utilityTransfers = utilityTransfersQuery.data ?? [];
  const utilityByKind = (kind: "energia" | "agua" | "gas") =>
    utilityTransfers.find(item => item.kind === kind) ?? null;
  // Contas padrao primeiro (na ordem energia/agua/gas), depois as personalizadas.
  const utilityOrderIndex = (kind: string) => {
    const index = ["energia", "agua", "gas"].indexOf(kind);
    return index === -1 ? 99 : index;
  };
  const orderedUtilityTransfers = [...utilityTransfers].sort(
    (a, b) => utilityOrderIndex(a.kind) - utilityOrderIndex(b.kind)
  );
  const transferenciasCompleted = APOS_TRANSFERENCIAS_STEPS.has(
    initialProposal?.currentStep ?? ""
  );
  const invalidateUtilityTransfers = async () => {
    await invalidateProposal();
    if (initialProposal) {
      await utils.rentalProposals.utilityTransfers.invalidate({
        id: initialProposal.id,
      });
    }
  };
  const addUtilityTransfer = trpc.rentalProposals.addUtilityTransfer.useMutation({
    onSuccess: async () => {
      toast.success("Conta adicionada.");
      setNewUtilityLabel("");
      await invalidateUtilityTransfers();
    },
    onError: error =>
      toast.error(error.message || "Não foi possível adicionar a conta."),
  });

  // Etapas 27-28 (Vistoria e laudo).
  const vistoriaReached =
    isEditing && VISTORIA_OR_LATER_STEPS.has(initialProposal?.currentStep ?? "");
  const inspectionQuery = trpc.rentalProposals.inspection.useQuery(
    { id: initialProposal?.id ?? 0 },
    { enabled: Boolean(vistoriaReached && initialProposal) }
  );
  const inspection = inspectionQuery.data ?? null;
  const vistoriaCompleted = APOS_VISTORIA_STEPS.has(
    initialProposal?.currentStep ?? ""
  );
  const invalidateInspection = async () => {
    await invalidateProposal();
    if (initialProposal) {
      await utils.rentalProposals.inspection.invalidate({
        id: initialProposal.id,
      });
    }
  };
  const proposalReferenceCode = initialProposal?.referenceCode ?? null;
  const appliedTemplateIds = (initialProposal?.contractTemplates ?? [])
    .map(template => String(template.id))
    .slice()
    .sort();
  const templatesChanged =
    appliedTemplateIds.join(",") !==
    selectedContractTemplateIds.slice().sort().join(",");

  const boletos = initialProposal?.boletos ?? [];
  // Etapa de boletos disponivel a partir da geracao do codigo de referencia.
  const boletosReached =
    isEditing &&
    (initialProposal?.currentStep === "boletos_pendentes" ||
      getRentalStepIndex(initialProposal?.currentStep) >= 3);
  // A geracao so ocorre na etapa boletos_pendentes; depois disso o processo ja
  // avancou e o gerenciamento acontece na sub-pagina de Boletos.
  const canGenerateBoletos =
    initialProposal?.currentStep === "boletos_pendentes";
  const boletosTotalAmount = boletos.reduce(
    (sum, boleto) => sum + boleto.totalAmount,
    0
  );

  // Etapa de seguros: disponivel a partir de "seguros_pendentes" em diante.
  const insurances = initialProposal?.insurances ?? [];
  const segurosReached =
    isEditing &&
    (SEGUROS_OR_LATER_STEPS.has(initialProposal?.currentStep ?? "") ||
      insurances.length > 0);
  const fiancaInsurance =
    insurances.find(item => item.kind === "fianca") ?? null;
  const incendioInsurance =
    insurances.find(item => item.kind === "incendio") ?? null;
  const isInsuranceResolved = (status?: string) =>
    status === "confirmado" || status === "dispensado";
  const segurosCompleted =
    isInsuranceResolved(fiancaInsurance?.status) &&
    isInsuranceResolved(incendioInsurance?.status);

  // Link wa.me (admin clica e envia): telefone do locatario + mensagem pronta.
  const tenantPhoneDigits = (initialProposal?.tenant?.phone ?? "").replace(
    /\D/g,
    ""
  );
  const tenantWhatsappNumber = tenantPhoneDigits
    ? tenantPhoneDigits.startsWith("55")
      ? tenantPhoneDigits
      : `55${tenantPhoneDigits}`
    : "";
  const insuranceWhatsappMessage = encodeURIComponent(
    `Ola${initialProposal?.tenant?.name ? `, ${initialProposal.tenant.name}` : ""}! ` +
      `Para prosseguir com a sua locacao${
        initialProposal?.referenceCode
          ? ` (${initialProposal.referenceCode})`
          : ""
      }, precisamos dos comprovantes das primeiras parcelas do seguro fianca e do seguro incendio. ` +
      `Pode nos enviar por aqui? Obrigado!`
  );
  const insuranceWhatsappLink = tenantWhatsappNumber
    ? `https://wa.me/${tenantWhatsappNumber}?text=${insuranceWhatsappMessage}`
    : "";

  return (
    <div className="space-y-5">
      <StepCard
        icon={<Home className="h-5 w-5" />}
        title="Informações sobre a Locação"
        subtitle={
          isEditing
            ? "Revise e continue o rascunho deste processo de locacao."
            : "Preencha as primeiras informações para salvar a proposta como rascunho."
        }
        completed={dadosCompleted}
        open={openDados}
        onToggleOpen={() => setOpenDados(prev => !prev)}
        headerAccessory={
          isDirty ? (
            <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Alterações não salvas
            </span>
          ) : null
        }
      >
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Tempo de reajuste</Label>
              <Select
                value={adjustmentPeriod}
                onValueChange={value => { markDirty(); setAdjustmentPeriod(value as "anual" | "mensal"); }}
              >
                <SelectTrigger className={FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taxa de administração (%)</Label>
              <Input
                className={FIELD_CLASS}
                value={administrationFeePercent}
                onChange={event => { markDirty(); setAdministrationFeePercent(event.target.value); }}
                placeholder="Ex.: 10"
              />
            </div>
            <div className="space-y-2">
              <Label>Dias úteis para repasse</Label>
              <Input
                className={FIELD_CLASS}
                value={transferBusinessDays}
                onChange={event => { markDirty(); setTransferBusinessDays(event.target.value.replace(/[^\d]/g, "")); }}
                placeholder="Ex.: 5"
              />
            </div>
            <div className="space-y-2">
              <Label>Multa rescisória</Label>
              <div className="flex gap-2">
                <Select
                  value={terminationPenaltyType}
                  onValueChange={value => {
                    markDirty();
                    setTerminationPenaltyType(value as "valor" | "alugueis");
                    setTerminationPenaltyAmount("");
                  }}
                >
                  <SelectTrigger className={`${FIELD_CLASS} w-[140px] shrink-0`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valor">Valor (R$)</SelectItem>
                    <SelectItem value="alugueis">Nº de aluguéis</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className={FIELD_CLASS}
                  value={terminationPenaltyAmount}
                  onChange={event => { markDirty(); setTerminationPenaltyAmount(event.target.value); }}
                  placeholder={terminationPenaltyType === "alugueis" ? "Ex.: 3" : "R$ 0,00"}
                />
              </div>
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
      </StepCard>
      {initialProposal && modelosReached ? (
        <StepCard
          icon={<FileSignature className="h-5 w-5" />}
          title="Modelos e contratos"
          subtitle="Marque os modelos de locação desta proposta para gerar os contratos. Você pode gerar mais ou remover a qualquer momento."
          completed={contratosCompleted}
          open={openModelos}
          onToggleOpen={() => setOpenModelos(prev => !prev)}
        >
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Modelos de contrato
            </h3>
          {canEditTemplates ? (
            loadingContractTemplates ? (
              <div className="space-y-3">
                {[1, 2].map(item => (
                  <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : contractTemplates?.length ? (
              <div className="space-y-3">
                <p className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-2 text-xs font-medium text-sky-800">
                  Marque os modelos desta proposta. Ao aplicar: modelos novos geram contratos; modelos desmarcados removem os contratos correspondentes; os mantidos preservam edições e aprovação.
                </p>
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
                    type="button"
                    className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                    disabled={
                      updateContractTemplatesInReview.isPending ||
                      selectedContractTemplateIds.length === 0 ||
                      !templatesChanged
                    }
                    onClick={saveTemplatesInReview}
                  >
                    <WandSparkles className="h-4 w-4" />
                    {updateContractTemplatesInReview.isPending
                      ? "Aplicando..."
                      : generatedContracts.length
                        ? "Atualizar contratos"
                        : "Gerar contratos"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Nenhum modelo de contrato cadastrado. Cadastre os modelos na aba Contratos antes de continuar.
              </div>
            )
          ) : (
            <div className="space-y-2">
              {(initialProposal?.contractTemplates ?? []).length ? (
                (initialProposal?.contractTemplates ?? []).map(template => (
                  <div key={template.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <p className="font-semibold text-slate-950">{template.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {template.notes || "Sem observacoes internas."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">Nenhum modelo vinculado a esta proposta.</p>
              )}
            </div>
          )}
          </div>
          {contratosReached ? (
            <div className="mt-6 space-y-3 border-t border-slate-200 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Contratos gerados
              </h3>
          {generatedContracts.length ? (
            <div className="space-y-3">
              {generatedContracts.map(contract => {
                const unresolvedCount = parseUnresolvedVariables(contract.unresolvedVariables).length;
                const filledCount = Object.keys(parseVariableValues(contract.variableValues)).length;
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
                        {proposalReferenceCode ? (
                          <p className="mt-2 border-t border-dashed border-slate-200 pt-2 text-xs font-medium text-slate-500">
                            {buildContractReferenceFooter(proposalReferenceCode)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {filledCount} variável(is) preenchida(s)
                        </span>
                        {unresolvedCount > 0 ? (
                          <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            {unresolvedCount} variável(is) pendente(s)
                          </span>
                        ) : null}
                        {canManageContracts ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-full bg-white px-3 text-xs font-semibold"
                              disabled={regenerateGeneratedContract.isPending}
                              onClick={() => regenerateContract(contract)}
                              title="Gera o contrato novamente a partir do modelo atual do sistema"
                            >
                              <RotateCw className="mr-1 h-3.5 w-3.5" />
                              Gerar novamente
                            </Button>
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
                            {isApproved ? null : (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 rounded-full bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
                                disabled={approveGeneratedContract.isPending}
                                onClick={() => approveContract(contract)}
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Aprovar
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-full border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              disabled={deleteGeneratedContract.isPending}
                              onClick={() => deleteContract(contract)}
                              title="Exclui este contrato gerado da proposta"
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </>
                        ) : null}
                        {isApproved ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                            disabled={downloadingContractId === contract.id}
                            onClick={() => downloadContractDocx(contract)}
                            title="Baixa o contrato em Word (.docx) com o layout do modelo, o texto editado/validado e o código de referência no rodapé"
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            {downloadingContractId === contract.id
                              ? "Gerando..."
                              : "Baixar Word"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {allGeneratedContractsApproved ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  {proposalReferenceCode ? (
                    <>
                      Todos os contratos foram aprovados. Código de referência da proposta:{" "}
                      <span className="font-semibold">{proposalReferenceCode}</span>. A próxima etapa será a geração dos boletos.
                    </>
                  ) : (
                    "Todos os contratos foram aprovados. A próxima etapa será gerar o código de referência da proposta."
                  )}
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
        </StepCard>
      ) : null}
      {boletosReached ? (
        <StepCard
          icon={<Receipt className="h-5 w-5" />}
          title="Boletos"
          subtitle="Gere os boletos de todo o período de vigência. A validação, edição e acompanhamento ficam na aba Boletos."
          completed={boletos.length > 0}
          open={openBoletos}
          onToggleOpen={() => setOpenBoletos(prev => !prev)}
          headerAccessory={
            boletos.length ? (
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {boletos.length} gerado(s)
              </span>
            ) : null
          }
        >
          {boletos.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Será gerado um boleto por mês, do início ao fim da vigência. O
                valor inicial replica o aluguel{" "}
                {initialProposal?.condominiumAmount
                  ? "e o condomínio "
                  : ""}
                da proposta; reajustes (ex.: {initialProposal?.adjustmentIndex})
                podem ser aplicados depois em lote, na aba Boletos.
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Parcelas
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {initialProposal?.leaseTermMonths ?? 0} meses
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Valor por boleto
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {formatCentsBRL(
                      (initialProposal?.rentAmount ?? 0) +
                        (initialProposal?.condominiumAmount ?? 0)
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vencimento
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    Dia {initialProposal?.dueDay ?? "-"}
                  </p>
                </div>
              </div>
              {canGenerateBoletos ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                    disabled={generateBoletos.isPending || !initialProposal}
                    onClick={() =>
                      initialProposal &&
                      generateBoletos.mutate({ id: initialProposal.id })
                    }
                  >
                    <WandSparkles className="h-4 w-4" />
                    {generateBoletos.isPending ? "Gerando..." : "Gerar boletos"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Os boletos serão gerados após a aprovação dos contratos.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <span className="font-semibold">{boletos.length}</span> boleto(s)
                gerado(s) para todo o período de vigência, totalizando{" "}
                <span className="font-semibold">
                  {formatCentsBRL(boletosTotalAmount)}
                </span>
                . O processo avançou para a etapa de seguros. A validação, edição
                em lote/individual e o acompanhamento de status (em aberto,
                atrasado, vencido, pago) são feitos na aba Boletos.
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-full bg-white"
                  onClick={() =>
                    setLocation("/admin/modulos/locacoes?tab=Boletos")
                  }
                >
                  <Receipt className="h-4 w-4" />
                  Abrir aba Boletos
                </Button>
              </div>
            </div>
          )}
        </StepCard>
      ) : null}
      {segurosReached && initialProposal ? (
        <StepCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Seguros"
          subtitle="Receba e confirme os comprovantes das primeiras parcelas do seguro fiança e do seguro incêndio (ou dispense quando não se aplicar)."
          completed={segurosCompleted}
          open={openSeguros}
          onToggleOpen={() => setOpenSeguros(prev => !prev)}
          headerAccessory={
            segurosCompleted ? (
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Concluído
              </span>
            ) : (
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Aguardando comprovantes
              </span>
            )
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Ao entrar nesta etapa, o sistema enviou um e-mail ao locatário
              solicitando os comprovantes. Você pode reenviar o e-mail ou mandar
              uma mensagem pronta pelo WhatsApp.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2 rounded-full bg-white"
                disabled={resendInsuranceRequest.isPending}
                onClick={() =>
                  resendInsuranceRequest.mutate({ id: initialProposal.id })
                }
              >
                <Send className="h-4 w-4" />
                {resendInsuranceRequest.isPending
                  ? "Reenviando..."
                  : "Reenviar e-mail"}
              </Button>
              {insuranceWhatsappLink ? (
                <a
                  href={insuranceWhatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar WhatsApp
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  <MessageCircle className="h-4 w-4" />
                  Locatário sem telefone cadastrado
                </span>
              )}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <RentalInsuranceBlock
                proposalId={initialProposal.id}
                kind="fianca"
                record={fiancaInsurance}
                onChanged={invalidateProposal}
              />
              <RentalInsuranceBlock
                proposalId={initialProposal.id}
                kind="incendio"
                record={incendioInsurance}
                onChanged={invalidateProposal}
              />
            </div>
            {segurosCompleted ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Seguros confirmados. A proposta avançou para a etapa de
                assinaturas.
              </div>
            ) : null}
          </div>
        </StepCard>
      ) : null}
      {assinaturasReached && initialProposal ? (
        <StepCard
          icon={<FileSignature className="h-5 w-5" />}
          title="Assinaturas digitais"
          subtitle="Envie os contratos aprovados para assinatura eletrônica (D4Sign) do locatário e do proprietário. Ao assinarem, o PDF assinado fica disponível e a proposta avança."
          completed={assinaturasCompleted}
          open={openAssinaturas}
          onToggleOpen={() => setOpenAssinaturas(prev => !prev)}
          headerAccessory={
            assinaturasCompleted ? (
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Concluído
              </span>
            ) : (
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Aguardando assinaturas
              </span>
            )
          }
        >
          <div className="space-y-4">
            {!signaturesConfigured ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Integração D4Sign ainda não configurada no servidor. Defina{" "}
                <code>D4SIGN_TOKEN_API</code>, <code>D4SIGN_CRYPT_KEY</code> e{" "}
                <code>D4SIGN_SAFE_UUID</code> no arquivo <code>.env</code> para
                habilitar o envio.
              </div>
            ) : (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Para cada contrato aprovado, clique em “Enviar para assinatura”.
                Os signatários recebem o e-mail da D4Sign; use “Atualizar status”
                para checar a conclusão (ou aguarde o webhook).
              </div>
            )}

            {approvedContracts.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum contrato aprovado para assinar.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {approvedContracts.map(contract => (
                  <RentalSignatureBlock
                    key={contract.id}
                    proposalId={initialProposal.id}
                    contract={contract}
                    configured={signaturesConfigured}
                    record={
                      signatureRecords.find(
                        item => item.generatedContractId === contract.id
                      ) ?? null
                    }
                    onChanged={invalidateSignatures}
                  />
                ))}
              </div>
            )}

            {assinaturasCompleted ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Todos os contratos foram assinados. A proposta avançou para a
                etapa de transferências de titularidade.
              </div>
            ) : null}
          </div>
        </StepCard>
      ) : null}
      {transferenciasReached && initialProposal ? (
        <StepCard
          icon={<FileText className="h-5 w-5" />}
          title={"Transferência de titularidade"}
          subtitle={
            "Confirme a transferência das contas de consumo (energia, água e gás) para o nome do locatário, ou dispense a que não se aplicar."
          }
          completed={transferenciasCompleted}
          open={openTransferencias}
          onToggleOpen={() => setOpenTransferencias(prev => !prev)}
          headerAccessory={
            transferenciasCompleted ? (
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {"Concluído"}
              </span>
            ) : (
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {"Aguardando transferências"}
              </span>
            )
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              {"O locatário deve transferir a titularidade das contas e enviar os comprovantes. Confirme cada conta ao receber, ou dispense quando não se aplicar (ex.: imóvel sem gás encanado)."}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {orderedUtilityTransfers.map(transfer => (
                <RentalUtilityTransferBlock
                  key={transfer.id}
                  proposalId={initialProposal.id}
                  kind={transfer.kind}
                  record={transfer}
                  onChanged={invalidateUtilityTransfers}
                />
              ))}
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-3">
              <Label className="text-xs">
                {"Adicionar outra conta (ex.: Internet, IPTU, Condomínio)"}
              </Label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Input
                  className={`${FIELD_CLASS} flex-1`}
                  value={newUtilityLabel}
                  onChange={event => setNewUtilityLabel(event.target.value)}
                  placeholder="Nome da conta"
                  onKeyDown={event => {
                    if (event.key === "Enter" && newUtilityLabel.trim()) {
                      event.preventDefault();
                      addUtilityTransfer.mutate({
                        id: initialProposal.id,
                        label: newUtilityLabel.trim(),
                      });
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-full bg-white"
                  disabled={
                    addUtilityTransfer.isPending || !newUtilityLabel.trim()
                  }
                  onClick={() =>
                    addUtilityTransfer.mutate({
                      id: initialProposal.id,
                      label: newUtilityLabel.trim(),
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  {addUtilityTransfer.isPending ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </div>
            {transferenciasCompleted ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {"Transferências concluídas. A proposta avançou para a etapa de vistoria."}
              </div>
            ) : null}
          </div>
        </StepCard>
      ) : null}
      {vistoriaReached && initialProposal ? (
        <StepCard
          icon={<FileText className="h-5 w-5" />}
          title={"Vistoria e laudo"}
          subtitle={
            "Solicite a vistoria ao vistoriador (WhatsApp), anexe o laudo recebido e confirme a validação do estado do imóvel pelo locatário e pelo proprietário."
          }
          completed={vistoriaCompleted}
          open={openVistoria}
          onToggleOpen={() => setOpenVistoria(prev => !prev)}
          headerAccessory={
            vistoriaCompleted ? (
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {"Concluído"}
              </span>
            ) : (
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {"Aguardando vistoria"}
              </span>
            )
          }
        >
          <div className="space-y-4">
            <RentalInspectionPanel
              proposalId={initialProposal.id}
              record={inspection}
              referenceCode={initialProposal.referenceCode ?? null}
              propertyAddress={buildPropertyAddress(initialProposal.property)}
              onChanged={invalidateInspection}
            />
            {vistoriaCompleted ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {"Vistoria concluída. A proposta avançou para a entrega de chaves."}
              </div>
            ) : null}
          </div>
        </StepCard>
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
          className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-0 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-4xl"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b border-slate-200/80 px-4 py-4 pr-12 text-left sm:px-6 sm:pr-14">
            <DialogTitle className="truncate">{editingGeneratedContract?.title || "Revisar contrato"}</DialogTitle>
            <DialogDescription>
              Edite o texto gerado antes de aprovar este contrato. Os trechos{" "}
              <mark className="rounded bg-yellow-200 px-1 text-slate-900">em amarelo</mark>{" "}
              vieram de variáveis do modelo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="relative rounded-2xl bg-white shadow-sm">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-2xl border border-transparent px-3 py-2 font-mono text-sm leading-6 text-transparent"
              >
                {contractHighlightSegments.map((segment, index) =>
                  segment.highlight ? (
                    <mark key={index} className="rounded bg-yellow-200 text-transparent">
                      {segment.text}
                    </mark>
                  ) : (
                    <span key={index}>{segment.text}</span>
                  )
                )}
                {"\n"}
              </div>
              <Textarea
                value={contractReviewText}
                onChange={event => {
                  setContractReviewText(event.target.value);
                  setContractReviewDirty(true);
                }}
                className="relative min-h-[48vh] w-full resize-none rounded-2xl border-slate-200 bg-transparent font-mono text-sm leading-6 shadow-none"
              />
            </div>
            {proposalReferenceCode ? (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-2 text-xs font-medium text-slate-500">
                Rodapé do contrato: {buildContractReferenceFooter(proposalReferenceCode)}
              </div>
            ) : null}
          </div>
          <DialogFooter className="shrink-0 border-t border-slate-200/80 px-4 py-4 sm:px-6">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={contractToRegenerate !== null}
        onOpenChange={open => {
          if (open || regenerateGeneratedContract.isPending) return;
          setContractToRegenerate(null);
        }}
      >
        <DialogContent className="!w-[420px] !max-w-[calc(100%-2rem)] rounded-[24px] border-white/80 bg-[#f7f6f2] p-4 sm:!max-w-[420px] sm:p-5">
          <DialogHeader>
            <DialogTitle>Gerar contrato novamente?</DialogTitle>
            <DialogDescription>
              O contrato será gerado de novo a partir do modelo atual do sistema. As edições manuais no texto e a aprovação deste contrato serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full bg-white"
              disabled={regenerateGeneratedContract.isPending}
              onClick={() => setContractToRegenerate(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800"
              disabled={regenerateGeneratedContract.isPending}
              onClick={confirmRegenerateContract}
            >
              <RotateCw className="h-4 w-4" />
              {regenerateGeneratedContract.isPending ? "Gerando..." : "Gerar novamente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={contractToDelete !== null}
        onOpenChange={open => {
          if (open || deleteGeneratedContract.isPending) return;
          setContractToDelete(null);
        }}
      >
        <DialogContent className="!w-[440px] !max-w-[calc(100%-2rem)] rounded-[24px] border-white/80 bg-[#f7f6f2] p-4 sm:!max-w-[440px] sm:p-5">
          <DialogHeader>
            <DialogTitle>Excluir contrato gerado?</DialogTitle>
            <DialogDescription>
              O contrato{contractToDelete ? ` "${contractToDelete.title}"` : ""} será removido desta proposta, junto com o modelo correspondente. Edições e aprovação deste contrato serão perdidas. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full bg-white"
              disabled={deleteGeneratedContract.isPending}
              onClick={() => setContractToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-full bg-rose-700 text-white hover:bg-rose-800"
              disabled={deleteGeneratedContract.isPending}
              onClick={confirmDeleteContract}
            >
              <Trash2 className="h-4 w-4" />
              {deleteGeneratedContract.isPending ? "Excluindo..." : "Excluir contrato"}
            </Button>
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
