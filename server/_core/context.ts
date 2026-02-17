import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function getLocalBypassUser(): User {
  const now = new Date();

  return {
    id: 1,
    openId: "admin-local",
    name: "Administrador Local",
    email: "admin@local.com",
    role: "administrativo",
    loginMethod: "local",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export async function createContext(opts: CreateExpressContextOptions) {
  if (!ENV.isProduction && ENV.authBypassEnabled) {
    return {
      req: opts.req,
      res: opts.res,
      user: getLocalBypassUser(),
    };
  }

  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
