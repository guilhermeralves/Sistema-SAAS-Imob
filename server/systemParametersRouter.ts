import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  systemParameters,
  type InsertSystemParameters,
} from "../drizzle/schema";
import { getDb } from "./db";
import { updateEnvFile } from "./_core/envFile";
import { invalidateSystemParametersCache } from "./_core/systemParameters";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";

const ROW_ID = 1;

const parametersSchema = z.object({
  imobNomeFantasia: z.string().max(200).nullable().optional(),
  imobRazaoSocial: z.string().max(200).nullable().optional(),
  imobCnpj: z.string().max(18).nullable().optional(),
  imobCreciPj: z.string().max(32).nullable().optional(),
  imobInscricaoEstadual: z.string().max(32).nullable().optional(),
  imobTelefone: z.string().max(20).nullable().optional(),
  imobEmail: z.string().max(320).nullable().optional(),
  imobCep: z.string().max(10).nullable().optional(),
  imobEndereco: z.string().max(255).nullable().optional(),
  imobNumero: z.string().max(20).nullable().optional(),
  imobComplemento: z.string().max(120).nullable().optional(),
  imobBairro: z.string().max(100).nullable().optional(),
  imobCidade: z.string().max(100).nullable().optional(),
  imobEstado: z.string().max(2).nullable().optional(),
  respNome: z.string().max(200).nullable().optional(),
  respCpf: z.string().max(14).nullable().optional(),
  respCreci: z.string().max(32).nullable().optional(),
  respTelefone: z.string().max(20).nullable().optional(),
  respEmail: z.string().max(320).nullable().optional(),
  bancoNome: z.string().max(100).nullable().optional(),
  bancoAgencia: z.string().max(20).nullable().optional(),
  bancoConta: z.string().max(30).nullable().optional(),
  bancoTipoConta: z.enum(["corrente", "poupanca"]).nullable().optional(),
  bancoTitular: z.string().max(200).nullable().optional(),
  bancoTitularDoc: z.string().max(18).nullable().optional(),
  pixTipo: z
    .enum(["cpf", "cnpj", "email", "telefone", "aleatoria"])
    .nullable()
    .optional(),
  pixChave: z.string().max(100).nullable().optional(),
  comissaoVendaBps: z.number().int().min(0).max(10000).optional(),
  comissaoLocacaoBps: z.number().int().min(0).max(10000).optional(),
  comissaoImobiliariaBps: z.number().int().min(0).max(10000).optional(),
  comissaoCorretorBps: z.number().int().min(0).max(10000).optional(),
  diaPagamentoCorretor: z.number().int().min(1).max(31).optional(),
  metodoPagamentoCorretor: z.enum(["pix", "ted", "boleto"]).optional(),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

async function loadRow() {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(systemParameters)
    .where(eq(systemParameters.id, ROW_ID))
    .limit(1);
  if (rows[0]) return rows[0];
  // Fallback: garante linha única
  await db.insert(systemParameters).values({ id: ROW_ID }).onConflictDoNothing();
  const rows2 = await db
    .select()
    .from(systemParameters)
    .where(eq(systemParameters.id, ROW_ID))
    .limit(1);
  return rows2[0];
}

export const systemParametersRouter = router({
  /**
   * Subconjunto público dos parâmetros — apenas o que aparece em
   * páginas visíveis sem login (rodapé, contato, whatsapp). Nunca
   * expor dados bancários/PIX/comissões aqui.
   */
  publicInfo: publicProcedure.query(async () => {
    const row = await loadRow();
    if (!row) return null;
    return {
      nomeFantasia: row.imobNomeFantasia,
      razaoSocial: row.imobRazaoSocial,
      cnpj: row.imobCnpj,
      creciPj: row.imobCreciPj,
      telefone: row.imobTelefone,
      email: row.imobEmail,
      cep: row.imobCep,
      endereco: row.imobEndereco,
      numero: row.imobNumero,
      complemento: row.imobComplemento,
      bairro: row.imobBairro,
      cidade: row.imobCidade,
      estado: row.imobEstado,
    };
  }),

  get: adminProcedure.query(async () => {
    return await loadRow();
  }),

  save: adminProcedure
    .input(parametersSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const updates: Partial<InsertSystemParameters> = { ...input };
      updates.updatedAt = new Date();
      updates.updatedByUserId = ctx.user.id;
      await db
        .update(systemParameters)
        .set(updates)
        .where(eq(systemParameters.id, ROW_ID));
      invalidateSystemParametersCache();

      // Sync automático das chaves de .env que fazem sentido persistir.
      // O runtime já lê do banco imediatamente (via systemParameters.ts);
      // o .env serve para outros processos/scripts que dependem do env.
      const fresh = await loadRow();
      if (fresh) {
        const emailFrom =
          fresh.imobNomeFantasia && fresh.imobEmail
            ? `${fresh.imobNomeFantasia} <${fresh.imobEmail}>`
            : fresh.imobEmail ?? undefined;
        const envUpdates: Record<string, string | null | undefined> = {
          EMAIL_FROM: emailFrom,
          EMAIL_REPLY_TO: fresh.imobEmail ?? undefined,
          VAPID_SUBJECT: fresh.imobEmail
            ? `mailto:${fresh.imobEmail}`
            : undefined,
          COMPANY_NAME: fresh.imobNomeFantasia ?? undefined,
          COMPANY_CNPJ: fresh.imobCnpj ?? undefined,
          COMPANY_CRECI_PJ: fresh.imobCreciPj ?? undefined,
          COMPANY_PHONE: fresh.imobTelefone ?? undefined,
        };
        try {
          await updateEnvFile(envUpdates);
        } catch (err) {
          console.warn("[systemParameters] sync .env falhou:", err);
        }
      }

      return fresh;
    }),
});
