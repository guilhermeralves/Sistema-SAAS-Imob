export const APP_ROLES = ["cliente", "corretor", "administrativo"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  cliente: "Cliente",
  corretor: "Corretor",
  administrativo: "Admin",
};

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "administrativo";
}

export function isStaffRole(role: AppRole | null | undefined) {
  return role === "administrativo" || role === "corretor";
}
