import { trpc } from "@/lib/trpc";

/**
 * Hook centralizador dos dados públicos da imobiliária (nome, contato,
 * endereço, whatsapp). Todos os pontos do frontend que exibem essas
 * informações — Footer, link do WhatsApp, telas de contato — devem ler
 * daqui para refletirem imediatamente mudanças em /admin/parametros.
 */
export function useSystemInfo() {
  const { data } = trpc.systemParameters.publicInfo.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min: raramente muda
    refetchOnWindowFocus: true,
  });
  return data ?? null;
}

/**
 * Formata endereço em uma linha para exibição.
 */
export function formatFullAddress(info: {
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}) {
  const parts: string[] = [];
  if (info.endereco) {
    let street = info.endereco;
    if (info.numero) street += `, ${info.numero}`;
    if (info.complemento) street += ` – ${info.complemento}`;
    parts.push(street);
  }
  if (info.bairro) parts.push(info.bairro);
  const cityUf = [info.cidade, info.estado].filter(Boolean).join("/");
  if (cityUf) parts.push(cityUf);
  if (info.cep) parts.push(`CEP ${info.cep}`);
  return parts.join(" – ");
}

/**
 * Normaliza número de telefone/whatsapp em digits para wa.me.
 */
export function toWhatsappDigits(phone: string | null | undefined) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // Se não começar por 55, prefixa (assumindo Brasil).
  return digits.startsWith("55") ? digits : `55${digits}`;
}
