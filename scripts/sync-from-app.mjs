// Refreshes what the site takes from the app and the design files: exercise and lesson names, the tree drawings,
// the landscape and the fonts. The build never reads outside this repository; this script is the only bridge.
// Run when the app's content or the design changes, then build and commit both:
//   npm run sync -- /path/to/monorepo     (the folder that holds mobile/ and design/; defaults to ../)

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS } from '../site.config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = resolve(process.argv[2] ?? join(root, '..'));
const need = (p) => {
  const full = join(app, p);
  if (!existsSync(full)) throw new Error(`Not found: ${full}. Pass the folder that holds mobile/ and design/.`);
  return full;
};
const read = (p) => readFileSync(need(p), 'utf8');
const out = (p) => join(root, p);

// Exercise and lesson names, in the app's own order.
const lessons = [...read('mobile/src/content/lessons.ts').matchAll(/id: '(\w+)', module: (\d+)/g)].map((m) => ({ id: m[1], module: Number(m[2]) }));
for (const { code } of LANGS) {
  const text = JSON.parse(read(`mobile/src/i18n/${code}.json`));
  const families = Object.entries(text.exercise).reduce((acc, [id, name]) => {
    const family = Number(id.split('_')[0]);
    (acc[family - 1] ??= []).push(name);
    return acc;
  }, []);
  const modules = lessons.reduce((acc, l) => {
    (acc[l.module] ??= { title: text.lesson.modules[l.module], lessons: [] }).lessons.push(text.lesson.titles[l.id]);
    return acc;
  }, {});
  const content = { lessonModules: Object.values(modules), exerciseFamilies: families };
  writeFileSync(out(`content/app/${code}.json`), JSON.stringify(content, null, 2) + '\n');
}

// Tree drawings, without the <title> and <desc> that would be read out a second time next to the page text.
const clean = (s) => s.replace(/<title>.*?<\/title>/s, '').replace(/<desc>.*?<\/desc>/s, '').trim() + '\n';
writeFileSync(out('src/assets/svg/tree-logo.svg'), clean(read('design/logo/tree-logo.svg')));
['01-pousse', '02-jeune-arbre', '03-presque-mature', '04-arbre-mature'].forEach((f, i) =>
  writeFileSync(out(`src/assets/svg/tree-stage-${i + 1}.svg`), clean(read(`design/tree/${f}.svg`))),
);

// The landscape is served as WebP (a tenth of the PNG weight, no visible difference). Needs cwebp (brew install webp).
for (const file of readdirSync(need('mobile/assets/landscape')).filter((f) => f.endsWith('.png'))) {
  const target = out(`src/assets/landscape/${file.replace(/\.png$/, '.webp')}`);
  execFileSync('cwebp', ['-quiet', '-q', '88', '-alpha_q', '100', '-m', '6', join(app, 'mobile/assets/landscape', file), '-o', target]);
}
const fonts = 'mobile/node_modules/@expo-google-fonts';
for (const [family, weight, file] of [['fraunces', '500Medium', 'Fraunces_500Medium'], ['figtree', '400Regular', 'Figtree_400Regular'], ['figtree', '600SemiBold', 'Figtree_600SemiBold']]) {
  // WOFF2 is less than half the TTF. Needs fonttools and brotli (pip install fonttools brotli).
  execFileSync('python3', ['-m', 'fontTools.ttLib.woff2', 'compress', need(`${fonts}/${family}/${weight}/${file}.ttf`), '-o', out(`src/assets/fonts/${file}.woff2`)]);
}

console.log('Synced from', app);
