// scripts/generate-icons.mjs
// Gera favicon + ícones PWA a partir da logo quadrada em client/public/LOGO-NEW.png.
// Rode sempre que trocar a logo: `corepack pnpm exec node scripts/generate-icons.mjs`.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const SOURCE = "client/public/LOGO-NEW.png";
const OUT_ROOT = "client/public";
const OUT_ICONS = join(OUT_ROOT, "icons");

const targets = [
  { file: join(OUT_ROOT, "favicon.png"), size: 64 },
  { file: join(OUT_ROOT, "apple-touch-icon.png"), size: 180 },
  { file: join(OUT_ICONS, "icon-192.png"), size: 192 },
  { file: join(OUT_ICONS, "icon-512.png"), size: 512 },
];

await mkdir(OUT_ICONS, { recursive: true });

for (const { file, size } of targets) {
  await sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(file);
  console.log(`✓ ${file} (${size}x${size})`);
}
