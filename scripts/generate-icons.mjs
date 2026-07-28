// Rasterises the app badge into the PNG sizes browsers and iOS need.
// Run with: npm run icons
//
// Source, in order of preference:
//   public/icon-source.png  <- the real artwork; drop it here
//   public/icon.svg         <- fallback placeholder
import sharp from 'sharp';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const sourcePng = join(publicDir, 'icon-source.png');
const useSource = await exists(sourcePng);
const source = await readFile(useSource ? sourcePng : join(publicDir, 'icon.svg'));

console.log(useSource
  ? 'source: public/icon-source.png'
  : 'source: public/icon.svg  (placeholder — drop the real artwork at public/icon-source.png)');

// density only affects SVG input; harmless for PNG
const load = () => sharp(source, { density: 384 });

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // iOS home-screen icons are composited on an opaque tile and ignore SVG.
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
];

for (const { file, size } of targets) {
  await load()
    .resize(size, size, { fit: 'contain', background: '#000000' })
    .png()
    .toFile(join(publicDir, file));
  console.log(`wrote public/${file} (${size}x${size})`);
}

// Maskable icon: Android crops to a circle/squircle, so the badge is inset to
// the 80% safe zone on an opaque background instead of being clipped.
const inset = Math.round(512 * 0.8);
const insetBuf = await load().resize(inset, inset, { fit: 'contain', background: '#000000' }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#000000' } })
  .composite([{ input: insetBuf, gravity: 'centre' }])
  .png()
  .toFile(join(publicDir, 'icon-maskable-512.png'));
console.log('wrote public/icon-maskable-512.png (512x512, 80% safe zone)');
