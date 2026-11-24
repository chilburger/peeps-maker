// Measures where the hair really is in each hairstyle, so the second and third hair-color
// patterns (streaks, tips, ombre, split...) can follow it instead of the drawing's frame.
// Writes "hairGeometry" into config/layers.js, in each part's own units:
//   x0, y0, x1, y1  the box around the colorable hair
//   part            x of the part: the middle of the skull, just under the forehead hairline
//   face            y of the forehead hairline (top of the face skin under the hair)
// Styles already in the file keep their (possibly hand-tuned) numbers unless --all is given.
// Needs Playwright with Chromium. Usage: node tools/measure-hair.mjs [--all]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgFile = path.join(root, 'config/layers.js');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');
await page.addScriptTag({ path: path.join(root, 'parts/parts.js') });
await page.addScriptTag({ path: cfgFile });
const geom = await page.evaluate(async () => {
  const P = window.PEEP_PARTS.hair, L = window.PEEP_LAYERS;
  const SKIP = L.tintSkip || ['HatHip', 'Hijab', 'Turban', 'DocOne', 'DocTwo', 'DocThree'];
  // the same shrunk-ink mask the app uses for ink-drawn hair
  const TINT = '<filter id="t" x="-5%" y="-5%" width="110%" height="110%"><feMorphology operator="erode" radius="11"/><feMorphology operator="dilate" radius="5"/></filter>';
  const only = (svg, tok) => svg.replace(/(fill|stroke)="([^"]*)"/g, (m, a, v) => (a === 'fill' ? (v === tok ? 'fill="#fff"' : v === 'none' ? m : 'fill="#000"') : `${a}="none"`));
  const raster = ([vx, vy, w, h], body) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) a[i] = d[i * 4] > 128 ? 1 : 0;
      ok(a);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${w} ${h}" width="${w}" height="${h}"><defs>${TINT}</defs>${body}</svg>`);
  });
  const out = {};
  for (const n of Object.keys(P)) {
    const part = P[n], own = part.colors.includes('hairColor');
    if (SKIP.includes(n)) continue;
    const vb = part.viewBox.split(' ').map(Number), [vx, vy, w, h] = vb;
    const hair = await raster(vb, own ? only(part.svg, '{{hairColor}}') : `<g filter="url(#t)">${only(part.svg, '{{outlineColor}}')}</g>`);
    const skin = await raster(vb, only(part.svg, '{{skinColor}}'));
    // box around rows and columns with at least 4 hair pixels, so stray specks don't count
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) { let r = 0; for (let x = 0; x < w; x++) r += hair[y * w + x]; if (r >= 4) { y0 = Math.min(y0, y); y1 = y; } }
    for (let x = 0; x < w; x++) { let c = 0; for (let y = 0; y < h; y++) c += hair[y * w + x]; if (c >= 4) { x0 = Math.min(x0, x); x1 = x; } }
    if (x1 < 0) continue; // no colorable hair (bald styles)
    // forehead hairline: the first row under the top of the hair with a wide run of skin
    let face = null;
    for (let y = y0; y < h && face == null; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < w; x++) { run = skin[y * w + x] ? run + 1 : 0; best = Math.max(best, run); }
      if (best > 80) face = y;
    }
    if (face == null) face = y1;
    // the part: middle of the head (hair and skin together) a little under the hairline
    const ry = Math.min(h - 1, face + 30);
    let a = -1, z = -1;
    for (let x = 0; x < w; x++) if (hair[ry * w + x] || skin[ry * w + x]) { if (a < 0) a = x; z = x; }
    out[n] = { x0: x0 + vx, y0: y0 + vy, x1: x1 + vx, y1: y1 + vy, part: Math.round((a + z) / 2 + vx), face: face + vy };
  }
  return out;
});
await browser.close();

const window = {};
const src = fs.readFileSync(cfgFile, 'utf8');
new Function('window', src)(window);
const all = process.argv.includes('--all'), prev = window.PEEP_LAYERS.hairGeometry || {};
const G = {};
for (const n of Object.keys(geom).sort()) G[n] = !all && prev[n] ? prev[n] : geom[n];
// swap in just this block (written as the admin export writes it), leaving the rest of the file as it is
const block = ' "hairGeometry": ' + JSON.stringify(G, null, 1).replace(/\n/g, '\n ');
const re = /\n "hairGeometry": \{[\s\S]*?\n \}(?=,?\n)/;
const next = re.test(src) ? src.replace(re, '\n' + block) : src.replace(/\n\};\s*$/, ',\n' + block + '\n};\n');
new Function('window', next)({}); // still valid
fs.writeFileSync(cfgFile, next);
console.log(`hairGeometry: ${Object.keys(G).length} styles` + (all ? ' (all remeasured)' : ''));
