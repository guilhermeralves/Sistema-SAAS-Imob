import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Info } from "lucide-react";

/**
 * Banner global de status da licença da imobiliária. Aparece somente para
 * usuários autenticados (não-cliente) quando a licença está em grace,
 * readonly ou suspended. Super-admin também vê para monitorar.
 */
export default function LicenseBanner() {
  const { user, isAuthenticated } = useAuth();

  const enabled =
    isAuthenticated &&
    user?.role !== "cliente" &&
    user?.role !== undefined;

  const { data } = trpc.licencas.meuStatus.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  if (!data) return null;
  if (data.status === "active") return null;

  const isReadonly =
    data.status === "readonly" || data.status === "suspended";

  const tone = isReadonly
    ? "bg-red-50 text-red-900 border-red-300 dark:bg-red-950/40 dark:text-red-100 dark:border-red-800"
    : "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800";

  const Icon = isReadonly ? AlertTriangle : Info;

  const msg = (() => {
    if (data.status === "suspended") {
      return "Licença suspensa. O sistema está em modo somente-leitura. Contate o suporte NOXILON para reativar.";
    }
    if (data.status === "readonly") {
      return `Licença vencida há ${data.daysOverdue} dias. Sistema em modo somente-leitura. Regularize o pagamento para restaurar todas as funcionalidades.`;
    }
    // grace
    return `Licença vencida há ${data.daysOverdue} dia(s). Você tem ${data.gracePeriodDays - data.daysOverdue} dia(s) restantes de carência antes do sistema entrar em modo somente-leitura.`;
  })();

  return (
    <div
      className={`w-full border-b px-4 py-2 text-sm ${tone}`}
      role="alert"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="leading-snug">{msg}</p>
      </div>
    </div>
  );
}
