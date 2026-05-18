import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";

const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
const LARGE_IMAGE_SIDE = 1920;
const LARGE_WEBP_QUALITY = 82;
const THUMB_IMAGE_SIDE = 960;
const THUMB_WEBP_QUALITY = 82;

const PROPERTY_UPLOAD_DIR = path.resolve(import.meta.dirname, "../..", "uploads", "properties");
const PROPERTY_UPLOAD_STORAGE_PREFIX = "/uploads/properties/";
export const PROPERTY_IMAGE_MEDIA_PREFIX = "/api/media/properties/";
export const PROPERTY_IMAGE_REQUEST_HEADER = "x-afg-media-request";
export const PROPERTY_IMAGE_VARIANTS = ["large", "thumb"] as const;

export type PropertyImageVariant = (typeof PROPERTY_IMAGE_VARIANTS)[number];

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
  await Promise.all(
    PROPERTY_IMAGE_VARIANTS.map(variant =>
      fs.mkdir(path.join(PROPERTY_UPLOAD_DIR, variant), { recursive: true })
    )
  );
}

function isSafePropertyImageFileName(fileName: string) {
  return /^[a-zA-Z0-9_-]{6,}\.webp$/i.test(fileName);
}

function isPropertyImageVariant(value: string): value is PropertyImageVariant {
  return PROPERTY_IMAGE_VARIANTS.includes(value as PropertyImageVariant);
}

function parsePropertyImagePath(pathname: string) {
  const normalizedPathname = pathname.replace(/\\/g, "/");
  const parts = normalizedPathname.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1] || "";
  const variantCandidate = parts[parts.length - 2] || "";

  if (!isSafePropertyImageFileName(fileName)) return null;

  return {
    fileName,
    variant: isPropertyImageVariant(variantCandidate) ? variantCandidate : null,
  };
}

export function getPropertyImageInfoFromUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  try {
    pathname = new URL(trimmed, "http://localhost").pathname;
  } catch {
    pathname = trimmed;
  }

  if (pathname.startsWith(PROPERTY_UPLOAD_STORAGE_PREFIX)) {
    return parsePropertyImagePath(pathname.slice(PROPERTY_UPLOAD_STORAGE_PREFIX.length));
  }

  if (pathname.startsWith(PROPERTY_IMAGE_MEDIA_PREFIX)) {
    return parsePropertyImagePath(pathname.slice(PROPERTY_IMAGE_MEDIA_PREFIX.length));
  }

  return parsePropertyImagePath(pathname);
}

export function getPropertyImageFileNameFromUrl(url: string) {
  return getPropertyImageInfoFromUrl(url)?.fileName ?? null;
}

export function getPropertyImageAbsolutePath(
  fileName: string,
  variant: PropertyImageVariant = "large"
) {
  if (!isSafePropertyImageFileName(fileName)) return null;
  if (!isPropertyImageVariant(variant)) return null;

  const variantDir = path.join(PROPERTY_UPLOAD_DIR, variant);
  const resolvedPath = path.resolve(variantDir, fileName);
  const relativePath = path.relative(variantDir, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

async function optimizeImage(buffer: Buffer, options: { side: number; quality: number }) {
  return await sharp(buffer)
    .rotate()
    .resize({
      width: options.side,
      height: options.side,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: options.quality,
      effort: 4,
    })
    .toBuffer();
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

  const [largeBuffer, thumbBuffer] = await Promise.all([
    optimizeImage(buffer, { side: LARGE_IMAGE_SIDE, quality: LARGE_WEBP_QUALITY }),
    optimizeImage(buffer, { side: THUMB_IMAGE_SIDE, quality: THUMB_WEBP_QUALITY }),
  ]);
  const [largeMeta, thumbMeta] = await Promise.all([
    sharp(largeBuffer).metadata(),
    sharp(thumbBuffer).metadata(),
  ]);

  const imageId = nanoid(16);
  const outputFileName = `${imageId}.webp`;
  const largeFilePath = getPropertyImageAbsolutePath(outputFileName, "large");
  const thumbFilePath = getPropertyImageAbsolutePath(outputFileName, "thumb");

  if (!largeFilePath || !thumbFilePath) {
    throw new Error("Nao foi possivel definir o caminho de armazenamento da imagem.");
  }

  await Promise.all([
    fs.writeFile(largeFilePath, largeBuffer),
    fs.writeFile(thumbFilePath, thumbBuffer),
  ]);

  return {
    url: `${PROPERTY_UPLOAD_STORAGE_PREFIX}large/${outputFileName}`,
    thumbnailUrl: `${PROPERTY_UPLOAD_STORAGE_PREFIX}thumb/${outputFileName}`,
    width: largeMeta.width ?? null,
    height: largeMeta.height ?? null,
    thumbnailWidth: thumbMeta.width ?? null,
    thumbnailHeight: thumbMeta.height ?? null,
    format: "webp" as const,
    originalBytes: buffer.length,
    optimizedBytes: largeBuffer.length,
    thumbnailBytes: thumbBuffer.length,
    originalFileName: input.fileName?.trim() || null,
  };
}

export async function removeStoredPropertyImageByUrl(url: string) {
  const fileName = getPropertyImageFileNameFromUrl(url);
  if (!fileName) {
    return false;
  }

  const results = await Promise.all(
    PROPERTY_IMAGE_VARIANTS.map(async variant => {
      const resolvedPath = getPropertyImageAbsolutePath(fileName, variant);
      if (!resolvedPath) return false;

      try {
        await fs.unlink(resolvedPath);
        return true;
      } catch {
        return false;
      }
    })
  );

  return results.some(Boolean);
}
