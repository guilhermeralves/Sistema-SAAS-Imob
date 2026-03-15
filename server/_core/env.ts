import path from "node:path";

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return value.trim().toLowerCase() === "true";
}

function parseNumber(value: string | undefined, defaultValue: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerName: process.env.OWNER_NAME ?? "Administrador",
  ownerEmail: process.env.OWNER_EMAIL ?? "admin@afg.com",
  ownerPassword: process.env.OWNER_PASSWORD ?? "afg@2026",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "afg-root-admin",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  appBaseUrl: process.env.APP_BASE_URL?.trim() || process.env.VITE_OAUTH_PORTAL_URL?.trim() || "",
  emailProvider: process.env.EMAIL_PROVIDER?.trim().toLowerCase() || (process.env.NODE_ENV === "production" ? "smtp" : "preview"),
  emailFrom: process.env.EMAIL_FROM?.trim() || "AFG Imobiliaria <nao-responda@localhost>",
  emailReplyTo: process.env.EMAIL_REPLY_TO?.trim() || "",
  emailPreviewDir: process.env.EMAIL_PREVIEW_DIR?.trim() || path.resolve(process.cwd(), "tmp/email-previews"),
  smtpHost: process.env.EMAIL_SMTP_HOST?.trim() || "",
  smtpPort: parseNumber(process.env.EMAIL_SMTP_PORT, 587),
  smtpSecure: parseBoolean(process.env.EMAIL_SMTP_SECURE, false),
  smtpUser: process.env.EMAIL_SMTP_USER?.trim() || "",
  smtpPass: process.env.EMAIL_SMTP_PASS ?? "",
};
