import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refaz o fetch sempre que a tela é montada — no PWA em standalone, o
      // "focus" pode não disparar consistentemente, então este flag garante
      // que ao navegar entre telas os dados ficam frescos.
      refetchOnMount: "always",
      // Refaz quando o navegador recupera a conexão de rede.
      refetchOnReconnect: true,
      // Padrão v4 é true — mantido para o navegador comum.
      refetchOnWindowFocus: true,
      // Considera o dado "fresco" por 30s. Sob esse tempo, evita hammering
      // (ex: se o usuário abre e fecha o mesmo card 3x em segundos).
      staleTime: 30_000,
    },
  },
});

// Quando o app/PWA volta do background para a tela ativa, invalida todas as
// queries em cache. É o gatilho principal para o refresh silencioso em PWA
// standalone no Android/iOS — mais confiável que o evento "focus" nesse modo.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      queryClient.invalidateQueries();
    }
  });
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl(
    `${window.location.pathname}${window.location.search}`
  );
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(error => console.error("[sw] Falha ao registrar service worker:", error));
  });

  // Quando o Service Worker recebe um push (novo lead, tarefa, etc), ele
  // manda "push-received" pra cá. Invalidamos as queries para que a tela
  // aberta atualize sozinha, sem o usuário precisar recarregar.
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type === "push-received") {
      queryClient.invalidateQueries();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
