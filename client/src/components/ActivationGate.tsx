import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

/**
 * Guarda global: se a instalação ainda não estiver ativada, redireciona
 * qualquer navegação para /ativar. Enquanto a query de status carrega,
 * não faz nada (evita flash).
 */
export default function ActivationGate() {
  const [location, setLocation] = useLocation();
  const { data, isLoading } = trpc.license.status.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isLoading || !data) return;
    if (data.activated) return;
    if (location === "/ativar") return;
    setLocation("/ativar");
  }, [data, isLoading, location, setLocation]);

  return null;
}
