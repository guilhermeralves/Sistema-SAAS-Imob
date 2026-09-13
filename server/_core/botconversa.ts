/**
 * Cliente HTTP para a API pública do BotConversa.
 *
 * Docs: https://backend.botconversa.com.br/swagger/
 * Base URL: https://backend.botconversa.com.br/api/v1/webhook
 * Auth: header `API-KEY: <chave>`
 * Rate limit: 600 req/min
 *
 * A API está em BETA — endpoints podem mudar sem aviso.
 */

const BASE_URL = "https://backend.botconversa.com.br/api/v1/webhook";

function apiKey() {
  const key = process.env.BOTCONVERSA_API_KEY?.trim() ?? "";
  if (!key) {
    throw new Error(
      "BOTCONVERSA_API_KEY não configurado no .env do servidor."
    );
  }
  return key;
}

async function botconversaGet<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "API-KEY": apiKey(),
      "content-type": "application/json",
      accept: "application/json",
    },
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(
      `BotConversa ${res.status}: ${bodyText.slice(0, 300) || res.statusText}`
    );
  }
  return (await res.json()) as T;
}

/**
 * Estrutura mínima retornada em /subscribers/. Os campos exatos podem
 * variar entre versões; usamos `unknown` no restante e mapeamos só o
 * que é usado na UI de teste.
 */
export type BotConversaSubscriber = {
  id?: number | string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  created_at?: string | null;
  last_interaction?: string | null;
  tags?: unknown;
  [key: string]: unknown;
};

export async function listSubscribers(): Promise<BotConversaSubscriber[]> {
  const data = await botconversaGet<
    BotConversaSubscriber[] | { results?: BotConversaSubscriber[] }
  >("/subscribers/");
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}
