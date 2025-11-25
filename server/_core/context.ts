import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions) {
  // ========================================
  // MODO DESENVOLVIMENTO LOCAL
  // Usuário fake sempre logado como admin
  // REMOVER EM PRODUÇÃO!
  // ========================================
  
  const fakeUser = {
    id: 1,
    openId: "admin-local",
    name: "Administrador Local",
    email: "admin@local.com",
    role: "administrativo" as const,
    loginMethod: "local",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    req: opts.req,
    res: opts.res,
    user: fakeUser, // Sempre autenticado
  };
}


  /*try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}*/
