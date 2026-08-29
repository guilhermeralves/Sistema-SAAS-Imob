import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { loadLicenseStateForUser, type LicenseState } from "./licenseState";
import { sdk } from "./sdk";
import type { SafeUser } from "./users";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SafeUser | null;
  license: LicenseState | null;
};

export async function createContext(opts: CreateExpressContextOptions) {
  let user: SafeUser | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  const license = user ? await loadLicenseStateForUser(user.role) : null;

  return {
    req: opts.req,
    res: opts.res,
    user,
    license,
  };
}
