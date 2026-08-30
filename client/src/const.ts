export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "App";
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0";

/** Logo do cabeçalho — versão preta, sem a palavra "Imob", só o ícone + "new". */
export const APP_LOGO = "/LOGO-NEW-black-no-imob.png";

/** Logo do rodapé — versão preta completa (ícone + "new" + "Imob"). */
export const APP_LOGO2 = "/LOGO-NEW-black.png";

/** Logo original branca (mantida para uso em fundos escuros no futuro). */
export const APP_LOGO_WHITE = "/LOGO-NEW.png";

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
