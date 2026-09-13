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

export type SubscriberChunk = {
  /** Contatos deste lote (até `chunkSize`). */
  contatos: BotConversaSubscriber[];
  /** Total de contatos existentes na conta BotConversa (do `count`). */
  count: number | null;
  /**
   * Número da primeira página BotConversa que AINDA não foi lida.
   * `null` quando não há mais nada — o cliente usa isso para saber se
   * mostra ou não o botão "Próxima".
   */
  nextStartPage: number | null;
};

/**
 * Busca um LOTE de subscribers a partir da página BotConversa
 * `startPage`, acumulando páginas internas até chegar em `chunkSize`
 * (padrão 500) ou até a API ficar sem `next`.
 *
 * Uso típico do cliente: primeira chamada `startPage=1`; próxima
 * `startPage=result.nextStartPage`; anterior → guardar histórico
 * dos `startPage`s visitados no cliente e voltar um.
 */
export async function listSubscribersChunk(input?: {
  startPage?: number;
  chunkSize?: number;
}): Promise<SubscriberChunk> {
  const chunkSize = Math.max(1, input?.chunkSize ?? 500);
  const initialPage = Math.max(1, input?.startPage ?? 1);
  const MAX_PAGES_PER_CHUNK = 500;

  const contatos: BotConversaSubscriber[] = [];
  let page = initialPage;
  let count: number | null = null;
  let hasMore = true;

  for (let i = 0; i < MAX_PAGES_PER_CHUNK; i++) {
    const url = `/subscribers/?page=${page}`;
    const data = await botconversaGet<
      BotConversaSubscriber[] | PaginatedResponse
    >(url);

    if (Array.isArray(data)) {
      contatos.push(...data);
      hasMore = false;
      break;
    }

    if (typeof data.count === "number") count = data.count;
    if (Array.isArray(data.results)) contatos.push(...data.results);
    page += 1;
    if (!data.next) {
      hasMore = false;
      break;
    }
    if (contatos.length >= chunkSize) break;
  }

  return {
    contatos: contatos.slice(0, chunkSize),
    count,
    nextStartPage: hasMore ? page : null,
  };
}
