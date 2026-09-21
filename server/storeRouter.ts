/**
 * Loja & Carteira de bonificações — rotas tRPC.
 *
 * - Corretor: consulta o próprio saldo/extrato.
 * - Admin: bonifica manualmente qualquer corretor, ajusta settings da loja e
 *   consulta o saldo/extrato de qualquer usuário.
 */
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";

const bonusInputSchema = z.object({
  userId: z.number().int().positive(),
  amount: z.number().int().positive().max(1_000_000),
  description: z
    .string()
    .trim()
    .min(1, "descreva o motivo do bônus")
    .max(300),
});

const storeSettingsInputSchema = z.object({
  pixKey: z.string().trim().max(100).optional(),
  pixMerchantName: z.string().trim().max(60).optional(),
  pixMerchantCity: z.string().trim().max(40).optional(),
  // Percentuais em milésimos: 100 = 0.1%, 1000 = 1%. Aceita 0 para desligar.
  tokensSalePercentMilli: z.number().int().min(0).max(100_000).optional(),
  tokensRentalPercentMilli: z.number().int().min(0).max(100_000).optional(),
});

const productInputSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(4000).optional().nullable(),
  categoria: z.string().trim().min(1).max(40),
  fotos: z.array(z.string().min(1).max(500)).max(10).default([]),
  tokenPrice: z.number().int().min(0).max(100_000_000),
  brlPriceCents: z.number().int().min(0).max(100_000_000).default(0),
  estoque: z.number().int().min(0).max(1_000_000).optional().nullable(),
  isActive: z.number().int().min(0).max(1).default(1),
});

export const storeRouter = router({
  /* ---------- Endpoints de corretor / self ---------- */

  myBalance: protectedProcedure.query(async ({ ctx }) => {
    const { getWalletBalance } = await import("./db");
    const tokens = await getWalletBalance(ctx.user.id);
    return { tokens };
  }),

  myTransactions: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const { getWalletTransactions } = await import("./db");
      const rows = await getWalletTransactions(ctx.user.id, input?.limit ?? 50);
      return rows;
    }),

  /* ---------- Endpoints de admin ---------- */

  admin: router({
    userBalance: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const { getWalletBalance } = await import("./db");
        const tokens = await getWalletBalance(input.userId);
        return { tokens };
      }),

    userTransactions: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          limit: z.number().int().min(1).max(200).default(100),
        })
      )
      .query(async ({ input }) => {
        const { getWalletTransactions } = await import("./db");
        return await getWalletTransactions(input.userId, input.limit);
      }),

    giveBonus: adminProcedure
      .input(bonusInputSchema)
      .mutation(async ({ ctx, input }) => {
        const { getUserById, applyWalletTransaction } = await import("./db");
        const target = await getUserById(input.userId);
        if (!target) throw new Error("usuário não encontrado");
        if (target.role !== "corretor" && target.role !== "administrativo") {
          throw new Error("bônus só pode ser dado a corretor ou admin");
        }
        const result = await applyWalletTransaction({
          userId: input.userId,
          type: "credit",
          amount: input.amount,
          reason: "admin_bonus",
          description: input.description,
          createdByUserId: ctx.user.id,
        });
        return { ok: true, balance: result.balance };
      }),

    debitAdjustment: adminProcedure
      .input(bonusInputSchema)
      .mutation(async ({ ctx, input }) => {
        const { applyWalletTransaction } = await import("./db");
        const result = await applyWalletTransaction({
          userId: input.userId,
          type: "debit",
          amount: input.amount,
          reason: "admin_bonus",
          description: input.description,
          createdByUserId: ctx.user.id,
        });
        return { ok: true, balance: result.balance };
      }),

    settings: adminProcedure.query(async () => {
      const { getStoreSettings } = await import("./db");
      return await getStoreSettings();
    }),

    updateSettings: adminProcedure
      .input(storeSettingsInputSchema)
      .mutation(async ({ ctx, input }) => {
        const { updateStoreSettings } = await import("./db");
        await updateStoreSettings({ ...input, updatedByUserId: ctx.user.id });
        return { ok: true };
      }),

    /* Produtos — CRUD do admin */
    listProducts: adminProcedure.query(async () => {
      const { listStoreProducts } = await import("./db");
      return await listStoreProducts();
    }),

    productById: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const { getStoreProductById } = await import("./db");
        const row = await getStoreProductById(input.id);
        if (!row) throw new Error("produto não encontrado");
        return row;
      }),

    createProduct: adminProcedure
      .input(productInputSchema)
      .mutation(async ({ ctx, input }) => {
        const { createStoreProduct } = await import("./db");
        const row = await createStoreProduct({
          ...input,
          descricao: input.descricao ?? null,
          estoque: input.estoque ?? null,
          fotos: JSON.stringify(input.fotos ?? []),
          createdByUserId: ctx.user.id,
        });
        return row;
      }),

    updateProduct: adminProcedure
      .input(z.object({ id: z.number().int().positive() }).and(productInputSchema.partial()))
      .mutation(async ({ input }) => {
        const { updateStoreProduct } = await import("./db");
        const { id, fotos, ...rest } = input;
        await updateStoreProduct(id, {
          ...rest,
          ...(fotos ? { fotos: JSON.stringify(fotos) } : {}),
        });
        return { ok: true };
      }),

    deleteProduct: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const { deleteStoreProduct } = await import("./db");
        await deleteStoreProduct(input.id);
        return { ok: true };
      }),

    uploadProductImage: adminProcedure
      .input(z.object({ dataUrl: z.string().min(20) }))
      .mutation(async ({ input }) => {
        const { optimizeAndStoreProductImage } = await import("./_core/store-images");
        const { url } = await optimizeAndStoreProductImage({ dataUrl: input.dataUrl });
        return { url };
      }),
  }),

  /* Vitrine — corretor/admin veem só produtos ativos */
  listActiveProducts: protectedProcedure.query(async () => {
    const { listStoreProducts } = await import("./db");
    return await listStoreProducts({ onlyActive: true });
  }),
});
