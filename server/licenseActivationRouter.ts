import { z } from "zod";
import { callActivate } from "./_core/noxilonClient";
import { loadGateState, persistActivation } from "./_core/licenseGate";
import { publicProcedure, router } from "./_core/trpc";

const NOXILON_URL =
  process.env.NOXILON_CENTRAL_URL?.trim() || "http://localhost:3001";

export const licenseActivationRouter = router({
  /**
   * Status atual da ativação da instalação (usado pelo front para saber
   * se precisa mostrar tela /ativar ou banner de aviso).
   * publicProcedure porque essa consulta acontece antes de qualquer login.
   */
  status: publicProcedure.query(async ({ ctx }) => {
    const g = ctx.gate;
    if (!g.activated) return { activated: false as const };
    return {
      activated: true as const,
      tenantNome: g.activation.tenantNome,
      tenantSlug: g.activation.tenantSlug,
      status: g.effectiveStatus,
      dueDate: g.activation.dueDate,
      daysUntilDue: g.daysUntilDue,
      daysOverdue: g.daysOverdue,
      lastHeartbeatAt: g.activation.lastHeartbeatAt,
      lastHeartbeatError: g.activation.lastHeartbeatError,
      tokenExpired: g.tokenExpired,
      centralUrl: g.activation.centralUrl,
    };
  }),

  /**
   * Consome um código de ativação, chama o NOXILON Central e persiste o
   * token JWT retornado. publicProcedure para funcionar antes de qualquer
   * login (a tela /ativar aparece pra qualquer visitante do domínio até
   * que uma ativação exista no banco).
   */
  activate: publicProcedure
    .input(z.object({ code: z.string().min(3).max(64) }))
    .mutation(async ({ input }) => {
      const result = await callActivate(input.code.trim());
      if (!("ok" in result) || !result.ok) {
        const err = result as { code: string; message: string };
        throw new Error(err.message || err.code || "Falha ao ativar");
      }
      await persistActivation({
        tenantId: result.tenant.id,
        tenantSlug: result.tenant.slug,
        tenantNome: result.tenant.nome,
        activationCodeId: result.activationCodeId,
        token: result.token,
        licenseStatus: result.license.status,
        dueDate: result.license.dueDate,
        tokenExpiresAt: result.expiresAt,
        centralUrl: NOXILON_URL,
      });
      return {
        ok: true,
        tenant: result.tenant,
        license: result.license,
      };
    }),
});
