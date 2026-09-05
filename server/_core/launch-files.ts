import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

/**
 * Upload de ARQUIVOS ANEXADOS a lançamentos (PDFs, plantas, book,
 * imagens complementares). Diferente de launch-images (foto de capa
 * otimizada em webp), aqui armazenamos o arquivo bruto — sem
 * conversão, preservando o formato original.
 *
 * São servidos como públicos via rota /api/media/launch-files/:fileName.
 */

const MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB

// Tipos aceitos: PDF, imagens comuns, documentos Office e planilhas.
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];
const ALLOWED_MIME_EXACT = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

const LAUNCH_FILES_UPLOAD_DIR = path.resolve(
  import.meta.dirname,
  "../..",
  "uploads",
  "launch-files"
);
export const LAUNCH_FILE_MEDIA_PREFIX = "/api/media/launch-files/";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
};

function isMimeAllowed(mime: string) {
  if (ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p))) return true;
  return ALLOWED_MIME_EXACT.has(mime);
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Envie o arquivo em base64 (data URL).");
  const mime = match[1].toLowerCase();
  if (!isMimeAllowed(mime)) {
    throw new Error(
      `Tipo de arquivo não permitido: ${mime}. Aceitos: imagem, PDF, Word, Excel, PowerPoint, texto.`
    );
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("Arquivo vazio.");
  if (buffer.length > MAX_INPUT_BYTES) {
    throw new Error("Arquivo excede o limite de 20MB.");
  }
  return { mime, buffer };
}

export async function ensureLaunchFilesUploadDir() {
  await fs.mkdir(LAUNCH_FILES_UPLOAD_DIR, { recursive: true });
}

function isSafeFileName(fileName: string) {
  return /^[a-zA-Z0-9_-]{6,}\.[a-zA-Z0-9]{2,10}$/.test(fileName);
}

export function getLaunchFileAbsolutePath(fileName: string) {
  if (!isSafeFileName(fileName)) return null;
  const resolved = path.resolve(LAUNCH_FILES_UPLOAD_DIR, fileName);
  const rel = path.relative(LAUNCH_FILES_UPLOAD_DIR, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

export async function storeLaunchFile(input: {
  dataUrl: string;
  originalName: string;
}) {
  const { mime, buffer } = parseDataUrl(input.dataUrl);
  await ensureLaunchFilesUploadDir();

  const ext = EXT_BY_MIME[mime] ?? "bin";
  const fileName = `${nanoid(16)}.${ext}`;
  const abs = getLaunchFileAbsolutePath(fileName);
  if (!abs) throw new Error("Caminho de armazenamento inválido.");
  await fs.writeFile(abs, buffer);

  return {
    fileName,
    url: `${LAUNCH_FILE_MEDIA_PREFIX}${fileName}`,
    mime,
    sizeBytes: buffer.length,
    originalName: input.originalName.slice(0, 255),
  };
}

export async function removeLaunchFile(fileName: string) {
  const abs = getLaunchFileAbsolutePath(fileName);
  if (!abs) return false;
  try {
    await fs.unlink(abs);
    return true;
  } catch {
    return false;
  }
}
