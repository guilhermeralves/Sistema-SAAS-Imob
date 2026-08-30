import type { AppRole } from "@shared/auth";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireRoles = (roles: AppRole[]) =>
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: roles.includes("administrativo")
          ? NOT_ADMIN_ERR_MSG
          : "You do not have required permission",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

/**
 * Gate de licença. Bloqueia:
 *  - toda mutation se a instalação NÃO estiver ativada
 *  - toda mutation se a licença estiver em readonly/suspended
 *
 * Queries continuam funcionando (dados ficam visíveis mesmo com licença
 * vencida), exceto se não houver ativação — nesse caso o front sabe que
 * precisa redirecionar para /ativar.
 *
 * Endpoints públicos (login, activate, status) usam publicProcedure e
 * não passam por esse guard.
 */
const licenseGate = t.middleware(async opts => {
  const { ctx, type, next } = opts;
  if (type !== "mutation") return next();

  const gate = ctx.gate;
  if (!gate.activated) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Sistema não ativado. Informe o código de licença em /ativar.",
    });
  }

  if (gate.effectiveStatus === "readonly") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Sistema em modo somente-leitura: licença vencida há ${gate.daysOverdue} dias. Contate o suporte NOXILON.`,
    });
  }

  if (gate.effectiveStatus === "suspended") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Licença suspensa. Contate o suporte NOXILON.",
    });
  }

  return next();
});

export const protectedProcedure = t.procedure.use(requireUser).use(licenseGate);
export const roleProcedure = (...roles: AppRole[]) =>
  protectedProcedure.use(requireRoles(roles));
export const adminProcedure = roleProcedure("administrativo");
export const staffProcedure = roleProcedure("administrativo", "corretor");
export const clientProcedure = roleProcedure("cliente");
