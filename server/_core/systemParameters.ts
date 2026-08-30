import { eq } from "drizzle-orm";
import { systemParameters } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "./env";

/**
 * Cache in-process (5 min) da linha única de systemParameters, usado
 * por módulos server-side (e-mail, push, etc.) para pegar contatos e
 * nome da imobiliária sem hit no banco a cada envio.
 */
type Cache = {
  loadedAt: number;
  row: Awaited<ReturnType<typeof loadRow>> | null;
};

let cache: Cache = { loadedAt: 0, row: null };
const TTL_MS = 5 * 60 * 1000;

async function loadRow() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(systemParameters)
    .where(eq(systemParameters.id, 1))
    .limit(1);
  return rows[0] ?? null;
}

async function get() {
  if (Date.now() - cache.loadedAt < TTL_MS) return cache.row;
  cache = { loadedAt: Date.now(), row: await loadRow() };
  return cache.row;
}

/** Invalidar cache — chamado após save via router. */
export function invalidateSystemParametersCache() {
  cache = { loadedAt: 0, row: null };
}

/**
 * Retorna o campo `From:` do e-mail no formato `Nome <email>` usando
 * os parâmetros cadastrados quando disponíveis, fallback pro .env.
 */
export async function resolveEmailFrom(): Promise<string> {
  const row = await get();
  const name = row?.imobNomeFantasia?.trim();
  const email = row?.imobEmail?.trim();
  if (name && email) return `${name} <${email}>`;
  if (email) return email;
  return ENV.emailFrom;
}

export async function resolveEmailReplyTo(): Promise<string | undefined> {
  const row = await get();
  const email = row?.imobEmail?.trim();
  if (email) return email;
  return ENV.emailReplyTo || undefined;
}
