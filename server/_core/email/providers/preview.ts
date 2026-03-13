import { promises as fs } from "node:fs";
import path from "node:path";
import type { EmailMessage, EmailProvider } from "../types";

function sanitizeFileChunk(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "email";
}

export class PreviewEmailProvider implements EmailProvider {
  constructor(private readonly outputDir: string) {}

  async send(message: EmailMessage) {
    await fs.mkdir(this.outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = `${timestamp}-${sanitizeFileChunk(message.to)}-${sanitizeFileChunk(message.subject)}`;
    const textPath = path.join(this.outputDir, `${baseName}.txt`);
    const htmlPath = path.join(this.outputDir, `${baseName}.html`);

    const header = [`Para: ${message.to}`, `Assunto: ${message.subject}`];
    if (message.replyTo) {
      header.push(`Responder para: ${message.replyTo}`);
    }

    await Promise.all([
      fs.writeFile(textPath, `${header.join("\n")}\n\n${message.text}`, "utf8"),
      fs.writeFile(htmlPath, message.html, "utf8"),
    ]);

    return {
      provider: "preview" as const,
      previewTextPath: textPath,
      previewHtmlPath: htmlPath,
    };
  }
}
