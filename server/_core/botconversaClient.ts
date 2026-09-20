/**
 * Cliente HTTP para AÇÕES no BotConversa (transferir conversa, listar managers,
 * enviar mensagens). Complementa `botconversa.ts`, que é focado só em leitura
 * de subscribers.
 *
 * Docs: https://backend.botconversa.com.br/swagger/
 * Base URL: https://backend.botconversa.com.br/api/v1/webhook
 * Auth: header `API-KEY: <chave>`
 */

const BASE_URL = "https://backend.botconversa.com.br/api/v1/webhook";

function apiKey(): string | null {
  const key = process.env.BOTCONVERSA_API_KEY?.trim() ?? "";
  return key.length > 0 ? key : null;
}

async function post(path: string, body: unknown): Promise<Response> {
  const key = apiKey();
  if (!key) {
    throw new Error("BOTCONVERSA_API_KEY não configurado no .env do servidor.");
  }
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  return await fetch(url, {
    method: "POST",
    headers: {
      "API-KEY": key,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
}

export type ChangeConversationStatusResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * Abre a conversa do subscriber e atribui a um manager específico. Essa é a
 * chamada que "transfere o lead pro corretor" dentro do painel BotConversa.
 *
 * Endpoint: POST /subscriber/{subscriber_id}/change_conversation_status/
 * Body: { status: "open", manager_id: <numero> }
 *
 * Retorna { ok: false, ... } em vez de lançar, para que a roleta e o SLA
 * possam registrar o erro sem quebrar o fluxo do lead.
 */
export async function changeConversationStatus(input: {
  subscriberId: string;
  managerId: string;
  status?: "open" | "closed";
}): Promise<ChangeConversationStatusResult> {
  try {
    const res = await post(
      `/subscriber/${encodeURIComponent(input.subscriberId)}/change_conversation_status/`,
      {
        status: input.status ?? "open",
        manager_id: input.managerId,
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        message: text.slice(0, 300) || res.statusText,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "erro desconhecido",
    };
  }
}
