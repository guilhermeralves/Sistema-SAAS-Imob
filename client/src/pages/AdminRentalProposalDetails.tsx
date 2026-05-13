import { useLocation, useRoute } from "wouter";
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
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { formatStoredDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";
import { useUnsavedChangesNavigationGuard } from "@/hooks/useUnsavedChangesNavigationGuard";
import RentalProposalForm from "./admin/RentalProposalForm";
import { ArrowLeft, Shield, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ADMIN_BACKGROUND_CLASS =
  "bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]";

function getProposalStatusLabel(status: string, currentStep: string) {
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
    modelos_contrato: "Modelos de contrato",
  };

  return status === "rascunho" ? labels.rascunho : labels[currentStep] ?? labels[status] ?? status;
}

function AdminRentalProposalDetailsLoading() {
  return (
    <Layout>
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    </Layout>
  );
}

function AdminRentalProposalDetailsUnauthenticated() {
  return (
    <Layout>
      <div className="container py-16 text-center">
        <User className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">Acesso Restrito</h1>
        <p className="mb-6 text-muted-foreground">
          Você precisa estar autenticado para acessar o painel administrativo.
        </p>
        <Button asChild>
          <a href={getLoginUrl()}>Fazer Login</a>
        </Button>
      </div>
    </Layout>
  );
}

function AdminRentalProposalDetailsForbidden() {
  return (
    <Layout>
      <div className="container py-16 text-center">
        <Shield className="mx-auto mb-4 h-16 w-16 text-destructive" />
        <h1 className="mb-2 text-2xl font-bold">Acesso Negado</h1>
        <p className="mb-6 text-muted-foreground">Esta área é exclusiva para administradores.</p>
        <Button asChild>
          <a href="/">Voltar para Home</a>
        </Button>
      </div>
    </Layout>
  );
}

export default function AdminRentalProposalDetails() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/modulos/locacoes/propostas/:id");
  const proposalId = Number(params?.id);
  const hasValidProposalId = Number.isInteger(proposalId) && proposalId > 0;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const { requestNavigation, UnsavedChangesDialog } = useUnsavedChangesNavigationGuard({
    isDirty: formDirty,
    shouldAllowPath: path =>
      path.includes(`fromRentalProposal=${proposalId}`) ||
      path.startsWith("/imoveis?selecionarLocacao=1") ||
      path.startsWith(`/admin/modulos/locacoes/propostas/${proposalId}`),
  });

  const {
    data: proposal,
    isLoading: loadingProposal,
    error,
  } = trpc.rentalProposals.getById.useQuery(
    { id: proposalId },
    { enabled: isAuthenticated && user?.role === "administrativo" && hasValidProposalId }
  );
  const utils = trpc.useUtils();
  const deleteProposal = trpc.rentalProposals.delete.useMutation({
    onSuccess: async () => {
      toast.success("Proposta de locação excluída com sucesso.");
      await utils.rentalProposals.list.invalidate();
      setLocation("/admin/modulos/locacoes?tab=propostas");
    },
    onError: error => {
      toast.error(error.message || "Não foi possível excluir a proposta de locação.");
    },
  });

  if (loading) return <AdminRentalProposalDetailsLoading />;
  if (!isAuthenticated) return <AdminRentalProposalDetailsUnauthenticated />;
  if (user?.role !== "administrativo") return <AdminRentalProposalDetailsForbidden />;

  return (
    <Layout>
      <div className={ADMIN_BACKGROUND_CLASS}>
        <div className="container py-4 md:py-5">
          <div className="mb-4">
            <Button asChild variant="outline" className="mb-3 gap-2 rounded-full bg-white/90 shadow-sm hover:bg-white">
              <button
                type="button"
                className="inline-flex items-center gap-2"
                onClick={() => {
                  requestNavigation("/admin/modulos/locacoes?tab=propostas");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
            </Button>
            <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Detalhes da Proposta
              </h1>
            </div>
            {proposal ? (
              <div className="flex max-w-3xl flex-wrap items-center gap-2 text-slate-600">
                <span>Rascunho criado em {formatStoredDate(proposal.createdAt)}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {getProposalStatusLabel(proposal.status, proposal.currentStep)}
                </span>
              </div>
            ) : (
              <p className="max-w-3xl text-slate-600">
                Carregando as informações salvas deste processo de locação.
              </p>
            )}
          </div>

          {!hasValidProposalId ? (
            <div className="rounded-2xl border border-red-100 bg-white/85 px-4 py-5 text-sm text-red-700">
              Proposta de locacao invalida.
            </div>
          ) : loadingProposal ? (
            <div className="h-64 animate-pulse rounded-[32px] bg-white/70" />
          ) : error || !proposal ? (
            <div className="rounded-2xl border border-red-100 bg-white/85 px-4 py-5 text-sm text-red-700">
              Nao foi possivel carregar esta proposta de locacao.
            </div>
          ) : (
            <RentalProposalForm
              initialProposal={proposal}
              onDeleteProposal={() => setDeleteDialogOpen(true)}
              onDirtyChange={setFormDirty}
            />
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[28px] border-white/80 bg-[#f7f6f2]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta de locação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta proposta será removida da lista de rascunhos e propostas pendentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full bg-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-rose-700 text-white hover:bg-rose-800"
              disabled={deleteProposal.isPending}
              onClick={event => {
                event.preventDefault();
                if (!hasValidProposalId) return;
                deleteProposal.mutate({ id: proposalId });
              }}
            >
              {deleteProposal.isPending ? "Excluindo..." : "Excluir proposta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {UnsavedChangesDialog}
    </Layout>
  );
}
