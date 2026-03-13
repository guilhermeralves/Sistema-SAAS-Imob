export type EmailProviderName = "preview" | "smtp";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type EmailSendResult = {
  provider: EmailProviderName;
  messageId?: string;
  previewTextPath?: string;
  previewHtmlPath?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
