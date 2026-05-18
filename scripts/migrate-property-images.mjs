import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const propertyUploadDir = path.join(projectRoot, "uploads", "properties");
const largeDir = path.join(propertyUploadDir, "large");
const thumbDir = path.join(propertyUploadDir, "thumb");
const legacyDir = path.join(propertyUploadDir, "legacy");
const storagePrefix = "/uploads/properties/";
const mediaPrefix = "/api/media/properties/";
const thumbImageSide = 960;
const thumbWebpQuality = 82;

function isSafePropertyImageFileName(value) {
  return /^[a-zA-Z0-9_-]{6,}\.webp$/i.test(value);
}

function parsePropertyImagePath(value) {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1] || "";

  if (!isSafePropertyImageFileName(fileName)) return null;
  return fileName;
}

function getPropertyImageFileNameFromUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  try {
    pathname = new URL(trimmed, "http://localhost").pathname;
  } catch {
    pathname = trimmed;
  }

  if (pathname.startsWith(storagePrefix)) {
    return parsePropertyImagePath(pathname.slice(storagePrefix.length));
  }

  if (pathname.startsWith(mediaPrefix)) {
    return parsePropertyImagePath(pathname.slice(mediaPrefix.length));
  }

  return parsePropertyImagePath(pathname);
}

function toLargeStorageUrl(url) {
  const fileName = getPropertyImageFileNameFromUrl(url);
  if (!fileName) return url;
  return `${storagePrefix}large/${fileName}`;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirs() {
  await Promise.all([
    fs.mkdir(largeDir, { recursive: true }),
    fs.mkdir(thumbDir, { recursive: true }),
    fs.mkdir(legacyDir, { recursive: true }),
  ]);
}

async function createThumb(fileName) {
  const largePath = path.join(largeDir, fileName);
  const thumbPath = path.join(thumbDir, fileName);

  if (!(await pathExists(largePath))) {
    return { fileName, status: "large_missing" };
  }

  await sharp(largePath)
    .rotate()
    .resize({
      width: thumbImageSide,
      height: thumbImageSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: thumbWebpQuality,
      effort: 4,
    })
    .toFile(thumbPath);

  return { fileName, status: "thumb_created" };
}

async function migrateFiles() {
  await ensureDirs();

  const entries = await fs.readdir(propertyUploadDir, { withFileTypes: true });
  const rootImageFiles = entries
    .filter(entry => entry.isFile() && isSafePropertyImageFileName(entry.name))
    .map(entry => entry.name);
  const legacyImageFiles = entries
    .filter(entry => entry.isFile() && /\.webp$/i.test(entry.name) && !isSafePropertyImageFileName(entry.name))
    .map(entry => entry.name);

  const moved = [];
  for (const fileName of rootImageFiles) {
    const currentPath = path.join(propertyUploadDir, fileName);
    const largePath = path.join(largeDir, fileName);

    if (await pathExists(largePath)) {
      await fs.unlink(currentPath);
      moved.push({ fileName, status: "removed_duplicate_root" });
      continue;
    }

    await fs.rename(currentPath, largePath);
    moved.push({ fileName, status: "moved_to_large" });
  }

  const legacy = [];
  for (const fileName of legacyImageFiles) {
    const currentPath = path.join(propertyUploadDir, fileName);
    const legacyPath = path.join(legacyDir, fileName);

    if (await pathExists(legacyPath)) {
      legacy.push({ fileName, status: "legacy_already_exists" });
      continue;
    }

    await fs.rename(currentPath, legacyPath);
    legacy.push({ fileName, status: "moved_to_legacy" });
  }

  const largeEntries = await fs.readdir(largeDir, { withFileTypes: true });
  const largeImageFiles = largeEntries
    .filter(entry => entry.isFile() && isSafePropertyImageFileName(entry.name))
    .map(entry => entry.name);

  const thumbs = [];
  for (const fileName of largeImageFiles) {
    thumbs.push(await createThumb(fileName));
  }

  return { moved, legacy, thumbs };
}

async function migrateDatabaseUrls() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { skipped: true, reason: "DATABASE_URL nao definido." };
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query(`SELECT "id", "fotos" FROM "properties" WHERE "fotos" IS NOT NULL;`);
    let updated = 0;
    let skippedInvalidJson = 0;

    for (const row of result.rows) {
      let photos;
      try {
        photos = JSON.parse(row.fotos);
      } catch {
        skippedInvalidJson += 1;
        continue;
      }

      if (!Array.isArray(photos)) continue;

      const nextPhotos = photos.map(photo =>
        typeof photo === "string" ? toLargeStorageUrl(photo) : photo
      );
      const nextFotos = JSON.stringify(nextPhotos);

      if (nextFotos !== row.fotos) {
        await client.query(
          `UPDATE "properties" SET "fotos" = $1, "updatedAt" = now() WHERE "id" = $2;`,
          [nextFotos, row.id]
        );
        updated += 1;
      }
    }

    return {
      skipped: false,
      scanned: result.rows.length,
      updated,
      skippedInvalidJson,
    };
  } finally {
    await client.end();
  }
}

async function run() {
  const files = await migrateFiles();
  const database = await migrateDatabaseUrls();

  console.log(
    JSON.stringify(
      {
        ok: true,
        uploads: {
          root: propertyUploadDir,
          large: largeDir,
          thumb: thumbDir,
          legacy: legacyDir,
        },
        files,
        database,
      },
      null,
      2
    )
  );
}

run().catch(error => {
  console.error("[migrate-property-images] Erro ao migrar imagens dos imoveis.");
  console.error(error);
  process.exit(1);
});
