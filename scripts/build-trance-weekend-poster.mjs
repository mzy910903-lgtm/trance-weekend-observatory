import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = "/Users/zeyun/Documents/trance world";
const outDir = path.join(root, "artifacts");
const backgroundPath =
  "/Users/zeyun/.codex/generated_images/019f6167-0d71-7f23-82f4-2bed6451c8f1/ig_035e368abbe09bfe016a5663281a3881919e40b426b1c8bd43.png";
const logoPath =
  "/Users/zeyun/Desktop/VJsource/Trance Weekend所有logo/Trance Weekend所有logo/定稿黑白.png";
const outPath = path.join(outDir, "trance-weekend-2026-07-31-poster.png");
const logoCropPath = path.join(outDir, "trance-weekend-logo-crop.png");

const width = 1080;
const height = 1350;

async function cropLogo() {
  const { data, info } = await sharp(logoPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 24 || g > 24 || b > 24) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const pad = 10;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropWidth = Math.min(info.width - left, maxX - minX + pad * 2);
  const cropHeight = Math.min(info.height - top, maxY - minY + pad * 2);

  await sharp(logoPath)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: 238 })
    .png()
    .toFile(logoCropPath);
}

function svgOverlay() {
  return Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="title" x1="120" y1="250" x2="760" y2="640" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fbfbf2"/>
      <stop offset="0.58" stop-color="#d8e7e8"/>
      <stop offset="1" stop-color="#b7a9c9"/>
    </linearGradient>
    <linearGradient id="rule" x1="118" y1="0" x2="492" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#d6f2ee" stop-opacity="0.72"/>
      <stop offset="0.52" stop-color="#a6bac6" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#d8c5da" stop-opacity="0"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="#111416" opacity="0.16"/>
  <rect x="44" y="46" width="992" height="1258" fill="none" stroke="#e9ece2" stroke-opacity="0.18" stroke-width="1"/>
  <rect x="76" y="78" width="928" height="1194" fill="none" stroke="#e9ece2" stroke-opacity="0.07" stroke-width="1"/>

  <text x="116" y="180" fill="#dfe8e3" fill-opacity="0.62"
    font-family="Avenir Next, Avenir, Helvetica Neue, Arial, sans-serif"
    font-size="18" font-weight="500" letter-spacing="5">TRANCE WEEKEND</text>

  <g filter="url(#softShadow)">
    <text x="112" y="382" fill="url(#title)"
      font-family="Didot, Songti SC, serif" font-size="142" font-weight="400">Trance</text>
    <text x="112" y="515" fill="url(#title)"
      font-family="Didot, Songti SC, serif" font-size="134" font-weight="400">Weekend</text>
  </g>

  <rect x="118" y="576" width="380" height="1.5" fill="url(#rule)"/>

  <g font-family="Hiragino Sans GB, PingFang SC, Helvetica Neue, Arial, sans-serif" fill="#eff3ec">
    <text x="118" y="690" font-size="45" font-weight="300">7月31日</text>
    <text x="348" y="690" font-size="29" font-weight="300" fill-opacity="0.72">周五</text>
    <text x="118" y="770" font-size="60" font-weight="300" letter-spacing="3">21:00</text>
    <text x="320" y="770" font-size="20" font-weight="500" fill-opacity="0.62" letter-spacing="4">START</text>
    <text x="118" y="870" font-size="28" font-weight="300" fill-opacity="0.88">798艺术区 C+ Bar 户外院子</text>
  </g>

  <g font-family="Avenir Next, Avenir, Helvetica Neue, Arial, sans-serif" fill="#d8e7e8" fill-opacity="0.42">
    <text x="118" y="1124" font-size="14" font-weight="500" letter-spacing="4">OPEN AIR SESSION</text>
    <text x="118" y="1160" font-size="14" font-weight="400" letter-spacing="3">MUTED LIGHT / DEEP MELODY / WEEKEND DRIFT</text>
  </g>

  <circle cx="928" cy="1122" r="76" fill="none" stroke="#f1f4eb" stroke-opacity="0.12" stroke-width="1"/>
  <circle cx="928" cy="1122" r="18" fill="#f1f4eb" fill-opacity="0.16"/>
</svg>`);
}

await fs.mkdir(outDir, { recursive: true });
await cropLogo();

const base = await sharp(backgroundPath)
  .resize(width, height, { fit: "cover", position: "center" })
  .modulate({ brightness: 0.78, saturation: 0.72 })
  .linear(0.9, -5)
  .blur(0.3)
  .png()
  .toBuffer();

await sharp(base)
  .composite([
    { input: svgOverlay(), top: 0, left: 0 },
    { input: logoCropPath, top: 88, left: 780 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(outPath);
