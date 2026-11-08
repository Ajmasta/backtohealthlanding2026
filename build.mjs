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
const parts = { tree: svg('design/logo/tree-logo.svg') };
const stages = ['01-pousse', '02-jeune-arbre', '03-presque-mature', '04-arbre-mature'].map((f) => svg(`design/tree/${f}.svg`).replace(/<desc>.*?<\/desc>/s, ''));
const template = read(join(here, 'src/template.html'));
const programTemplate = read(join(here, 'src/program.html'));
const appText = { fr: JSON.parse(read(join(root, 'mobile/src/i18n/fr.json'))), en: JSON.parse(read(join(root, 'mobile/src/i18n/en.json'))) };
const lessonIds = [...read(join(root, 'mobile/src/content/lessons.ts')).matchAll(/id: '(\w+)', module: (\d+)/g)].map((m) => ({ id: m[1], module: Number(m[2]) }));
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const items = (list) => list.map((t) => `<li>${esc(t)}</li>`).join('');
const rows = (list) => list.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('');

/** The page's lists, built from the app's own text so they stay in step with it. */
function programParts(lang, dict) {
  const app = appText[lang];
  const levels = Object.keys(app.exercise).reduce((acc, code) => {
    const [family] = code.split('_');
    (acc[family] ??= []).push(app.exercise[code]);
    return acc;
  }, {});
  const familyCards = Object.entries(levels)
    .map(([family, names]) => `<div class="card family"><h4>${family}. ${esc(dict.program.families[family - 1])}</h4><ol>${items(names)}</ol></div>`)
    .join('');
  const modules = lessonIds.reduce((acc, l) => ((acc[l.module] ??= []).push(app.lesson.titles[l.id]), acc), {});
  const lessonCards = Object.entries(modules)
    .map(([module, titles]) => `<div class="card family"><h4>${esc(app.lesson.modules[module])}</h4><ol>${items(titles)}</ol></div>`)
    .join('');
  const p = dict.program;
  return {
    glanceRows: rows([p.g1, p.g2, p.g3, p.g4]),
    evalItems: items(p.eval),
    followItems: items(p.follow),
    afterItems: items(p.after),
    medThemes: items(p.medThemes),
    familyCards,
    lessonCards,
  };
}

rmSync(dist, { recursive: true, force: true });
const assets = join(dist, 'assets');
mkdirSync(assets, { recursive: true });
writeFileSync(join(dist, '.nojekyll'), '');
cpSync(join(here, 'src/styles.css'), join(assets, 'styles.css'));
cpSync(join(here, 'src/main.js'), join(assets, 'main.js'));
cpSync(join(root, 'mobile/assets/landscape'), join(assets, 'landscape'), { recursive: true });
for (const f of ['icon-48.png', 'icon-512.png', 'apple-touch-icon.png', 'og-fr.png', 'og-en.png']) cpSync(join(here, 'src/share', f), join(assets, f));
// Captured from the app at 3x (390 × 844 points), so they stay sharp on retina screens.
for (const s of ['home', 'path', 'mind', 'progress']) cpSync(join(here, `src/screens/${s}.png`), join(assets, `screen-${s}.png`));
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
  const pageUrl = lang === 'fr' ? SITE : `${SITE}${lang}/`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${SITE}#org`, name: 'BackToHealth', url: SITE, logo: `${SITE}assets/icon-512.png`, email: CONTACT },
      { '@type': 'WebSite', '@id': `${SITE}#site`, name: 'BackToHealth', url: SITE, publisher: { '@id': `${SITE}#org` }, inLanguage: ['fr', 'en'] },
      { '@type': 'WebPage', url: pageUrl, name: dict.meta.title, description: dict.meta.description, inLanguage: lang, isPartOf: { '@id': `${SITE}#site` } },
    ],
  };
  const vars = {
    base,
    pageUrl,
    ogImage: `${SITE}assets/og-${lang}.png`,
    jsonLd: JSON.stringify(jsonLd).replace(/</g, '\u003c'),
    contact: CONTACT,
    site: SITE,
    mailto: mail(dict.meta.mailSubject),
    mailtoPro: mail(dict.meta.proSubject),
    'svg.tree': parts.tree,
    'svg.stage1': stages[0],
    'svg.stage2': stages[1],
    'svg.stage3': stages[2],
    'svg.stage4': stages[3],
    painStrings: JSON.stringify(dict.pain).replace(/</g, '\\u003c'),
  };
  const html = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => (key in vars ? vars[key] : lookup(dict, key)));
  const dir = lang === 'fr' ? dist : join(dist, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);

  // The program page sits one folder deeper.
  const programVars = { ...vars, ...programParts(lang, dict), base: `${base}../`, pageUrl: `${pageUrl}programme/` };
  const program = programTemplate.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => (key in programVars ? programVars[key] : lookup(dict, key)));
  mkdirSync(join(dir, 'programme'), { recursive: true });
  writeFileSync(join(dir, 'programme', 'index.html'), program);
}
writeFileSync(join(dist, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: ${SITE}sitemap.xml
`);
const links = `<xhtml:link rel="alternate" hreflang="fr" href="${SITE}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}en/"/>`;
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>${SITE}</loc>${links}</url>
<url><loc>${SITE}en/</loc>${links}</url>
<url><loc>${SITE}programme/</loc></url>
<url><loc>${SITE}en/programme/</loc></url>
</urlset>
`);
console.log('Built', Object.keys(langs).join(', '), '→', dist);
