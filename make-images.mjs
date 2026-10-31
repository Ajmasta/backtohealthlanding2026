// Draws the share images and icons into src/share/ with headless Edge. Rerun only when the logo or tagline changes.
// Run: node make-images.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(here, 'src/share');
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!edge) throw new Error('Edge not found');

const tree = readFileSync(join(root, 'design/logo/tree-logo.svg'), 'utf8').replace(/<title>.*?<\/title>/s, '');
const fontUrl = (p) => pathToFileURL(join(root, 'mobile/node_modules/@expo-google-fonts', p)).href;
const land = (f) => pathToFileURL(join(root, 'mobile/assets/landscape', f)).href;
const base = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Fraunces; src: url(${fontUrl('fraunces/500Medium/Fraunces_500Medium.ttf')}); }
html, body { margin: 0; overflow: hidden; }
</style>`;

function share(line1, line2) {
  return `${base}<style>
  .s { position: relative; width: 1200px; height: 630px; overflow: hidden; background: linear-gradient(#86cdfb, #e3f1fb 80%); font-family: Fraunces; color: #0f2147; }
  .t { position: absolute; left: 0; top: 330px; width: 1200px; height: 862px; }
  .t img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .cloud { position: absolute; left: 400px; top: 24px; width: 280px; }
  .tree { position: absolute; left: 730px; top: 72px; width: 370px; height: 436px; }
  .tree svg { width: 100%; height: 100%; }
  .text { position: absolute; left: 72px; top: 150px; width: 660px; }
  .name { font-size: 40px; color: #004aad; margin-bottom: 22px; }
  h1 { font-size: 66px; line-height: 1.1; font-weight: 500; margin: 0; }
  </style><div class="s">
  <img class="cloud" src="${land('cloud-1.png')}">
  <div class="t"><img src="${land('hills.png')}"><img src="${land('lake.png')}"><img src="${land('meadow.png')}"></div>
  <div class="tree">${tree}</div>
  <div class="text"><div class="name">BackToHealth</div><h1>${line1}<br>${line2}</h1></div>
  </div>`;
}

function icon(size) {
  const pad = Math.round(size * 0.1);
  return `${base}<style>body { width: ${size}px; height: ${size}px; background: #e3f1fb; }
  svg { position: absolute; left: ${pad}px; top: ${pad}px; width: ${size - 2 * pad}px; height: ${size - 2 * pad}px; }</style>${tree}`;
}

function shot(name, html, w, h) {
  const tmp = join(out, '_tmp.html');
  const target = join(out, name);
  rmSync(target, { force: true });
  writeFileSync(tmp, html);
  execFileSync(edge, ['--headless', '--no-sandbox', '--disable-gpu', `--user-data-dir=${join(tmpdir(), 'bth-edge')}`, '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, '--virtual-time-budget=3000', `--screenshot=${target}`, pathToFileURL(tmp).href], { stdio: 'ignore', timeout: 90000 });
  // Edge's launcher returns before the picture is written, so wait for the file.
  const end = Date.now() + 60000;
  while (!existsSync(target)) {
    if (Date.now() > end) throw new Error(`No picture for ${name}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
  rmSync(tmp);
}

mkdirSync(out, { recursive: true });
shot('og-fr.png', share('Mieux vivre avec', 'la douleur au dos'), 1200, 630);
shot('og-en.png', share('Live better', 'with back pain'), 1200, 630);
shot('icon-512.png', icon(512), 512, 512);
shot('apple-touch-icon.png', icon(180), 180, 180);
shot('icon-48.png', icon(48), 48, 48);
console.log('Images written to', out);
