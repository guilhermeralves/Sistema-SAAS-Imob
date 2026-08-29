import { eq } from "drizzle-orm";
import { licenses, tenants, type License, type Tenant } from "../../drizzle/schema";
import { getDb } from "../db";

export type LicenseState = {
  tenant: Tenant;
  license: License;
  effectiveStatus: "active" | "grace" | "readonly" | "suspended";
  daysUntilDue: number;
  daysOverdue: number;
};

/**
 * Calcula o status "efetivo" da licença considerando data de vencimento e
 * carência. O campo license.status persistido é atualizado quando muda.
 */
export function computeEffectiveStatus(license: License): {
  status: License["status"];
  daysUntilDue: number;
  daysOverdue: number;
} {
  if (license.status === "suspended") {
    return { status: "suspended", daysUntilDue: 0, daysOverdue: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(license.dueDate);
  due.setHours(0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((due.getTime() - today.getTime()) / msPerDay);

  if (diffDays >= 0) {
    return { status: "active", daysUntilDue: diffDays, daysOverdue: 0 };
  }

  const overdue = Math.abs(diffDays);
  if (overdue <= license.gracePeriodDays) {
    return { status: "grace", daysUntilDue: 0, daysOverdue: overdue };
  }

  return { status: "readonly", daysUntilDue: 0, daysOverdue: overdue };
}

/**
 * Fase 1 monotenant: sempre retorna o tenant AFG (slug='afg').
 * Fase 2 (multi-tenant): passar a resolver a partir de user.tenantId.
 * Super-admin (NOXILON) opera fora do escopo de tenant e nunca tem licença.
 */
export async function loadLicenseStateForUser(
  role?: string
): Promise<LicenseState | null> {
  if (role === "super_admin") return null;

  const db = await getDb();
  if (!db) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, "afg"))
    .limit(1);
  if (!tenant) return null;

  const [license] = await db
    .select()
    .from(licenses)
    .where(eq(licenses.tenantId, tenant.id))
    .limit(1);
  if (!license) return null;

  const effective = computeEffectiveStatus(license);

  if (effective.status !== license.status) {
    await db
      .update(licenses)
      .set({ status: effective.status, updatedAt: new Date() })
      .where(eq(licenses.id, license.id));
    license.status = effective.status;
  }

  return {
    tenant,
    license,
    effectiveStatus: effective.status,
    daysUntilDue: effective.daysUntilDue,
    daysOverdue: effective.daysOverdue,
  };
}
