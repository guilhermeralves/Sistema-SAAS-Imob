import { z } from "zod";
import { callActivate } from "./_core/noxilonClient";
import { loadGateState, persistActivation } from "./_core/licenseGate";
import { publicProcedure, router } from "./_core/trpc";

const NOXILON_URL =
  process.env.NOXILON_CENTRAL_URL?.trim() || "http://localhost:3001";

const DEV_BYPASS_MARKER = "dev-bypass";

function getDevBypassCode(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const code = process.env.DEV_LICENSE_CODE?.trim();
  return code && code.length >= 3 ? code : null;
}

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
      const code = input.code.trim();

      const devCode = getDevBypassCode();
      if (devCode && code === devCode) {
        const farFuture = new Date("2099-12-31T00:00:00.000Z").toISOString();
        await persistActivation({
          tenantId: 0,
          tenantSlug: "dev",
          tenantNome: "DEV",
          activationCodeId: 0,
          token: "DEV-BYPASS-TOKEN",
          licenseStatus: "active",
          dueDate: farFuture,
          tokenExpiresAt: farFuture,
          centralUrl: DEV_BYPASS_MARKER,
        });
        console.info("[license] ativação dev bypass reconhecida");
        return {
          ok: true,
          tenant: { id: 0, slug: "dev", nome: "DEV" },
          license: {
            status: "active" as const,
            effectiveStatus: "active" as const,
            dueDate: farFuture,
            gracePeriodDays: 0,
            daysUntilDue: 999999,
            daysOverdue: 0,
          },
        };
      }

      const result = await callActivate(code);
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
