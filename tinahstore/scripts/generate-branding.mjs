// Rasterize the repo-native seedling SVGs. Run locally only when artwork changes;
// committed PNGs let Cloudflare build without Chrome or extra dependencies.
import { readFile, writeFile } from 'node:fs/promises';
import { localBrowser } from './lib/local-browser.mjs';

const icon = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const card = await readFile(new URL('../src/assets/branding/social-preview.svg', import.meta.url), 'utf8');
const assets = [
  ['favicon.png', icon, 96, 96],
  ['apple-touch-icon.png', icon, 180, 180],
  ['icon-192.png', icon, 192, 192],
  ['icon-512.png', icon, 512, 512],
  ['og-image.png', card, 1200, 630],
];
const browser = await localBrowser();
try {
  for (const [filename, svg, width, height] of assets) {
    const base64 = await browser.evaluate(`(async () => {
      const image = new Image();
      image.src = ${JSON.stringify('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))};
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = ${width}; canvas.height = ${height};
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png').split(',')[1];
    })()`);
    await writeFile(new URL(`../public/${filename}`, import.meta.url), Buffer.from(base64, 'base64'));
    console.log(`Generated ${filename} (${width}×${height})`);
  }
} finally { await browser.close(); }
