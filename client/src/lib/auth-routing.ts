import type { AppRole } from "@shared/auth";

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
  return "/";
}

export function getPostLoginPath(user: RoleCarrier, _redirectPath?: string | null) {
  return getDefaultAuthenticatedPath(user.role);
}
