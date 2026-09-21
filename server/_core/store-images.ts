import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";

/**
 * Upload de fotos de PRODUTOS da loja. Imagens públicas — visíveis na
 * vitrine sem login. Guardadas em `uploads/store/` e servidas via
 * rota express pública `/api/media/store/:fileName`.
 *
 * Padrão espelha launch-images.ts (webp, redimensiona para 1200px máx).
 */

const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 1200;
const QUALITY = 82;

const STORE_UPLOAD_DIR = path.resolve(
  import.meta.dirname,
  "../..",
  "uploads",
  "store"
);

export const STORE_IMAGE_MEDIA_PREFIX = "/api/media/store/";

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Envie uma imagem em base64 (data URL).");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("Arquivo vazio.");
  if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
    throw new Error("Imagem excede o limite de 20MB.");
  }
  return buffer;
}

export async function ensureStoreUploadDir() {
  await fs.mkdir(STORE_UPLOAD_DIR, { recursive: true });
}

function isSafeFileName(fileName: string) {
  return /^[a-zA-Z0-9_-]{6,}\.webp$/i.test(fileName);
}

export function getStoreImageAbsolutePath(fileName: string) {
  if (!isSafeFileName(fileName)) return null;
  const resolved = path.resolve(STORE_UPLOAD_DIR, fileName);
  const rel = path.relative(STORE_UPLOAD_DIR, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

export async function optimizeAndStoreProductImage(input: {
  dataUrl: string;
}) {
  const buffer = parseDataUrl(input.dataUrl);
  await ensureStoreUploadDir();

  const fileName = `${nanoid(16)}.webp`;
  const filePath = path.resolve(STORE_UPLOAD_DIR, fileName);

  await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY })
    .toFile(filePath);

  return {
    url: `${STORE_IMAGE_MEDIA_PREFIX}${fileName}`,
    fileName,
  };
}

export async function deleteStoreImage(fileName: string) {
  const abs = getStoreImageAbsolutePath(fileName);
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch {
    // arquivo pode não existir; ignora silenciosamente
  }
}
