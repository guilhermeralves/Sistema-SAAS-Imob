import { eq } from "drizzle-orm";
import {
  licenseActivation,
  type LicenseActivation,
} from "../../drizzle/schema";
import { getDb } from "../db";

export type GateState =
  | { activated: false }
  | {
      activated: true;
      activation: LicenseActivation;
      effectiveStatus: "active" | "grace" | "readonly" | "suspended";
      daysUntilDue: number;
      daysOverdue: number;
      tokenExpired: boolean;
    };

function computeDaysFromDueDate(dueDate: Date | string | null, gracePeriod = 7) {
  if (!dueDate) {
    return { effectiveStatus: "active" as const, daysUntilDue: 0, daysOverdue: 0 };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((due.getTime() - today.getTime()) / msPerDay);
  if (diffDays >= 0) {
    return { effectiveStatus: "active" as const, daysUntilDue: diffDays, daysOverdue: 0 };
  }
  const overdue = Math.abs(diffDays);
  if (overdue <= gracePeriod) {
    return { effectiveStatus: "grace" as const, daysUntilDue: 0, daysOverdue: overdue };
  }
  return { effectiveStatus: "readonly" as const, daysUntilDue: 0, daysOverdue: overdue };
}

export async function loadGateState(): Promise<GateState> {
  const db = await getDb();
  if (!db) return { activated: false };

  const [activation] = await db.select().from(licenseActivation).limit(1);
  if (!activation) return { activated: false };

  const tokenExpired = new Date(activation.tokenExpiresAt).getTime() < Date.now();
  const persisted = activation.licenseStatus;

  if (persisted === "suspended") {
    return {
      activated: true,
      activation,
      effectiveStatus: "suspended",
      daysUntilDue: 0,
      daysOverdue: 0,
      tokenExpired,
    };
  }

  const derived = computeDaysFromDueDate(activation.dueDate ?? null);
  return {
    activated: true,
    activation,
    effectiveStatus: derived.effectiveStatus,
    daysUntilDue: derived.daysUntilDue,
    daysOverdue: derived.daysOverdue,
    tokenExpired,
  };
}

export async function persistActivation(input: {
  tenantId: number;
  tenantSlug: string;
  tenantNome: string;
  activationCodeId: number;
  token: string;
  licenseStatus: "active" | "grace" | "readonly" | "suspended";
  dueDate: string;
  tokenExpiresAt: string;
  centralUrl: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db.select().from(licenseActivation).limit(1);
  const values = {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    tenantNome: input.tenantNome,
    activationCodeId: input.activationCodeId,
    token: input.token,
    licenseStatus: input.licenseStatus,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    tokenExpiresAt: new Date(input.tokenExpiresAt),
    activatedAt: new Date(),
    centralUrl: input.centralUrl,
  };

  if (existing) {
    await db
      .update(licenseActivation)
      .set({
        ...values,
        lastHeartbeatAt: new Date(),
        lastHeartbeatError: null,
      })
      .where(eq(licenseActivation.id, existing.id));
  } else {
    await db.insert(licenseActivation).values(values);
  }
}

export async function updateHeartbeatSuccess(input: {
  activationId: number;
  token: string;
  tokenExpiresAt: string;
  licenseStatus: "active" | "grace" | "readonly" | "suspended";
  dueDate: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(licenseActivation)
    .set({
      token: input.token,
      tokenExpiresAt: new Date(input.tokenExpiresAt),
      licenseStatus: input.licenseStatus,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      lastHeartbeatAt: new Date(),
      lastHeartbeatError: null,
    })
    .where(eq(licenseActivation.id, input.activationId));
}

export async function updateHeartbeatFailure(
  activationId: number,
  errorMessage: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(licenseActivation)
    .set({
      lastHeartbeatAt: new Date(),
      lastHeartbeatError: errorMessage,
    })
    .where(eq(licenseActivation.id, activationId));
}
