import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  licensePayments,
  licenses,
  tenants,
  type InsertLicensePayment,
} from "../drizzle/schema";
import { getDb } from "./db";
import { computeEffectiveStatus } from "./_core/licenseState";
import {
  protectedProcedure,
  router,
  superAdminProcedure,
} from "./_core/trpc";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

const tenantIdSchema = z.object({
  tenantId: z.number().int().positive(),
});

const tenantInputSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  nome: z.string().min(2).max(200),
  cnpj: z.string().max(18).optional().nullable(),
  creciPj: z.string().max(32).optional().nullable(),
  email: z.string().email().max(320).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  cep: z.string().max(10).optional().nullable(),
  endereco: z.string().max(255).optional().nullable(),
  numero: z.string().max(20).optional().nullable(),
  complemento: z.string().max(120).optional().nullable(),
  bairro: z.string().max(100).optional().nullable(),
  cidade: z.string().max(100).optional().nullable(),
  estado: z.string().length(2).optional().nullable(),
});

async function loadTenantSummary(tenantId: number) {
  const db = await requireDb();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) return null;

  const [license] = await db
    .select()
    .from(licenses)
    .where(eq(licenses.tenantId, tenantId))
    .limit(1);

  if (!license) {
    return {
      tenant,
      license: null,
      effectiveStatus: null,
      firstPaidAt: null,
      activationDays: 0,
    };
  }

  const effective = computeEffectiveStatus(license);
  if (effective.status !== license.status) {
    await db
      .update(licenses)
      .set({ status: effective.status, updatedAt: new Date() })
      .where(eq(licenses.id, license.id));
    license.status = effective.status;
  }

  const [firstPayment] = await db
    .select({ paidAt: licensePayments.paidAt })
    .from(licensePayments)
    .where(eq(licensePayments.tenantId, tenantId))
    .orderBy(asc(licensePayments.paidAt))
    .limit(1);

  const activationStart = firstPayment?.paidAt ?? license.createdAt;
  const activationDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(activationStart).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  return {
    tenant,
    license,
    effectiveStatus: effective.status,
    daysUntilDue: effective.daysUntilDue,
    daysOverdue: effective.daysOverdue,
    firstPaidAt: firstPayment?.paidAt ?? null,
    activationDays,
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const licencasRouter = router({
  /**
   * Status da licença do próprio tenant (para banner no header).
   * Todo usuário autenticado pode consultar.
   */
  meuStatus: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.license) return null;
    return {
      status: ctx.license.effectiveStatus,
      dueDate: ctx.license.license.dueDate,
      daysUntilDue: ctx.license.daysUntilDue,
      daysOverdue: ctx.license.daysOverdue,
      gracePeriodDays: ctx.license.license.gracePeriodDays,
      tenantNome: ctx.license.tenant.nome,
    };
  }),

  superAdmin: router({
    listar: superAdminProcedure
      .input(
        z
          .object({
            incluirInativas: z.boolean().default(false),
            somenteInativas: z.boolean().default(false),
          })
          .default({ incluirInativas: false, somenteInativas: false })
      )
      .query(async ({ input }) => {
        const db = await requireDb();
        const where = input.somenteInativas
          ? eq(tenants.isActive, 0)
          : input.incluirInativas
            ? undefined
            : eq(tenants.isActive, 1);
        const rows = where
          ? await db
              .select()
              .from(tenants)
              .where(where)
              .orderBy(desc(tenants.createdAt))
          : await db.select().from(tenants).orderBy(desc(tenants.createdAt));
        const summaries = await Promise.all(
          rows.map(t => loadTenantSummary(t.id))
        );
        return summaries.filter(Boolean);
      }),

    obter: superAdminProcedure
      .input(tenantIdSchema)
      .query(async ({ input }) => {
        return await loadTenantSummary(input.tenantId);
      }),

    criarTenant: superAdminProcedure
      .input(
        tenantInputSchema.extend({
          valorMensalCentavos: z.number().int().nonnegative().default(0),
          gracePeriodDays: z.number().int().min(0).max(60).default(7),
        })
      )
      .mutation(async ({ input }) => {
        const db = await requireDb();

        const existing = await db
          .select()
          .from(tenants)
          .where(eq(tenants.slug, input.slug))
          .limit(1);
        if (existing.length > 0) {
          throw new Error("Já existe um tenant com este slug");
        }

        const [tenant] = await db
          .insert(tenants)
          .values({
            slug: input.slug,
            nome: input.nome,
            cnpj: input.cnpj ?? null,
            email: input.email ?? null,
            telefone: input.telefone ?? null,
            cidade: input.cidade ?? null,
            estado: input.estado ?? null,
          })
          .returning();

        const dueDate = addDays(startOfToday(), 30);
        await db.insert(licenses).values({
          tenantId: tenant.id,
          status: "active",
          valorCentavos: input.valorMensalCentavos,
          dueDate,
          gracePeriodDays: input.gracePeriodDays,
        });

        return await loadTenantSummary(tenant.id);
      }),

    atualizarTenant: superAdminProcedure
      .input(tenantIdSchema.merge(tenantInputSchema.partial()))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const { tenantId, ...rest } = input;
        const updates: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) updates[k] = v;
        }
        if (Object.keys(updates).length === 0) {
          return await loadTenantSummary(tenantId);
        }
        updates.updatedAt = new Date();
        await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));
        return await loadTenantSummary(tenantId);
      }),

    atualizarLicenca: superAdminProcedure
      .input(
        tenantIdSchema.extend({
          valorCentavos: z.number().int().nonnegative().optional(),
          gracePeriodDays: z.number().int().min(0).max(60).optional(),
          dueDate: z.date().optional(),
          notes: z.string().max(2000).optional().nullable(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (input.valorCentavos !== undefined)
          updates.valorCentavos = input.valorCentavos;
        if (input.gracePeriodDays !== undefined)
          updates.gracePeriodDays = input.gracePeriodDays;
        if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
        if (input.notes !== undefined) updates.notes = input.notes;
        await db
          .update(licenses)
          .set(updates)
          .where(eq(licenses.tenantId, input.tenantId));
        return await loadTenantSummary(input.tenantId);
      }),

    /**
     * Marca pagamento: registra em licensePayments, avança dueDate em N meses
     * (30 dias por mês por simplicidade), reativa se estava em readonly/grace,
     * e limpa suspended se não foi manual.
     */
    marcarPago: superAdminProcedure
      .input(
        tenantIdSchema.extend({
          valorCentavos: z.number().int().nonnegative(),
          meses: z.number().int().min(1).max(24).default(1),
          observacao: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [license] = await db
          .select()
          .from(licenses)
          .where(eq(licenses.tenantId, input.tenantId))
          .limit(1);
        if (!license) throw new Error("Licença não encontrada");

        const base =
          license.dueDate && new Date(license.dueDate) > startOfToday()
            ? new Date(license.dueDate)
            : startOfToday();
        const competenciaDe = base;
        const competenciaAte = addDays(base, 30 * input.meses);

        const payment: InsertLicensePayment = {
          licenseId: license.id,
          tenantId: input.tenantId,
          valorCentavos: input.valorCentavos,
          paidAt: new Date(),
          competenciaDe,
          competenciaAte,
          registradoPorUserId: ctx.user.id,
          observacao: input.observacao ?? null,
        };
        await db.insert(licensePayments).values(payment);

        await db
          .update(licenses)
          .set({
            status: "active",
            dueDate: competenciaAte,
            lastPaidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(licenses.id, license.id));

        return await loadTenantSummary(input.tenantId);
      }),

    suspender: superAdminProcedure
      .input(tenantIdSchema)
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db
          .update(licenses)
          .set({ status: "suspended", updatedAt: new Date() })
          .where(eq(licenses.tenantId, input.tenantId));
        return await loadTenantSummary(input.tenantId);
      }),

    reativar: superAdminProcedure
      .input(tenantIdSchema)
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [license] = await db
          .select()
          .from(licenses)
          .where(eq(licenses.tenantId, input.tenantId))
          .limit(1);
        if (!license) throw new Error("Licença não encontrada");
        const effective = computeEffectiveStatus({
          ...license,
          status: "active",
        });
        await db
          .update(licenses)
          .set({ status: effective.status, updatedAt: new Date() })
          .where(eq(licenses.id, license.id));
        return await loadTenantSummary(input.tenantId);
      }),

    pagamentos: superAdminProcedure
      .input(tenantIdSchema)
      .query(async ({ input }) => {
        const db = await requireDb();
        return await db
          .select()
          .from(licensePayments)
          .where(eq(licensePayments.tenantId, input.tenantId))
          .orderBy(desc(licensePayments.paidAt));
      }),

    /**
     * Soft-delete: marca tenant como inativo. Licença é automaticamente
     * suspensa para não permitir mais mutations, e o registro segue no
     * banco (audit trail). Para reativar, use `reativarTenant`.
     */
    inativar: superAdminProcedure
      .input(tenantIdSchema)
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db
          .update(tenants)
          .set({
            isActive: 0,
            inactivatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, input.tenantId));
        await db
          .update(licenses)
          .set({ status: "suspended", updatedAt: new Date() })
          .where(eq(licenses.tenantId, input.tenantId));
        return await loadTenantSummary(input.tenantId);
      }),

    reativarTenant: superAdminProcedure
      .input(tenantIdSchema)
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db
          .update(tenants)
          .set({
            isActive: 1,
            inactivatedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, input.tenantId));
        return await loadTenantSummary(input.tenantId);
      }),
  }),
});
