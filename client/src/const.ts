export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "App";
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0";

export const APP_LOGO = "/Logo New Imob.png";

export const APP_LOGO2 = "/Logo New Imob.png";

export const APP_LOGO_NOXILON = "/Logo Noxilon.png";

function getCurrentPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}

function buildAuthUrl(basePath: string, redirectTo?: string) {
  const redirect = redirectTo ?? getCurrentPath();
  return `${basePath}?redirect=${encodeURIComponent(redirect)}`;
}

export const getLoginUrl = (redirectTo?: string) =>
  buildAuthUrl("/login", redirectTo);

export const getRegisterUrl = (redirectTo?: string) =>
  buildAuthUrl("/register", redirectTo);
