import { isAdminRole, isStaffRole, type AppRole } from "@shared/auth";

type RoleCarrier = {
  role: AppRole;
};

export function getRedirectParam() {
  if (typeof window === "undefined") {
    return "/";
  }

  return new URLSearchParams(window.location.search).get("redirect") || "/";
}

export function getDefaultAuthenticatedPath(role: AppRole) {
  if (isAdminRole(role)) {
    return "/admin";
  }

  if (isStaffRole(role)) {
    return "/crm";
  }

  return "/";
}

export function getPostLoginPath(user: RoleCarrier, redirectPath?: string | null) {
  if (redirectPath && redirectPath.startsWith("/")) {
    return redirectPath;
  }

  return getDefaultAuthenticatedPath(user.role);
}
