import type { Transporter } from "nodemailer";
import { ENV } from "../../env";
import type { EmailMessage, EmailProvider } from "../types";

export class SmtpEmailProvider implements EmailProvider {
  constructor(private readonly transporter: Transporter) {}

  async send(message: EmailMessage) {
    if (!ENV.smtpHost) {
      throw new Error("EMAIL_SMTP_HOST nao configurado");
    }

    const result = await this.transporter.sendMail({
      from: ENV.emailFrom,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo || ENV.emailReplyTo || undefined,
    });

    return {
      provider: "smtp" as const,
      messageId: result.messageId,
    };
  }
}
