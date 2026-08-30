import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import MobileKeyboardDismiss from "@/components/MobileKeyboardDismiss";
import ProtectedRoute from "@/components/ProtectedRoute";
import ActivationGate from "@/components/ActivationGate";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuth } from "./_core/hooks/useAuth";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Imoveis from "./pages/Imoveis";
import Lancamentos from "./pages/Lancamentos";
import ImovelNovoPreview from "./pages/ImovelNovoPreview";
import Servicos from "./pages/Servicos";
import Contato from "./pages/Contato";
import ImovelDetalhes from "./pages/ImovelDetalhes";
import AreaCliente from "./pages/AreaCliente";
import ValidarVistoria from "./pages/ValidarVistoria";
import CRM from "./pages/CRM";
import MeusImoveis from "./pages/MeusImoveis";
import Admin, { AdminModule } from "./pages/Admin";
import AdminRentalProposalDetails from "./pages/AdminRentalProposalDetails";
import AdminRentalProposalNew from "./pages/AdminRentalProposalNew";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetails from "./pages/AdminUserDetails";
import Financeiro from "./pages/Financeiro";
import Dashboard from "./pages/Dashboard";
import Integracoes from "./pages/Integracoes";
import ControleDeChaves from "./pages/ControleDeChaves";
import Automacao from "./pages/Automacao";
import Bonificacoes from "./pages/Bonificacoes";
import EvolucaoProfissional from "./pages/EvolucaoProfissional";
import TarefasEventos from "./pages/TarefasEventos";
import Condominios from "./pages/Condominios";
import RoletaAtendimentos from "./pages/RoletaAtendimentos";
import Ativar from "./pages/Ativar";

function RootEntryRoute() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) return;
    if (user.role === "administrativo" || user.role === "corretor") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation, user]);

  if (loading) return null;
  if (
    isAuthenticated &&
    user &&
    (user.role === "administrativo" || user.role === "corretor")
  ) {
    return null;
  }
  return <Home />;
}

function LegacyIntegracoesRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/integracoes");
  }, [setLocation]);
  return null;
}

function LegacyTrilhasDesenvolvimentoRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/evolucao-profissional");
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={RootEntryRoute} />
      <Route path={"/imoveis"} component={Imoveis} />
      <Route path={"/lancamentos"}>
        <ProtectedRoute component={Lancamentos} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/imoveis/novo/preview"}>
        <ProtectedRoute component={ImovelNovoPreview} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/imoveis/:id"} component={ImovelDetalhes} />
      <Route path={"/servicos"} component={Servicos} />
      <Route path={"/contato"} component={Contato} />
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      <Route path={"/ativar"} component={Ativar} />
      <Route path={"/area-cliente"}>
        <ProtectedRoute component={AreaCliente} roles={["cliente"]} />
      </Route>
      <Route path={"/validar-vistoria/:token"}>
        <ProtectedRoute component={ValidarVistoria} roles={["cliente"]} />
      </Route>
      <Route path={"/minha-ficha"}>
        <ProtectedRoute component={AdminUserDetails} roles={["cliente", "corretor", "administrativo"]} />
      </Route>
      <Route path={"/dashboard"}>
        <ProtectedRoute component={Dashboard} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/crm"}>
        <ProtectedRoute component={CRM} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/meus-imoveis"}>
        <ProtectedRoute component={MeusImoveis} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/admin/users"}>
        <ProtectedRoute component={AdminUsers} roles={["administrativo"]} />
      </Route>
      <Route path={"/admin/users/:id"}>
        <ProtectedRoute component={AdminUserDetails} roles={["administrativo"]} />
      </Route>
      <Route path={"/admin/proprietarios/:id"}>
        <ProtectedRoute component={AdminUserDetails} roles={["administrativo"]} />
      </Route>
      <Route path={"/admin/modulos/locacoes/nova"}>
        <ProtectedRoute component={AdminRentalProposalNew} roles={["administrativo"]} />
      </Route>
      <Route path={"/admin/modulos/locacoes/propostas/:id"}>
        <ProtectedRoute component={AdminRentalProposalDetails} roles={["administrativo"]} />
      </Route>
      <Route path={"/admin/modulos/:module"}>
        <ProtectedRoute component={AdminModule} roles={["administrativo"]} />
      </Route>
      <Route path={"/admin"}>
        <ProtectedRoute component={Admin} roles={["administrativo"]} />
      </Route>
      <Route path={"/financeiro"}>
        <ProtectedRoute component={Financeiro} roles={["administrativo"]} />
      </Route>
      <Route path={"/integracoes"}>
        <ProtectedRoute component={Integracoes} roles={["administrativo"]} />
      </Route>
      <Route path={"/plataformas-integradas"} component={LegacyIntegracoesRoute} />
      <Route path={"/controle-de-chaves"}>
        <ProtectedRoute component={ControleDeChaves} roles={["administrativo"]} />
      </Route>
      <Route path={"/bonificacoes"}>
        <ProtectedRoute component={Bonificacoes} roles={["administrativo"]} />
      </Route>
      <Route path={"/evolucao-profissional"}>
        <ProtectedRoute component={EvolucaoProfissional} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/trilhas-desenvolvimento"} component={LegacyTrilhasDesenvolvimentoRoute} />
      <Route path={"/automacao"}>
        <ProtectedRoute component={Automacao} roles={["administrativo"]} />
      </Route>
      <Route path={"/tarefas-eventos"}>
        <ProtectedRoute component={TarefasEventos} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/condominios"}>
        <ProtectedRoute component={Condominios} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/roleta-atendimentos"}>
        <ProtectedRoute component={RoletaAtendimentos} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ScrollToTopOnRouteChange() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <ScrollToTopOnRouteChange />
          <ActivationGate />
          <MobileKeyboardDismiss />
          <Toaster
            richColors
            toastOptions={{
              classNames: {
                toast: "border",
                error: "border border-red-500",
                success: "border border-green-500",
                warning: "border border-yellow-500",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
