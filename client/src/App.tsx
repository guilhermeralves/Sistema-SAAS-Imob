import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import MobileKeyboardDismiss from "@/components/MobileKeyboardDismiss";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuth } from "./_core/hooks/useAuth";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Imoveis from "./pages/Imoveis";
import ImovelNovoPreview from "./pages/ImovelNovoPreview";
import Servicos from "./pages/Servicos";
import Contato from "./pages/Contato";
import ImovelDetalhes from "./pages/ImovelDetalhes";
import AreaCliente from "./pages/AreaCliente";
import CRM from "./pages/CRM";
import MeusImoveis from "./pages/MeusImoveis";
import Admin from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetails from "./pages/AdminUserDetails";
import AdminPropertyDetails from "./pages/AdminPropertyDetails";
import Financeiro from "./pages/Financeiro";
import Dashboard from "./pages/Dashboard";
import PlataformasIntegradas from "./pages/PlataformasIntegradas";
import ControleDeChaves from "./pages/ControleDeChaves";
import Automacao from "./pages/Automacao";
import TarefasEventos from "./pages/TarefasEventos";
import Condominios from "./pages/Condominios";

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

  if (loading) {
    return null;
  }

  if (isAuthenticated && user && (user.role === "administrativo" || user.role === "corretor")) {
    return null;
  }

  return <Home />;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={RootEntryRoute} />
      <Route path={"/imoveis"} component={Imoveis} />
      <Route path={"/imoveis/novo/preview"}>
        <ProtectedRoute component={ImovelNovoPreview} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/imoveis/:id"} component={ImovelDetalhes} />
      <Route path={"/servicos"} component={Servicos} />
      <Route path={"/contato"} component={Contato} />
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      <Route path={"/area-cliente"}>
        <ProtectedRoute component={AreaCliente} roles={["cliente"]} />
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
      <Route path={"/admin/imoveis/:id"}>
        <ProtectedRoute component={AdminPropertyDetails} roles={["administrativo"]} />
      </Route>
      <Route path={"/admin"}>
        <ProtectedRoute component={Admin} roles={["administrativo"]} />
      </Route>
      <Route path={"/financeiro"}>
        <ProtectedRoute component={Financeiro} roles={["administrativo"]} />
      </Route>
      <Route path={"/plataformas-integradas"}>
        <ProtectedRoute component={PlataformasIntegradas} roles={["administrativo"]} />
      </Route>
      <Route path={"/controle-de-chaves"}>
        <ProtectedRoute component={ControleDeChaves} roles={["administrativo"]} />
      </Route>
      <Route path={"/automacao"}>
        <ProtectedRoute component={Automacao} roles={["administrativo"]} />
      </Route>
      <Route path={"/tarefas-eventos"}>
        <ProtectedRoute component={TarefasEventos} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/condominios"}>
        <ProtectedRoute component={Condominios} roles={["corretor", "administrativo"]} />
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
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

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <ScrollToTopOnRouteChange />
          <MobileKeyboardDismiss />
          <Toaster
            richColors
            toastOptions={{
              classNames: {
                toast: "border",
                error: "border border-red-500",
                success: "border border-green-500",
                warning: "border border-yellow-500"
              }
            }}
          />

          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
