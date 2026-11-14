// Builds the static site into docs/ (GitHub Pages serves that folder): every page of site.config.mjs, in every language.
// Everything it reads is inside this repository. To refresh what comes from the app, run scripts/sync-from-app.mjs first.
// Run: npm run build

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT, LANGS, PAGES, SHOWCASE, SITE } from '../site.config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'docs');
const read = (p) => readFileSync(join(root, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

// ---------- Text helpers ----------

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** JSON that is safe inside a <script> element. */
const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const items = (list) => list.map((t) => `<li>${esc(t)}</li>`).join('');
const rows = (list) => list.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('');
const card = (title, list) => `<div class="card family"><h4>${esc(title)}</h4><ol>${items(list)}</ol></div>`;
const get = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj);

/** All dotted keys of a nested object, to compare languages. */
const keysOf = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

/**
 * Fills a template:
 * - `{{> name}}` includes src/partials/name.html;
 * - `{{#each list}}…{{/each}}` repeats its content for each item of a list in the language file, where `{{.field}}`
 *   is a field of the item (or `{{.}}` the item itself) and `{{@n}}` its number, from 1;
 * - `{{key}}` takes `vars[key]` as is (it is already HTML), or else the text `key` from the language file, escaped.
 * A missing key stops the build.
 */
function render(template, vars, dict, where) {
  const withPartials = template.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => partials[name] ?? fail(`Unknown partial "${name}" in ${where}`));
  const withLists = withPartials.replace(/\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, body) => {
    const list = get(dict, key);
    if (!Array.isArray(list)) fail(`"${key}" is not a list for ${dict.lang} in ${where}`);
    return list
      .map((item, i) =>
        body.replace(/\{\{\s*(@n|\.[\w]*)\s*\}\}/g, (_, ref) => {
          if (ref === '@n') return String(i + 1);
          const value = ref === '.' ? item : item?.[ref.slice(1)];
          if (typeof value !== 'string') fail(`Missing "${key}[${i}]${ref === '.' ? '' : ref}" for ${dict.lang} in ${where}`);
          return esc(value);
        }),
      )
      .join('');
  });
  return withLists.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    if (key in vars) return vars[key];
    const value = get(dict, key);
    if (typeof value !== 'string') fail(`Missing text "${key}" for ${dict.lang} in ${where}`);
    return esc(value);
  });
}

function fail(message) {
  throw new Error(message);
}

// ---------- Inputs ----------

/** French typography: the space before : ; ? ! and inside « » never breaks, so a sign is never alone at the start of a line. */
const frenchSpaces = (value, key) => {
  if (typeof value === 'string') return key === 'url' ? value : value.replace(/ ([:;?!»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
  if (Array.isArray(value)) return value.map((v) => frenchSpaces(v));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, frenchSpaces(v, k)]));
};
const dicts = Object.fromEntries(LANGS.map(({ code }) => [code, code === 'fr' ? frenchSpaces(readJson(`content/i18n/${code}.json`)) : readJson(`content/i18n/${code}.json`)]));
const appContent = Object.fromEntries(LANGS.map(({ code }) => [code, readJson(`content/app/${code}.json`)]));
const templates = Object.fromEntries(PAGES.map((p) => [p.id, read(`src/pages/${p.template}`)]));
const partials = Object.fromEntries(readdirSync(join(root, 'src/partials')).map((f) => [f.replace(/\.html$/, ''), read(`src/partials/${f}`).trimEnd() + (f === 'head.html' ? '\n' : '')]));
const svg = (name) => read(`src/assets/svg/${name}.svg`).trim();
const svgVars = {
  'svg.tree': svg('tree-logo'),
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [`svg.stage${n}`, svg(`tree-stage-${n}`)])),
};

// Every language must have the same text keys, so a page never ships half translated.
const [first, ...others] = LANGS.map((l) => l.code);
const reference = new Set(keysOf(dicts[first]));
for (const code of others) {
  const own = new Set(keysOf(dicts[code]));
  const missing = [...reference].filter((k) => !own.has(k));
  const extra = [...own].filter((k) => !reference.has(k));
  if (missing.length || extra.length) fail(`content/i18n/${code}.json differs from ${first}.json. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`);
}

// ---------- Assets ----------

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, '.nojekyll'), '');
// The SVGs are inlined into the pages, so they are not copied.
cpSync(join(root, 'src/assets'), join(dist, 'assets'), { recursive: true, filter: (src) => !src.includes(`${join('src', 'assets', 'svg')}`) });
// A short content hash in the URL, so a new version is never hidden behind a cached one.
const version = (p) => createHash('sha256').update(read(p)).digest('hex').slice(0, 8);
const v = { 'v.styles': version('src/assets/styles.css'), 'v.main': version('src/assets/main.js') };

// ---------- Pages ----------

const urlOf = (lang, page) => `${SITE}${lang.dir}${page.dir}`;
const depth = (path) => path.split('/').filter(Boolean).length;

/** The lists of the program page, from the app's own content so they stay in step with it. */
function programVars(dict, app) {
  const p = dict.program;
  if (app.exerciseFamilies.length !== p.families.length) fail(`${dict.lang}: ${app.exerciseFamilies.length} exercise families in the app, ${p.families.length} names in program.families`);
  return {
    glanceRows: rows([p.g1, p.g2, p.g3, p.g4]),
    evalItems: items(p.eval),
    followItems: items(p.follow),
    afterItems: items(p.after),
    medThemes: items(p.medThemes),
    familyCards: app.exerciseFamilies.map((names, i) => card(`${i + 1}. ${p.families[i]}`, names)).join(''),
    lessonCards: app.lessonModules.map((m) => card(m.title, m.lessons)).join(''),
  };
}

/** The 3D exercise cards of the home page, named from the app's own content. */
function exerciseCards(dict, app, base) {
  return SHOWCASE.map(({ code }) => {
    const [family, level] = code.split('.').map(Number);
    const name = app.exerciseFamilies[family - 1]?.[level - 1] ?? fail(`No exercise ${code} in content/app/${dict.lang}.json`);
    const src = `${base}assets/exercises/${code}`;
    return `<figure class="move reveal"><div class="move-frame"><video class="lazy-video" muted loop playsinline preload="none" width="480" height="360" poster="${src}.webp" data-src="${src}.mp4" aria-label="${esc(name)}"></video></div>`
      + `<figcaption><span class="tag tag-2">${esc(dict.program.families[family - 1])}</span>${esc(name)}</figcaption></figure>`;
  }).join('');
}

for (const [li, lang] of LANGS.entries()) {
  const dict = dicts[lang.code];
  const other = LANGS[(li + 1) % LANGS.length];
  const mail = (subject) => `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}`;

  for (const page of PAGES) {
    const path = `${lang.dir}${page.dir}`;
    const base = '../'.repeat(depth(path));
    const pageUrl = urlOf(lang, page);
    const title = get(dict, `${page.meta}.title`);
    const description = get(dict, `${page.meta}.description`);
    const hreflangLinks = [
      ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${urlOf(l, page)}">`),
      `<link rel="alternate" hreflang="x-default" href="${urlOf(LANGS[0], page)}">`,
    ].join('\n');
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', '@id': `${SITE}#org`, name: 'BackToHealth', alternateName: 'Crescendos', url: SITE, logo: `${SITE}assets/share/icon-512.png`, email: CONTACT },
        { '@type': 'WebSite', '@id': `${SITE}#site`, name: 'BackToHealth', url: SITE, publisher: { '@id': `${SITE}#org` }, inLanguage: LANGS.map((l) => l.code) },
        { '@type': 'WebPage', url: pageUrl, name: title, description, inLanguage: lang.code, isPartOf: { '@id': `${SITE}#site` } },
      ],
    };
    const vars = {
      ...svgVars,
      ...v,
      base,
      pageUrl,
      hreflangLinks,
      otherLangHref: `${base}${other.dir}${page.dir}`,
      ogImage: `${SITE}assets/share/og-${lang.code}.png`,
      jsonLd: scriptJson(jsonLd),
      contact: CONTACT,
      site: SITE,
      mailto: esc(mail(dict.meta.mailSubject)),
      mailtoPro: esc(mail(dict.meta.proSubject)),
      painStrings: scriptJson({ ...dict.pain, scale: dict.app.pain }),
      'page.ogType': page.ogType,
      ...(page.id === 'program' ? programVars(dict, appContent[lang.code]) : {}),
      ...(page.id === 'home' ? { exerciseCards: exerciseCards(dict, appContent[lang.code], base) } : {}),
    };
    const html = render(templates[page.id], vars, { ...dict, page: { title, description } }, `${page.template} (${lang.code})`);
    mkdirSync(join(dist, path), { recursive: true });
    writeFileSync(join(dist, path, 'index.html'), html);
  }
}

// ---------- Robots and sitemap ----------

writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
const urls = PAGES.flatMap((page) => {
  const alternates = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l.code}" href="${urlOf(l, page)}"/>`).join('');
  return LANGS.map((lang) => `<url><loc>${urlOf(lang, page)}</loc>${alternates}</url>`);
});
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
);

console.log(`Built ${PAGES.length} pages × ${LANGS.map((l) => l.code).join(', ')} → ${dist}`);
