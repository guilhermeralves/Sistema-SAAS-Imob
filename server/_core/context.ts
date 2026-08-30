import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { loadGateState, type GateState } from "./licenseGate";
import { sdk } from "./sdk";
import type { SafeUser } from "./users";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SafeUser | null;
  gate: GateState;
};

export async function createContext(opts: CreateExpressContextOptions) {
  let user: SafeUser | null = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  const gate = await loadGateState();

  return {
    req: opts.req,
    res: opts.res,
    user,
    gate,
  };
}
