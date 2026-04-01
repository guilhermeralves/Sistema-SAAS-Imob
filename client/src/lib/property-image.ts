const PROPERTY_IMAGE_STORAGE_PREFIX = "/uploads/properties/";
const PROPERTY_IMAGE_MEDIA_PREFIX = "/api/media/properties/";

export const PROPERTY_IMAGE_REQUEST_HEADER = "x-afg-media-request";

function isSafePropertyImageFileName(value: string) {
  return /^[a-zA-Z0-9_-]{6,}\.webp$/i.test(value);
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

  if (pathname.startsWith(PROPERTY_IMAGE_STORAGE_PREFIX)) {
    const fileName = pathname.slice(PROPERTY_IMAGE_STORAGE_PREFIX.length);
    return isSafePropertyImageFileName(fileName) ? fileName : null;
  }

  if (pathname.startsWith(PROPERTY_IMAGE_MEDIA_PREFIX)) {
    const fileName = pathname.slice(PROPERTY_IMAGE_MEDIA_PREFIX.length);
    return isSafePropertyImageFileName(fileName) ? fileName : null;
  }

  const parts = pathname.split("/");
  const fileName = parts[parts.length - 1] || "";
  return isSafePropertyImageFileName(fileName) ? fileName : null;
}

export function toPropertyImageMediaEndpoint(url: string) {
  const fileName = getPropertyImageFileNameFromUrl(url);
  if (!fileName) return null;
  return `${PROPERTY_IMAGE_MEDIA_PREFIX}${fileName}`;
}
