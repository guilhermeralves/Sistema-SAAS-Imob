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
  }),
});
