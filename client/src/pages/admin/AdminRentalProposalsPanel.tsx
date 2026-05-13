import { useEffect, useMemo, useRef, useState } from "react";
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
import { formatStoredDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";
import {
  Check,
  Banknote,
  FileCheck2,
  FileSignature,
  Home,
  KeyRound,
  MailCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import { getRentalProposalDetailsPath } from "./rentalProposalReference";
import { toast } from "sonner";

type RentalProposalListItem = {
  id: number;
  status: string;
  currentStep: string;
  propertyId: number;
  brokerUserId: number;
  tenantUserId: number;
  createdAt: Date | string;
  property?: { titulo?: string | null } | null;
  broker?: { name?: string | null; email?: string | null } | null;
  tenant?: { name?: string | null; email?: string | null } | null;
};

type RentalProcessStep = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const RENTAL_PROCESS_STEPS: RentalProcessStep[] = [
  {
    key: "imovel",
    title: "Escolha do imóvel",
    description: "Imóvel de locação selecionado para iniciar a proposta.",
    icon: Home,
  },
  {
    key: "modelos_contrato",
    title: "Modelos de contrato",
    description: "Modelos selecionados para cruzamento das variáveis.",
    icon: FileSignature,
  },
  {
    key: "contratos",
    title: "Validação dos contratos",
    description: "Substituições revisadas e contratos aprovados para geração.",
    icon: FileCheck2,
  },
  {
    key: "boletos",
    title: "Boletos",
    description: "Solicitação dos boletos de todo o período da locação.",
    icon: Banknote,
  },
  {
    key: "seguros_assinaturas",
    title: "Seguros e assinaturas",
    description: "Comprovantes, seguro fiança/incêndio e assinaturas digitais.",
    icon: ShieldCheck,
  },
  {
    key: "vistoria_chaves",
    title: "Vistoria e chaves",
    description: "Transferências, vistoria, entrega das chaves e boas-vindas.",
    icon: KeyRound,
  },
  {
    key: "boas_vindas",
    title: "Boas-vindas",
    description: "Contrato ativo e mensagem final com próximos passos.",
    icon: MailCheck,
  },
];

function getProposalStepIndex(proposal: RentalProposalListItem | null) {
  if (!proposal) return -1;

  if (proposal.status === "ativo") return RENTAL_PROCESS_STEPS.length - 1;
  if (proposal.status === "entrega_chaves_pendente" || proposal.currentStep === "entrega_chaves_pendente") return 5;
  if (proposal.status === "vistoria_pendente" || proposal.currentStep === "vistoria_pendente") return 5;
  if (proposal.status === "transferencias_pendentes" || proposal.currentStep === "transferencias_pendentes") return 4;
  if (proposal.status === "assinaturas_pendentes" || proposal.currentStep === "assinaturas_pendentes") return 4;
  if (proposal.status === "seguros_pendentes" || proposal.currentStep === "seguros_pendentes") return 4;
  if (proposal.status === "boletos_pendentes" || proposal.currentStep === "boletos_pendentes") return 3;
  if (proposal.status === "contratos_em_revisao" || proposal.currentStep === "contratos_em_revisao") return 2;
  if (proposal.currentStep === "modelos_contrato") return 1;

  return 0;
}

function getStatusLabel(value: string) {
  const labels: Record<string, string> = {
    rascunho: "Rascunho",
    contratos_em_revisao: "Contratos em revisão",
    boletos_pendentes: "Boletos pendentes",
    seguros_pendentes: "Seguros pendentes",
    assinaturas_pendentes: "Assinaturas pendentes",
    transferencias_pendentes: "Transferências pendentes",
    vistoria_pendente: "Vistoria pendente",
    entrega_chaves_pendente: "Entrega de chaves",
    ativo: "Ativo",
    cancelado: "Cancelado",
  };

  return labels[value] ?? value;
}

export default function AdminRentalProposalsPanel() {
  const utils = trpc.useUtils();
  const proposalsWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [proposalPendingDelete, setProposalPendingDelete] = useState<RentalProposalListItem | null>(null);
  const { data: proposals, isLoading: loadingProposals } = trpc.rentalProposals.list.useQuery();

  const selectedProposal = useMemo(
    () => (proposals ?? []).find(proposal => proposal.id === selectedProposalId) ?? null,
    [proposals, selectedProposalId]
  );

  const currentStepIndex = getProposalStepIndex(selectedProposal);

  const deleteProposal = trpc.rentalProposals.delete.useMutation({
    onSuccess: async () => {
      toast.success("Proposta de locação excluída com sucesso.");
      if (proposalPendingDelete?.id === selectedProposalId) {
        setSelectedProposalId(null);
      }
      setProposalPendingDelete(null);
      await utils.rentalProposals.list.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Não foi possível excluir a proposta de locação.");
    },
  });

  useEffect(() => {
    if (!proposals?.length) {
      setSelectedProposalId(null);
      return;
    }

    if (selectedProposalId && proposals.some(proposal => proposal.id === selectedProposalId)) {
      return;
    }

    setSelectedProposalId(null);
  }, [proposals, selectedProposalId]);

  const selectRentalProposal = (proposalId: number) => {
    setSelectedProposalId(proposalId);

    requestAnimationFrame(() => {
      const workspace = proposalsWorkspaceRef.current;
      if (!workspace) return;

      const headerOffset = 178;
      const startTop = window.scrollY;
      const targetTop = Math.max(workspace.getBoundingClientRect().top + window.scrollY - headerOffset, 0);
      const distance = targetTop - startTop;
      const duration = 720;
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
    });
  };

  if (loadingProposals) {
    return (
      <div ref={proposalsWorkspaceRef} className="grid scroll-mt-32 gap-4 xl:grid-cols-[minmax(520px,1.35fr)_minmax(360px,0.85fr)]">
        <div className="space-y-3">
          {[1, 2].map(item => (
            <div key={item} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (!proposals?.length) {
    return (
      <div ref={proposalsWorkspaceRef} className="grid scroll-mt-32 gap-4 xl:grid-cols-[minmax(520px,1.35fr)_minmax(360px,0.85fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-600">
          Nenhuma proposta de locação criada ainda. Use o botão Nova Locação para iniciar o primeiro rascunho.
        </div>
        <RentalProposalProcessPanel selectedProposal={null} currentStepIndex={-1} />
      </div>
    );
  }

  return (
    <>
      <div ref={proposalsWorkspaceRef} className="grid scroll-mt-32 gap-4 xl:grid-cols-[minmax(520px,1.35fr)_minmax(360px,0.85fr)]">
        <div className="space-y-3">
          {proposals.map(proposal => {
            const isSelected = proposal.id === selectedProposalId;
            const shouldShowReference = proposal.status !== "rascunho" && proposal.currentStep !== "modelos_contrato";

            return (
              <div
                key={proposal.id}
                role="button"
                tabIndex={0}
                className={`block w-full cursor-pointer rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md ${
                  isSelected
                    ? "border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-100"
                    : "border-slate-200 bg-white/85"
                }`}
                onClick={() => selectRentalProposal(proposal.id)}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectRentalProposal(proposal.id);
                  }
                }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">
                        {proposal.property?.titulo || `Imóvel ID ${proposal.propertyId}`}
                      </p>
                      {isSelected ? (
                        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                          Selecionada
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
                      Cód. Referência{" "}
                      <span className="text-slate-700">
                        {shouldShowReference ? "Gerado no contrato" : "Pendente até gerar contrato"}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Locatário: {proposal.tenant?.name || proposal.tenant?.email || `ID ${proposal.tenantUserId}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Corretor: {proposal.broker?.name || proposal.broker?.email || `ID ${proposal.brokerUserId}`}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Criada em {formatStoredDate(proposal.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {getStatusLabel(proposal.status)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full bg-white px-4 text-xs font-semibold"
                      onClick={event => {
                        event.stopPropagation();
                      }}
                      asChild
                    >
                      <Link href={getRentalProposalDetailsPath(proposal.id)}>
                        <a>Detalhes</a>
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={event => {
                        event.stopPropagation();
                        setProposalPendingDelete(proposal);
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <RentalProposalProcessPanel selectedProposal={selectedProposal} currentStepIndex={currentStepIndex} />
      </div>

      <AlertDialog
        open={proposalPendingDelete !== null}
        onOpenChange={open => {
          if (!open) setProposalPendingDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-[28px] border-white/80 bg-[#f7f6f2]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta de locação?</AlertDialogTitle>
            <AlertDialogDescription>
              {proposalPendingDelete
                ? `A proposta de "${proposalPendingDelete.property?.titulo || `imóvel ID ${proposalPendingDelete.propertyId}`}" será removida.`
                : "Confirme a exclusão da proposta de locação."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full bg-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-rose-700 text-white hover:bg-rose-800"
              disabled={deleteProposal.isPending}
              onClick={event => {
                event.preventDefault();
                if (!proposalPendingDelete) return;
                deleteProposal.mutate({ id: proposalPendingDelete.id });
              }}
            >
              {deleteProposal.isPending ? "Excluindo..." : "Excluir proposta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RentalProposalProcessPanel({
  selectedProposal,
  currentStepIndex,
}: {
  selectedProposal: RentalProposalListItem | null;
  currentStepIndex: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm">
      <div className="mb-4">
        <p className="font-semibold text-slate-950">Etapas da proposta de locação</p>
        <p className="mt-1 text-sm text-slate-600">
          {selectedProposal
            ? `Acompanhamento de ${selectedProposal.property?.titulo || `imóvel ID ${selectedProposal.propertyId}`}.`
            : "Selecione uma proposta ao lado para acompanhar o avanço do processo."}
        </p>
      </div>

      <div className="space-y-3">
        {RENTAL_PROCESS_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isDone = currentStepIndex >= 0 && index < currentStepIndex;
          const isCurrent = currentStepIndex >= 0 && index === currentStepIndex;
          const iconClass = isDone
            ? "bg-emerald-700 text-white"
            : isCurrent
              ? "bg-amber-500 text-white"
              : "bg-slate-100 text-slate-400";
          const borderClass = isDone
            ? "border-emerald-100 bg-emerald-50/70"
            : isCurrent
              ? "border-amber-200 bg-amber-50/80"
              : "border-slate-100 bg-white/70";
          const titleClass = isDone
            ? "text-emerald-900"
            : isCurrent
              ? "text-amber-900"
              : "text-slate-500";

          return (
            <div key={step.key} className={`rounded-2xl border p-3 ${borderClass}`}>
              <div className="flex gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${titleClass}`}>{step.title}</p>
                    {isCurrent ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Etapa atual
                      </span>
                    ) : null}
                    {isDone ? (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-white"
                        aria-label="Etapa concluída"
                        title="Etapa concluída"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedProposal ? (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          O código de referência será gerado após a validação dos modelos e confirmação da geração dos contratos.
        </div>
      ) : null}
    </div>
  );
}
