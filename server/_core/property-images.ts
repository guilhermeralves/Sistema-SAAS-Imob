import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";

const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1920;
const WEBP_QUALITY = 82;

const PROPERTY_UPLOAD_DIR = path.resolve(import.meta.dirname, "../..", "uploads", "properties");
const PROPERTY_UPLOAD_STORAGE_PREFIX = "/uploads/properties/";
export const PROPERTY_IMAGE_MEDIA_PREFIX = "/api/media/properties/";
export const PROPERTY_IMAGE_REQUEST_HEADER = "x-afg-media-request";

type ParsedDataUrl = {
  mimeType: string;
  buffer: Buffer;
};

function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Formato de imagem invalido. Envie uma imagem em base64 (data URL).");
  }

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2];

  const buffer = Buffer.from(base64Payload, "base64");
  if (!buffer.length) {
    throw new Error("Arquivo de imagem vazio.");
  }

  if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
    throw new Error("A imagem excede o limite permitido de 20MB.");
  }

  return { mimeType, buffer };
}

export async function ensurePropertyUploadDir() {
  await fs.mkdir(PROPERTY_UPLOAD_DIR, { recursive: true });
}

function isSafePropertyImageFileName(fileName: string) {
  return /^[a-zA-Z0-9_-]{6,}\.webp$/i.test(fileName);
}

export function getPropertyImageFileNameFromUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  try {
    pathname = new URL(trimmed, "http://localhost").pathname;
  } catch {
    pathname = trimmed;
  }

  if (pathname.startsWith(PROPERTY_UPLOAD_STORAGE_PREFIX)) {
    const fileName = pathname.slice(PROPERTY_UPLOAD_STORAGE_PREFIX.length);
    return isSafePropertyImageFileName(fileName) ? fileName : null;
  }

  if (pathname.startsWith(PROPERTY_IMAGE_MEDIA_PREFIX)) {
    const fileName = pathname.slice(PROPERTY_IMAGE_MEDIA_PREFIX.length);
    return isSafePropertyImageFileName(fileName) ? fileName : null;
  }

  const fileName = path.basename(pathname);
  return isSafePropertyImageFileName(fileName) ? fileName : null;
}

export function getPropertyImageAbsolutePath(fileName: string) {
  if (!isSafePropertyImageFileName(fileName)) return null;

  const resolvedPath = path.resolve(PROPERTY_UPLOAD_DIR, fileName);
  const relativePath = path.relative(PROPERTY_UPLOAD_DIR, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

export async function optimizeAndStorePropertyImage(input: {
  dataUrl: string;
  fileName?: string | null;
}) {
  const { mimeType, buffer } = parseImageDataUrl(input.dataUrl);
  if (!mimeType.startsWith("image/")) {
    throw new Error("Tipo de arquivo invalido. Apenas imagens sao permitidas.");
  }

  await ensurePropertyUploadDir();

  const optimizedBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_IMAGE_SIDE,
      height: MAX_IMAGE_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: WEBP_QUALITY,
      effort: 4,
    })
    .toBuffer();

  const optimizedMeta = await sharp(optimizedBuffer).metadata();

  const imageId = nanoid(16);
  const outputFileName = `${imageId}.webp`;
  const absoluteFilePath = path.join(PROPERTY_UPLOAD_DIR, outputFileName);
  await fs.writeFile(absoluteFilePath, optimizedBuffer);

  return {
    url: `${PROPERTY_UPLOAD_STORAGE_PREFIX}${outputFileName}`,
    width: optimizedMeta.width ?? null,
    height: optimizedMeta.height ?? null,
    format: "webp" as const,
    originalBytes: buffer.length,
    optimizedBytes: optimizedBuffer.length,
    originalFileName: input.fileName?.trim() || null,
  };
}

export async function removeStoredPropertyImageByUrl(url: string) {
  const fileName = getPropertyImageFileNameFromUrl(url);
  if (!fileName) {
    return false;
  }

  const resolvedPath = getPropertyImageAbsolutePath(fileName);
  if (!resolvedPath) return false;

  try {
    await fs.unlink(resolvedPath);
    return true;
  } catch {
    return false;
  }
}
