import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";

/**
 * Upload de fotos de LANÇAMENTOS.
 *
 * Diferente de property-images (privadas com header de acesso), as
 * fotos de lançamento são públicas — aparecem na lista pública sem
 * login. Guardamos em `uploads/launches/` e servimos via rota
 * express pública `/api/media/launches/:fileName`.
 */

const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
const LARGE_SIDE = 1920;
const LARGE_QUALITY = 82;

const LAUNCH_UPLOAD_DIR = path.resolve(
  import.meta.dirname,
  "../..",
  "uploads",
  "launches"
);
export const LAUNCH_IMAGE_MEDIA_PREFIX = "/api/media/launches/";

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Envie uma imagem em base64 (data URL).");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("Arquivo vazio.");
  if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
    throw new Error("Imagem excede o limite de 20MB.");
  }
  return buffer;
}

export async function ensureLaunchUploadDir() {
  await fs.mkdir(LAUNCH_UPLOAD_DIR, { recursive: true });
}

function isSafeFileName(fileName: string) {
  return /^[a-zA-Z0-9_-]{6,}\.webp$/i.test(fileName);
}

export function getLaunchImageAbsolutePath(fileName: string) {
  if (!isSafeFileName(fileName)) return null;
  const resolved = path.resolve(LAUNCH_UPLOAD_DIR, fileName);
  const rel = path.relative(LAUNCH_UPLOAD_DIR, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

export async function optimizeAndStoreLaunchImage(input: {
  dataUrl: string;
}) {
  const buffer = parseDataUrl(input.dataUrl);
  await ensureLaunchUploadDir();

  const optimized = await sharp(buffer)
    .rotate()
    .resize({
      width: LARGE_SIDE,
      height: LARGE_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: LARGE_QUALITY, effort: 4 })
    .toBuffer();

  const fileName = `${nanoid(16)}.webp`;
  const abs = getLaunchImageAbsolutePath(fileName);
  if (!abs) throw new Error("Caminho de armazenamento inválido.");
  await fs.writeFile(abs, optimized);

  return {
    url: `${LAUNCH_IMAGE_MEDIA_PREFIX}${fileName}`,
    fileName,
    bytes: optimized.length,
  };
}

export async function removeLaunchImageByUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed.startsWith(LAUNCH_IMAGE_MEDIA_PREFIX)) return false;
  const fileName = trimmed.slice(LAUNCH_IMAGE_MEDIA_PREFIX.length);
  const abs = getLaunchImageAbsolutePath(fileName);
  if (!abs) return false;
  try {
    await fs.unlink(abs);
    return true;
  } catch {
    return false;
  }
}
