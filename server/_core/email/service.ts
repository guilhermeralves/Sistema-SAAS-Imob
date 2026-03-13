import type { IncomingMessage } from "node:http";
import { ENV } from "../env";
import type { User } from "../../../drizzle/schema";
import { getEmailProvider } from "./provider";
import { renderWelcomeAdminTemplate } from "./templates/welcome-admin";
import { renderWelcomeBrokerTemplate } from "./templates/welcome-broker";
import { renderWelcomeClientTemplate } from "./templates/welcome-client";

type WelcomeEmailInput = {
  user: Pick<User, "id" | "name" | "email" | "role">;
  req?: IncomingMessage;
};

function getUserDisplayName(user: Pick<User, "name" | "email" | "id">) {
  return user.name?.trim() || user.email?.trim() || `Usuario #${user.id}`;
}

export function resolveAppBaseUrl(req?: IncomingMessage) {
  if (ENV.appBaseUrl) {
    return ENV.appBaseUrl.replace(/\/+$/, "");
  }

  const host = req?.headers.host?.trim();
  if (!host) {
    return "http://localhost:3000";
  }

  const forwardedProto = req?.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0].trim()
      : ENV.isProduction
        ? "https"
        : "http";

  return `${protocol}://${host}`.replace(/\/+$/, "");
}

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  if (!input.user.email?.trim()) {
    return null;
  }

  const appUrl = resolveAppBaseUrl(input.req);
  const name = getUserDisplayName(input.user);
  const provider = getEmailProvider();

  const template =
    input.user.role === "administrativo"
      ? {
          subject: "Seu acesso administrativo foi criado",
          ...renderWelcomeAdminTemplate({ name, appUrl }),
        }
      : input.user.role === "corretor"
        ? {
            subject: "Seu acesso de corretor foi criado",
            ...renderWelcomeBrokerTemplate({ name, appUrl }),
          }
        : {
            subject: "Bem-vindo(a) a AFG Imobiliaria",
            ...renderWelcomeClientTemplate({ name, appUrl }),
          };

  const result = await provider.send({
    to: input.user.email.trim(),
    subject: template.subject,
    html: template.html,
    text: template.text,
    replyTo: ENV.emailReplyTo || undefined,
  });

  if (result.provider === "preview") {
    console.log(
      `[Email][preview] Boas-vindas para ${input.user.email} salvas em ${result.previewHtmlPath}`
    );
  }

  return result;
}
