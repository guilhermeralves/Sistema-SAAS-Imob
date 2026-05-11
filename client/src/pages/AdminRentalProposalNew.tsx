import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import RentalProposalForm from "./admin/RentalProposalForm";
import { ArrowLeft, Shield, User } from "lucide-react";

const ADMIN_BACKGROUND_CLASS =
  "bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]";

function AdminRentalProposalNewLoading() {
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

function AdminRentalProposalNewUnauthenticated() {
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

function AdminRentalProposalNewForbidden() {
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

export default function AdminRentalProposalNew() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return <AdminRentalProposalNewLoading />;
  if (!isAuthenticated) return <AdminRentalProposalNewUnauthenticated />;
  if (user?.role !== "administrativo") return <AdminRentalProposalNewForbidden />;

  return (
    <Layout>
      <div className={ADMIN_BACKGROUND_CLASS}>
        <div className="container py-4 md:py-5">
          <div className="mb-4">
            <Button asChild variant="outline" className="mb-3 gap-2 rounded-full bg-white/90 shadow-sm hover:bg-white">
              <Link href="/admin/modulos/locacoes">
                <a className="inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </a>
              </Link>
            </Button>
            <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Nova Locação</h1>
            </div>
            <p className="max-w-3xl text-slate-600">
              Crie e salve o rascunho inicial do processo de locação.
            </p>
          </div>

          <RentalProposalForm />
        </div>
      </div>
    </Layout>
  );
}
