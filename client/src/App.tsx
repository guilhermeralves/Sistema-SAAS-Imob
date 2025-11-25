import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Imoveis from "./pages/Imoveis";
import Servicos from "./pages/Servicos";
import Contato from "./pages/Contato";
import ImovelDetalhes from "./pages/ImovelDetalhes";
import AreaCliente from "./pages/AreaCliente";
import CRM from "./pages/CRM";
import MeusImoveis from "./pages/MeusImoveis";
import Admin from "./pages/Admin";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/imoveis"} component={Imoveis} />
      <Route path={"/imoveis/:id"} component={ImovelDetalhes} />
      <Route path={"/servicos"} component={Servicos} />
      <Route path={"/contato"} component={Contato} />
      <Route path={"/area-cliente"} component={AreaCliente} />
      <Route path={"/crm"} component={CRM} />
      <Route path={"/meus-imoveis"} component={MeusImoveis} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
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
        // switchable
      >
        <TooltipProvider>
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
