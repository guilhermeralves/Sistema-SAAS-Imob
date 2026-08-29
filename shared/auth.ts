export const APP_ROLES = [
  "cliente",
  "corretor",
  "administrativo",
  "super_admin",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  cliente: "Cliente",
  corretor: "Corretor",
  administrativo: "Admin",
  super_admin: "Super Admin",
};

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "administrativo" || role === "super_admin";
}

export function isStaffRole(role: AppRole | null | undefined) {
  return (
    role === "administrativo" ||
    role === "corretor" ||
    role === "super_admin"
  );
}

export function isSuperAdminRole(role: AppRole | null | undefined) {
  return role === "super_admin";
}
