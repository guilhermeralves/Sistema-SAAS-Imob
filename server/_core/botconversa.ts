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

type PaginatedResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: BotConversaSubscriber[];
};

/**
 * Retorna TODOS os subscribers seguindo a paginação até o fim.
 * A API devolve `next` como URL absoluta — extraímos o `page=N` dela
 * e chamamos `/subscribers/?page=N` até `next` virar null.
 *
 * Limite de segurança: para em 500 páginas (caso de loop ou volume
 * muito acima do esperado). Ajuste MAX_PAGES se necessário.
 */
export async function listSubscribers(): Promise<BotConversaSubscriber[]> {
  const MAX_PAGES = 500;
  const all: BotConversaSubscriber[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = page === 1 ? "/subscribers/" : `/subscribers/?page=${page}`;
    const data = await botconversaGet<
      BotConversaSubscriber[] | PaginatedResponse
    >(url);

    // Resposta não-paginada (fallback improvável)
    if (Array.isArray(data)) {
      all.push(...data);
      break;
    }

    if (Array.isArray(data.results)) all.push(...data.results);
    if (!data.next) break;
    page += 1;
  }

  return all;
}
