import nodemailer from "nodemailer";
import { ENV } from "../env";
import type { EmailProvider } from "./types";
import { PreviewEmailProvider } from "./providers/preview";
import { SmtpEmailProvider } from "./providers/smtp";

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider() {
  if (cachedProvider) {
    return cachedProvider;
  }

  cachedProvider =
    ENV.emailProvider === "smtp"
      ? new SmtpEmailProvider(
          nodemailer.createTransport({
            host: ENV.smtpHost,
            port: ENV.smtpPort,
            secure: ENV.smtpSecure,
            auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass } : undefined,
          })
        )
      : new PreviewEmailProvider(ENV.emailPreviewDir);

  return cachedProvider;
}
