// Builds the static site into docs/ (GitHub Pages serves that folder): one page per language, from src/template.html and i18n/*.json.
// Every {{a.b}} in the template is a translation key; a missing key stops the build.
// Run: node build.mjs

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dist = join(here, 'docs');

// Address used by every "notify me" and "write to the team" link.
const CONTACT = 'adrien@backtohealth.app';
const SITE = 'https://ajmasta.github.io/backtohealthlanding2026/';

const read = (p) => readFileSync(p, 'utf8');
const langs = { fr: JSON.parse(read(join(here, 'i18n/fr.json'))), en: JSON.parse(read(join(here, 'i18n/en.json'))) };

function lookup(dict, key) {
  const value = key.split('.').reduce((o, k) => o?.[k], dict);
  if (typeof value !== 'string') throw new Error(`Missing key "${key}" for ${dict.lang}`);
  return value;
}

const svg = (p) => read(join(root, p)).replace(/<title>.*?<\/title>/s, '').trim();
const parts = { tree: svg('design/logo/tree-logo.svg'), sprout: svg('design/logo/sprout.svg') };
const template = read(join(here, 'src/template.html'));

rmSync(dist, { recursive: true, force: true });
const assets = join(dist, 'assets');
mkdirSync(assets, { recursive: true });
writeFileSync(join(dist, '.nojekyll'), '');
cpSync(join(here, 'src/styles.css'), join(assets, 'styles.css'));
cpSync(join(here, 'src/main.js'), join(assets, 'main.js'));
cpSync(join(root, 'mobile/assets/landscape'), join(assets, 'landscape'), { recursive: true });
for (const s of ['home', 'path', 'mind', 'progress']) cpSync(join(root, `design/figma-v4.3/${s}.png`), join(assets, `screen-${s}.png`));
const fonts = join(root, 'mobile/node_modules/@expo-google-fonts');
for (const [family, file] of [['fraunces', 'Fraunces_500Medium'], ['figtree', 'Figtree_400Regular'], ['figtree', 'Figtree_600SemiBold']]) {
  const weight = file.match(/_(\d+)/)[1];
  const src = join(fonts, family, weight + file.replace(/^.*_\d+/, ''), `${file}.ttf`);
  if (!existsSync(src)) throw new Error(`Font not found: ${src}`);
  cpSync(src, join(assets, `${file}.ttf`));
}

for (const [lang, dict] of Object.entries(langs)) {
  const base = lang === 'fr' ? '' : '../';
  const mail = (subject) => `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}`;
  const vars = {
    base,
    contact: CONTACT,
    site: SITE,
    mailto: mail(dict.meta.mailSubject),
    mailtoPro: mail(dict.meta.proSubject),
    'svg.tree': parts.tree,
    'svg.sprout': parts.sprout,
    painStrings: JSON.stringify(dict.pain).replace(/</g, '\\u003c'),
  };
  const html = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => (key in vars ? vars[key] : lookup(dict, key)));
  const dir = lang === 'fr' ? dist : join(dist, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}
console.log('Built', Object.keys(langs).join(', '), '→', dist);
