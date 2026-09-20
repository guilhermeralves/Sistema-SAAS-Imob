const PROPERTY_IMAGE_STORAGE_PREFIX = "/uploads/properties/";
const PROPERTY_IMAGE_MEDIA_PREFIX = "/api/media/properties/";
const PROPERTY_IMAGE_VARIANTS = ["large", "thumb"] as const;

export const PROPERTY_IMAGE_REQUEST_HEADER = "x-new-media-request";
export type PropertyImageVariant = (typeof PROPERTY_IMAGE_VARIANTS)[number];

function isSafePropertyImageFileName(value: string) {
  return /^[a-zA-Z0-9_-]{6,}\.webp$/i.test(value);
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

  if (pathname.startsWith(PROPERTY_IMAGE_STORAGE_PREFIX)) {
    return parsePropertyImagePath(pathname.slice(PROPERTY_IMAGE_STORAGE_PREFIX.length));
  }

  if (pathname.startsWith(PROPERTY_IMAGE_MEDIA_PREFIX)) {
    return parsePropertyImagePath(pathname.slice(PROPERTY_IMAGE_MEDIA_PREFIX.length));
  }

  return parsePropertyImagePath(pathname);
}

export function getPropertyImageFileNameFromUrl(url: string) {
  return getPropertyImageInfoFromUrl(url)?.fileName ?? null;
}

export function toPropertyImageMediaEndpoint(
  url: string,
  variant: PropertyImageVariant = "large"
) {
  const fileName = getPropertyImageInfoFromUrl(url)?.fileName ?? null;
  if (!fileName) return null;
  return `${PROPERTY_IMAGE_MEDIA_PREFIX}${variant}/${fileName}`;
}
